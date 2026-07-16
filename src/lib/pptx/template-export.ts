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

/** First run's <a:rPr> in a paragraph or shape — preserves template styling. */
function firstRunProps(fragment: string): string {
  const m = fragment.match(
    /<a:r>\s*(<a:rPr[\s\S]*?<\/a:rPr>|<a:rPr[^>]*\/>)/,
  );
  return m ? m[1] : '<a:rPr lang="en"/>';
}

function endParaProps(paragraph: string): string {
  const m = paragraph.match(/<a:endParaRPr[\s\S]*?<\/a:endParaRPr>|<a:endParaRPr[^>]*\/>/);
  return m ? m[0] : '<a:endParaRPr lang="en"/>';
}

/** Rebuild a single paragraph, keeping its pPr and first-run styling. */
function setParagraphText(
  paragraph: string,
  line: string,
  fallbackRPr: string,
): string {
  const pPr = paragraphProps(paragraph);
  if (line.trim() === "") {
    return `<a:p>${pPr}${endParaProps(paragraph)}</a:p>`;
  }
  const rPr = firstRunProps(paragraph) || fallbackRPr;
  return `<a:p>${pPr}<a:r>${rPr}<a:t>${escapeXml(line)}</a:t></a:r></a:p>`;
}

/**
 * Substitute a text shape's content while preserving the template's paragraph
 * structure (run sizes/colors/fonts and blank-line spacers). New content lines
 * are mapped onto the template's content paragraphs in order; blank spacer
 * paragraphs are kept untouched. Extra lines are appended using the shape's
 * primary run style, separated by a blank spacer to mimic template rhythm.
 */
function replaceShapeText(
  slideXml: string,
  shapeIndex: number,
  newText: string,
  slideNum?: number,
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
  const contentLines = newText.split("\n").filter((l) => l.trim() !== "");

  let cursor = 0;
  let lastContentParagraph: string | null = null;
  const spacerParagraph =
    paragraphs.find((p) => paragraphText(p).trim() === "") ?? null;

  const rebuilt: string[] = paragraphs.map((paragraph) => {
    if (paragraphText(paragraph).trim() === "") return paragraph;
    lastContentParagraph = paragraph;
    const line = cursor < contentLines.length ? contentLines[cursor++] : "";
    return setParagraphText(paragraph, line, shapeRPr);
  });

  if (cursor < contentLines.length) {
    const template = lastContentParagraph ?? paragraphs[0];
    const spacer =
      spacerParagraph ??
      `<a:p>${paragraphProps(template)}<a:endParaRPr lang="en"/></a:p>`;
    while (cursor < contentLines.length) {
      rebuilt.push(spacer);
      rebuilt.push(setParagraphText(template, contentLines[cursor++], shapeRPr));
    }
  }

  const newShape = shape.replace(
    /(<a:lstStyle\/>|<a:lstStyle>[\s\S]*?<\/a:lstStyle>)[\s\S]*?(<\/p:txBody>)/,
    `$1${rebuilt.join("")}$2`,
  );

  return slideXml.replace(shape, newShape);
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

  // Slide 4 — one-pager part 1 (greeting + body), callout sidebar, subject
  add(
    4,
    0,
    [s.onePager.greeting, s.onePager.bodyPart1].filter(Boolean).join("\n"),
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
    for (const edit of slideEdits) {
      xml = replaceShapeText(xml, edit.shapeIndex, edit.value, edit.slide);
    }
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

  // Content slides: whiten the red-band title placeholders (header + subject)
  // and grow overflow-prone body boxes so the preview matches PowerPoint.
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
    } else {
      warnPptx(`slide ${slideNum} GIF could not be loaded — kept template default.`);
    }
  }

  return Buffer.from(
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

export function pptxFilename(doc: MiniBoxDocument) {
  const base = (doc.title || doc.topic || "Mini-Box")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `Mini-Box-${base || "Untitled"}.pptx`;
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
