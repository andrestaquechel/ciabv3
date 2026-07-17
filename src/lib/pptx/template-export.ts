import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import type { MiniBoxDocument, GifSelection } from "@/lib/mini-box";
import { SHADOW_AI_SECTION_DEFAULTS } from "@/lib/mini-box-shadow-ai-defaults";
import {
  escapeXml,
  fixContentBoxOverflow,
  fixContentHeaderColor,
  fixSlideFormatting,
  getTextShapes,
  TEMPLATE_FILE,
  TEMPLATE_NAME,
} from "@/lib/pptx/slide-formatting";

export { TEMPLATE_NAME, TEMPLATE_FILE };
export { fixSlideFormatting } from "@/lib/pptx/slide-formatting";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", TEMPLATE_FILE);
const SIGNATURE_PLACEHOLDER = "{{ SIGNATURE }}";

/** Surface template-mapping problems instead of silently shipping a wrong deck. */
function warnPptx(message: string) {
  console.warn(`[pptx-export] ${message}`);
}

/** Slide → GIF media path (Shadow AI Mini Box template) */
const GIF_SLOTS: Record<number, string> = {
  2: "ppt/media/image6.gif",
  4: "ppt/media/image10.gif",
  7: "ppt/media/image11.gif",
};

async function gifToBuffer(gif: GifSelection): Promise<Buffer | null> {
  if (!gif?.url && !gif?.previewUrl) return null;
  const url = gif.url || gif.previewUrl;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      warnPptx(`GIF fetch failed (${res.status}) for ${url}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    warnPptx(`GIF fetch threw for ${url}: ${err instanceof Error ? err.message : "error"}`);
    return null;
  }
}

/** Normalize text so curly/straight quotes, ellipses and whitespace compare equal. */
function normalizeText(value: string): string {
  return (value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

function isUnchanged(value: string, templateDefault: string): boolean {
  return normalizeText(value) === normalizeText(templateDefault);
}

// --- text-shape substitution helpers -------------------------------------

function paragraphText(paragraph: string): string {
  return [...paragraph.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((m) => m[1])
    .join("");
}

function paragraphProps(paragraph: string): string {
  const m = paragraph.match(/<a:pPr[\s\S]*?<\/a:pPr>|<a:pPr[^>]*\/>/);
  return m ? m[0] : "";
}

/** First run's <a:rPr> in a paragraph or shape — preserves template styling.
 *  Self-closing form is matched FIRST and bounded by `[^>]` so a self-closing
 *  `<a:rPr .../>` is never mistaken for the opening of a paired `<a:rPr>…</a:rPr>`
 *  (which would swallow the run's text and the next run, duplicating content). */
function firstRunProps(fragment: string): string {
  const m = fragment.match(
    /<a:r>\s*(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*?>[\s\S]*?<\/a:rPr>)/,
  );
  return m ? m[1] : '<a:rPr lang="en"/>';
}

function endParaProps(paragraph: string): string {
  const m = paragraph.match(/<a:endParaRPr[\s\S]*?<\/a:endParaRPr>|<a:endParaRPr[^>]*\/>/);
  return m ? m[0] : '<a:endParaRPr lang="en"/>';
}

/** A whole line wrapped in markdown emphasis (e.g. the chat "_Hint: …_" line)
 *  should render as real italic/bold, not show the literal * or _ characters. */
function parseEmphasis(line: string): { text: string; italic: boolean; bold: boolean } {
  const wrapped = (o: string) =>
    line.length > o.length * 2 && line.startsWith(o) && line.endsWith(o);
  if (wrapped("**") || wrapped("__")) return { text: line.slice(2, -2), italic: false, bold: true };
  if (wrapped("*") || wrapped("_")) return { text: line.slice(1, -1), italic: true, bold: false };
  return { text: line, italic: false, bold: false };
}

/** Add i="1"/b="1" to a run's <a:rPr> opening tag (self-closing or not). */
function withEmphasis(rPr: string, italic: boolean, bold: boolean): string {
  if (!italic && !bold) return rPr;
  let add = "";
  if (bold && !/\bb="1"/.test(rPr)) add += ' b="1"';
  if (italic && !/\bi="1"/.test(rPr)) add += ' i="1"';
  if (!add) return rPr;
  return rPr.replace(/^<a:rPr\b([^>]*?)(\/?)>/, (_m, attrs, slash) => `<a:rPr${attrs}${add}${slash}>`);
}

/** Force a run's <a:rPr> to bold, replacing any existing b="0"/b="1". */
function withBold(rPr: string): string {
  const s = rPr.replace(/\sb="[01]"/g, "");
  return s.replace(/^<a:rPr\b([^>]*?)(\/?)>/, (_m, attrs, slash) => `<a:rPr${attrs} b="1"${slash}>`);
}

/** Strip inline markdown bold markers (**text** / __text__) so they don't render
 *  as literal asterisks/underscores — the whole body is force-bolded anyway. */
function stripInlineEmphasisMarkers(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
}

function plainRun(text: string, rPr: string): string {
  return `<a:r>${rPr}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

/** Turn a run's <a:rPr> into a hyperlink rPr: underline + theme hlink color +
 *  an hlinkClick pointing at a placeholder r:id resolved later against the rels. */
function hyperlinkRPr(baseRPr: string, id: number): string {
  let s = baseRPr;
  if (/\/>\s*$/.test(s)) s = s.replace(/\/>\s*$/, "></a:rPr>");
  s = s.replace(/^<a:rPr\b([^>]*)>/, (mm, attrs) => (/\bu=/.test(attrs) ? mm : `<a:rPr${attrs} u="sng">`));
  const hlinkFill = '<a:solidFill><a:schemeClr val="hlink"/></a:solidFill>';
  if (/<a:solidFill>[\s\S]*?<\/a:solidFill>/.test(s)) s = s.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, hlinkFill);
  else s = s.replace(/^(<a:rPr\b[^>]*>)/, `$1${hlinkFill}`);
  return s.replace(/<\/a:rPr>\s*$/, `<a:hlinkClick r:id="__HL_${id}__"/></a:rPr>`);
}

/** Build a paragraph's runs, rendering markdown links [text](url) as real
 *  hyperlink runs (their urls pushed to linkSink for rels resolution). */
function buildParagraphRuns(line: string, rPr: string, linkSink: { url: string }[]): string {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let idx = 0;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > idx) out += plainRun(line.slice(idx, m.index), rPr);
    const id = linkSink.length;
    linkSink.push({ url: m[2] });
    out += `<a:r>${hyperlinkRPr(rPr, id)}<a:t>${escapeXml(m[1])}</a:t></a:r>`;
    idx = m.index + m[0].length;
  }
  if (idx < line.length) out += plainRun(line.slice(idx), rPr);
  return out || plainRun(line, rPr);
}

/** Rebuild a single paragraph, keeping its pPr and first-run styling. When
 *  forceBold is set (body content slides), every run is bolded and stray inline
 *  markdown bold markers are stripped so no literal ** / __ show. */
function setParagraphText(
  paragraph: string,
  line: string,
  fallbackRPr: string,
  linkSink: { url: string }[] = [],
  forceBold = false,
): string {
  const pPr = paragraphProps(paragraph);
  if (line.trim() === "") {
    return `<a:p>${pPr}${endParaProps(paragraph)}</a:p>`;
  }
  const parsed = parseEmphasis(line);
  const text = forceBold ? stripInlineEmphasisMarkers(parsed.text) : parsed.text;
  let rPr = withEmphasis(firstRunProps(paragraph) || fallbackRPr, parsed.italic, parsed.bold);
  if (forceBold) rPr = withBold(rPr);
  return `<a:p>${pPr}${buildParagraphRuns(text, rPr, linkSink)}</a:p>`;
}

/**
 * Substitute a text shape's content while preserving the template's per-paragraph
 * styling (run sizes/colors/fonts) and honoring the NEW content's own line
 * structure.
 *
 * The generated content's newlines define the paragraph layout: a single "\n"
 * is a new line, a blank line ("\n\n") is one intentional spacer. Each content
 * line is styled from the matching template content paragraph (by index) so
 * per-line styling like a bold list header is kept; overflow lines reuse the
 * last content style. The template's trailing "padding" paragraphs (a run of
 * empty paragraphs many templates carry for spacing) are DROPPED — left in
 * place they otherwise land in the middle of shorter content, producing huge
 * gaps and pushing text over the slide's GIF.
 */
export function replaceShapeText(
  slideXml: string,
  shapeIndex: number,
  newText: string,
  slideNum?: number,
  linkSink: { url: string }[] = [],
  forceBold = false,
): string {
  const shapes = getTextShapes(slideXml);
  const shape = shapes[shapeIndex];
  if (!shape) {
    warnPptx(
      `slide ${slideNum ?? "?"}: text shape index ${shapeIndex} not found (only ${shapes.length} text shapes) — edit skipped. Template shape order may have shifted.`,
    );
    return slideXml;
  }

  const paragraphs = [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((m) => m[0]);
  if (!paragraphs.length) return slideXml;

  const shapeRPr = firstRunProps(shape);
  const contentParagraphs = paragraphs.filter(
    (p) => paragraphText(p).trim() !== "",
  );
  const blankTemplate = paragraphs.find((p) => paragraphText(p).trim() === "");
  const primaryTemplate = contentParagraphs[0] ?? paragraphs[0];

  const makeSpacer = (): string =>
    blankTemplate
      ? `<a:p>${paragraphProps(blankTemplate)}${endParaProps(blankTemplate)}</a:p>`
      : `<a:p>${paragraphProps(primaryTemplate)}<a:endParaRPr lang="en"/></a:p>`;

  // Drop leading/trailing blank lines so joins never emit stray spacers.
  const lines = newText.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  const rebuilt: string[] = [];
  let ci = 0; // pointer into the template's content paragraphs
  for (const raw of lines) {
    if (raw.trim() === "") {
      rebuilt.push(makeSpacer());
      continue;
    }
    const template =
      contentParagraphs[ci] ??
      contentParagraphs[contentParagraphs.length - 1] ??
      primaryTemplate;
    ci++;
    rebuilt.push(setParagraphText(template, raw, shapeRPr, linkSink, forceBold));
  }
  if (!rebuilt.length) rebuilt.push(makeSpacer());

  // Use replacement FUNCTIONS so a literal "$" in the content (e.g. "$22,000")
  // is never interpreted as a regex backreference (which would corrupt the XML
  // and blank the whole shape).
  const body = rebuilt.join("");
  const newShape = shape.replace(
    /(<a:lstStyle\/>|<a:lstStyle>[\s\S]*?<\/a:lstStyle>)[\s\S]*?(<\/p:txBody>)/,
    (_m, lst, close) => `${lst}${body}${close}`,
  );

  return slideXml.replace(shape, () => newShape);
}

// --- dynamic GIF layout ---------------------------------------------------
//
// The content slides stack vertically: [text above] → [GIF] → ["Via Giphy"] →
// (sometimes) [text below]. We measure the rendered height of the text above
// the GIF and snug the GIF right under it — moving it up to close the gap when
// the copy is short, or down to clear it when the copy is long — shrinking the
// GIF (kept centered, aspect preserved) only if the remaining space is tight,
// then restacking the caption and any below-text.

const SLIDE_H_EMU = 10058400;
const GIF_BOTTOM_MARGIN = 260000;
const GIF_GAP = 170000;
const MIN_GIF_SCALE = 0.55;

type GifLayout = { aboveIdx: number; captionIdx: number; belowIdx?: number };

const GIF_LAYOUT: Record<number, GifLayout> = {
  2: { aboveIdx: 1, captionIdx: 3, belowIdx: 2 }, // intro / GIF / caption / contents
  4: { aboveIdx: 0, captionIdx: 2, belowIdx: 1 }, // greeting+body / GIF / caption / callout
  7: { aboveIdx: 1, captionIdx: 2 }, //               chat / GIF / caption
};

function shapeOff(el: string): { x: number; y: number } | null {
  const m = el.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}
function shapeExt(el: string): { cx: number; cy: number } | null {
  const m = el.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  return m ? { cx: Number(m[1]), cy: Number(m[2]) } : null;
}
function firstFontHundredths(shape: string): number {
  const m = shape.match(/sz="(\d+)"/);
  return m ? Number(m[1]) : 1100;
}

/** Rough rendered height (EMU) of a text shape's content, with a safety margin
 *  so we err toward clearing the GIF rather than overlapping it. Trailing blank
 *  "padding" paragraphs are ignored — an un-edited (default) shape keeps them,
 *  and counting them would wildly overestimate the height. */
function estimateShapeHeightEMU(shape: string): number {
  const ext = shapeExt(shape);
  const width = ext ? ext.cx : 6862200;
  const pt = firstFontHundredths(shape) / 100;
  const lineH = 1.32 * pt * 12700;
  const charW = 0.55 * pt * 12700;
  const cpl = Math.max(12, Math.floor(width / charW));
  const paras = [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((m) => m[0]);
  let last = paras.length - 1;
  while (last >= 0 && paragraphText(paras[last]).trim() === "") last--;
  let lines = 0;
  for (let i = 0; i <= last; i++) {
    const t = paragraphText(paras[i]).replace(/\s+/g, " ").trim();
    if (t === "") {
      lines += 0.85;
      continue;
    }
    lines += Math.max(1, Math.ceil([...t].length / cpl));
  }
  return Math.round(lines * lineH * 1.15);
}

function setOffY(el: string, y: number): string {
  return el.replace(/<a:off x="(-?\d+)" y="-?\d+"\/>/, (_m, x) => `<a:off x="${x}" y="${y}"/>`);
}

/** Reposition (and if needed, shrink) the GIF on a content slide so it clears
 *  the text above it and the caption / below-text still fit underneath. */
function layoutGifSlide(xml: string, cfg: GifLayout): string {
  const texts = getTextShapes(xml);
  const above = texts[cfg.aboveIdx];
  const caption = texts[cfg.captionIdx];
  const below = cfg.belowIdx != null ? texts[cfg.belowIdx] : null;
  const picMatch = xml.match(/<p:pic\b[\s\S]*?<\/p:pic>/);
  if (!above || !caption || !picMatch) return xml;
  const pic = picMatch[0];

  const aOff = shapeOff(above);
  const pOff = shapeOff(pic);
  const pExt = shapeExt(pic);
  const cExt = shapeExt(caption);
  if (!aOff || !pOff || !pExt || !cExt) return xml;

  const aboveBottom = aOff.y + estimateShapeHeightEMU(above);
  const origH = pExt.cy;
  const origW = pExt.cx;
  const centerX = pOff.x + origW / 2;

  // Snug the GIF right under the text above it — moving it UP to close the gap
  // when the copy is short, or DOWN to clear it when the copy is long. This
  // keeps the deck tight regardless of how much the generated content varies.
  const newTop = Math.round(aboveBottom + GIF_GAP);

  const belowH = below ? estimateShapeHeightEMU(below) : 0;
  const reserveBelow = below ? GIF_GAP + belowH : 0;
  const bottomLimit = SLIDE_H_EMU - GIF_BOTTOM_MARGIN - cExt.cy - GIF_GAP - reserveBelow;
  const maxH = bottomLimit - newTop;

  let newH = origH;
  let newW = origW;
  if (maxH < origH) {
    const scale = Math.min(1, Math.max(MIN_GIF_SCALE, maxH / origH));
    newH = Math.round(origH * scale);
    newW = Math.round(origW * scale);
  }

  const newX = Math.round(centerX - newW / 2);
  const captionTop = newTop + newH + GIF_GAP;
  const belowTop = below ? captionTop + cExt.cy + GIF_GAP : null;

  const newPic = pic
    .replace(/<a:off x="-?\d+" y="-?\d+"\/>/, `<a:off x="${newX}" y="${newTop}"/>`)
    .replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${newW}" cy="${newH}"/>`);
  let out = xml.replace(pic, () => newPic);
  out = out.replace(caption, () => setOffY(caption, captionTop));
  if (below && belowTop != null) out = out.replace(below, () => setOffY(below, belowTop));
  return out;
}

// --- content mapping ------------------------------------------------------

type ShapeEdit = { slide: number; shapeIndex: number; value: string };

/**
 * Build the list of shapes whose content differs from the Shadow AI template
 * defaults. Unchanged shapes are skipped entirely so the preview/export render
 * the pristine template.
 */
function buildEdits(doc: MiniBoxDocument): ShapeEdit[] {
  const s = doc.sections;
  const d = SHADOW_AI_SECTION_DEFAULTS;
  const edits: ShapeEdit[] = [];

  const add = (
    slide: number,
    shapeIndex: number,
    value: string,
    templateDefault: string,
  ) => {
    if (!value?.trim()) return;
    if (isUnchanged(value, templateDefault)) return;
    edits.push({ slide, shapeIndex, value });
  };

  // Slide 1 — cover topic
  add(1, 0, s.title.topicTitle || doc.topic || "", d.title.topicTitle);

  // Slide 2 — welcome intro + contents/closing
  add(2, 1, s.welcome.intro, d.welcome.intro);
  add(
    2,
    2,
    [s.welcome.contents, s.welcome.closing].filter(Boolean).join("\n\n"),
    [d.welcome.contents, d.welcome.closing].filter(Boolean).join("\n\n"),
  );

  // Slide 4 — one-pager part 1 (greeting + body), callout sidebar, subject.
  // Greeting and body join with a blank line so they read as separate
  // paragraphs, matching the template's greeting/body rhythm.
  add(
    4,
    0,
    [s.onePager.greeting, s.onePager.bodyPart1].filter(Boolean).join("\n\n"),
    [d.onePager.greeting, d.onePager.bodyPart1].filter(Boolean).join("\n"),
  );
  add(4, 1, s.onePager.callout, d.onePager.callout);
  add(4, 4, s.onePager.subjectLine, d.onePager.subjectLine);

  // Slide 5 — one-pager part 2 (body continuation + signature)
  add(
    5,
    0,
    [s.onePager.bodyPart2, doc.signature].filter(Boolean).join("\n\n"),
    [d.onePager.bodyPart2, SIGNATURE_PLACEHOLDER].filter(Boolean).join("\n\n"),
  );

  // Slide 7 — chat message
  add(7, 1, s.chat.message, d.chat.message);

  return edits;
}

/** Resolve the __HL_n__ placeholders left by hyperlink runs into real slide
 *  relationship ids, appending external hyperlink relationships to the slide's
 *  .rels file. */
async function applyHyperlinkRels(
  zip: JSZip,
  slideNum: number,
  xml: string,
  links: { url: string }[],
): Promise<string> {
  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  const relsFile = zip.file(relsPath);
  let rels = relsFile
    ? await relsFile.async("string")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  let maxId = 0;
  for (const m of rels.matchAll(/Id="rId(\d+)"/g)) maxId = Math.max(maxId, Number(m[1]));
  let additions = "";
  links.forEach((lnk, i) => {
    const rId = `rId${maxId + 1 + i}`;
    additions += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(lnk.url)}" TargetMode="External"/>`;
    xml = xml.split(`__HL_${i}__`).join(rId);
  });
  rels = rels.replace("</Relationships>", `${additions}</Relationships>`);
  zip.file(relsPath, rels);
  return xml;
}

/** Point the "Via Giphy" caption at the GIF now shown above it. The template
 *  ships this caption pre-linked (an <a:hlinkClick r:id="…">) to whatever GIF it
 *  originally held, so after we swap in a new GIF we repoint that existing
 *  relationship to the new GIF's URL — matching the archive house style where
 *  "Via Giphy" links to the exact GIF displayed. */
async function relinkGiphyCaption(
  zip: JSZip,
  slideNum: number,
  captionIdx: number,
  gifUrl: string,
): Promise<void> {
  const slidePath = `ppt/slides/slide${slideNum}.xml`;
  const slideFile = zip.file(slidePath);
  if (!slideFile) return;
  const xml = await slideFile.async("string");
  const caption = getTextShapes(xml)[captionIdx];
  if (!caption) {
    warnPptx(`slide ${slideNum}: caption shape ${captionIdx} not found — "Via Giphy" link not updated.`);
    return;
  }
  const rid = caption.match(/<a:hlinkClick[^>]*r:id="(rId\d+)"/)?.[1];
  if (!rid) return; // template caption carries no hyperlink to repoint

  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return;
  let rels = await relsFile.async("string");
  const relRe = new RegExp(`(<Relationship Id="${rid}"[^>]*Target=")[^"]*(")`);
  if (!relRe.test(rels)) return;
  rels = rels.replace(relRe, (_m, pre, post) => `${pre}${escapeXml(gifUrl)}${post}`);
  zip.file(relsPath, rels);
}

export async function buildMiniBoxFromTemplate(
  doc: MiniBoxDocument,
): Promise<Buffer> {
  const templateBuf = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  // Apply only user edits; unchanged shapes keep the pristine template markup.
  const edits = buildEdits(doc);
  const bySlide = new Map<number, ShapeEdit[]>();
  for (const edit of edits) {
    const list = bySlide.get(edit.slide) ?? [];
    list.push(edit);
    bySlide.set(edit.slide, list);
  }

  for (const [slideNum, slideEdits] of bySlide) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const slideFile = zip.file(slidePath);
    if (!slideFile) {
      warnPptx(`${slidePath} missing from template — ${slideEdits.length} edit(s) skipped.`);
      continue;
    }
    let xml = await slideFile.async("string");
    const slideLinks: { url: string }[] = [];
    for (const edit of slideEdits) {
      // Bold all body content (slides 2/4/5/7); leave the cover title (slide 1)
      // to its own accent styling.
      const forceBold = edit.slide !== 1;
      xml = replaceShapeText(xml, edit.shapeIndex, edit.value, edit.slide, slideLinks, forceBold);
    }
    if (slideLinks.length) xml = await applyHyperlinkRels(zip, slideNum, xml, slideLinks);
    zip.file(slidePath, xml);
  }

  // Placeholder-title fixes for cover + dividers only.
  for (const slideNum of [1, 3, 6]) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const file = zip.file(slidePath);
    if (!file) {
      warnPptx(`${slidePath} missing — formatting fix skipped.`);
      continue;
    }
    const xml = fixSlideFormatting(slideNum, await file.async("string"));
    zip.file(slidePath, xml);
  }

  // Content slides: whiten the red-band title placeholders (header + subject),
  // grow overflow-prone body boxes, then lay out the GIF around the final text.
  for (const slideNum of [2, 4, 5, 7]) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const file = zip.file(slidePath);
    if (!file) {
      warnPptx(`${slidePath} missing — content-slide fix skipped.`);
      continue;
    }
    let xml = await file.async("string");
    xml = fixContentHeaderColor(xml);
    xml = fixContentBoxOverflow(slideNum, xml);
    if (GIF_LAYOUT[slideNum]) xml = layoutGifSlide(xml, GIF_LAYOUT[slideNum]);
    zip.file(slidePath, xml);
  }

  const gifs: Array<[number, GifSelection]> = [
    [2, doc.sections.welcome.gif],
    [4, doc.sections.onePager.gif],
    [7, doc.sections.chat.gif],
  ];

  for (const [slideNum, gif] of gifs) {
    const mediaPath = GIF_SLOTS[slideNum];
    if (!mediaPath) {
      warnPptx(`no GIF slot mapped for slide ${slideNum}.`);
      continue;
    }
    if (!gif) continue;
    if (!zip.file(mediaPath)) {
      warnPptx(`GIF media slot ${mediaPath} (slide ${slideNum}) not in template — GIF not injected.`);
      continue;
    }
    const buf = await gifToBuffer(gif);
    if (buf) {
      zip.file(mediaPath, buf);
      // Repoint the "Via Giphy" caption link to the GIF we just injected.
      const gifUrl = gif.url || gif.previewUrl;
      const captionIdx = GIF_LAYOUT[slideNum]?.captionIdx;
      if (gifUrl && captionIdx != null) {
        await relinkGiphyCaption(zip, slideNum, captionIdx, gifUrl);
      }
    } else {
      warnPptx(`slide ${slideNum} GIF could not be loaded — kept template default.`);
    }
  }

  return Buffer.from(
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

/**
 * Standardized Mini Box name: "MM.YY Mini Box - Title" (e.g.
 * "04.26 Mini Box - Internet of Things (IoT)"). Falls back to
 * "Mini Box - Title" when the month/year aren't known. Used for both the
 * Google Slides file and the downloadable .pptx.
 */
export function miniBoxDisplayName(
  title: string,
  month?: number,
  year?: number,
): string {
  const t = (title || "").trim() || "Untitled";
  if (month && year) {
    const mm = String(month).padStart(2, "0");
    const yy = String(((year % 100) + 100) % 100).padStart(2, "0");
    return `${mm}.${yy} Mini Box - ${t}`;
  }
  return `Mini Box - ${t}`;
}

export function pptxFilename(doc: MiniBoxDocument, month?: number, year?: number) {
  const name = miniBoxDisplayName(doc.title || doc.topic || "", month, year)
    .replace(/[\\/:*?"<>|]/g, "") // strip characters illegal in filenames
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${name}.pptx`;
}

/** Extract slide text blocks for template-faithful preview */
export async function extractTemplateSlideTexts(
  doc: MiniBoxDocument,
): Promise<string[][]> {
  const buf = await buildMiniBoxFromTemplate(doc);
  const zip = await JSZip.loadAsync(buf);

  const slides: string[][] = [];
  for (let sn = 1; sn <= 7; sn++) {
    const file = zip.file(`ppt/slides/slide${sn}.xml`);
    if (!file) continue;
    const xml = await file.async("string");
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(xml);
    const blocks: string[] = [];

    const shapes = parsed?.sld?.cSld?.spTree?.sp ?? [];
    const shapeList = Array.isArray(shapes) ? shapes : shapes ? [shapes] : [];

    for (const sp of shapeList) {
      const txBody = sp?.txBody;
      if (!txBody) continue;
      const paras = txBody.p;
      const paraList = Array.isArray(paras) ? paras : paras ? [paras] : [];
      const lines: string[] = [];
      for (const p of paraList) {
        const runs = p?.r;
        const runList = Array.isArray(runs) ? runs : runs ? [runs] : [];
        let line = "";
        for (const r of runList) {
          const t = r?.t;
          if (typeof t === "string") line += t;
          else if (t?.["#text"]) line += t["#text"];
        }
        if (line) lines.push(line);
      }
      if (lines.length) blocks.push(lines.join("\n"));
    }
    slides.push(blocks);
  }
  return slides;
}
