import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import type { MiniBoxDocument, GifSelection } from "@/lib/mini-box";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "mini-box-master.pptx",
);

/** Slide → GIF media path (Shadow AI master template) */
const GIF_SLOTS: Record<number, string> = {
  2: "ppt/media/image6.gif",
  4: "ppt/media/image10.gif",
  7: "ppt/media/image11.gif",
};

/** Divider slides (One-Pager, Chats) — title style from slideLayout3 */
const DIVIDER_SLIDES = [3, 6] as const;

const DIVIDER_TITLE_LST_STYLE =
  '<a:lstStyle><a:lvl1pPr lvl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="5600"/><a:buFont typeface="Inter Tight"/><a:buNone/><a:defRPr sz="5600"><a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/></a:defRPr></a:lvl1pPr></a:lstStyle>';

const DIVIDER_TITLE_RUN_PR =
  '<a:rPr lang="en" sz="5600"><a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/></a:rPr>';

const DIVIDER_END_PARA_RPR =
  '<a:endParaRPr sz="5600"><a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/></a:endParaRPr>';

/** Divider slides ship with empty lstStyle; pptx-viewer falls back to default body size */
export function fixDividerSlideTitleFormatting(slideXml: string): string {
  if (!/<p:ph type="title"\/>/.test(slideXml)) return slideXml;

  return slideXml
    .replace(/<a:lstStyle\/>/, DIVIDER_TITLE_LST_STYLE)
    .replace(
      /<a:r><a:rPr lang="en"\/><a:t>([\s\S]*?)<\/a:t><\/a:r>/,
      `<a:r>${DIVIDER_TITLE_RUN_PR}<a:t>$1</a:t></a:r>`,
    )
    .replace(/<a:endParaRPr\/>/, DIVIDER_END_PARA_RPR);
}

async function gifToBuffer(gif: GifSelection): Promise<Buffer | null> {
  if (!gif?.url && !gif?.previewUrl) return null;
  const url = gif.url || gif.previewUrl;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitParagraphs(text: string) {
  return text.split(/\n/).filter(Boolean);
}

/** Replace Nth text shape's content on a slide */
function replaceShapeText(
  slideXml: string,
  shapeIndex: number,
  newText: string,
): string {
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const textShapes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = shapeRegex.exec(slideXml)) !== null) {
    if (/<a:t[\s>]/.test(m[0])) textShapes.push(m[0]);
  }
  if (shapeIndex >= textShapes.length) return slideXml;

  const oldShape = textShapes[shapeIndex];
  const paras = splitParagraphs(newText);
  const lines = paras.length ? paras : [newText];

  let paraIdx = 0;
  const newShape = oldShape.replace(/<a:p[\s\S]*?<\/a:p>/g, (para) => {
    const line = lines[paraIdx] ?? "";
    paraIdx += 1;
    return para.replace(/<a:t[^>]*>[\s\S]*?<\/a:t>/g, () =>
      `<a:t>${escapeXml(line)}</a:t>`,
    );
  });

  return slideXml.replace(oldShape, newShape);
}

function buildReplacements(doc: MiniBoxDocument) {
  const s = doc.sections;
  const topic = s.title.topicTitle || doc.topic || "Untitled Mini Box";

  return {
    1: {
      0: topic,
    },
    2: {
      1: s.welcome.intro,
      2: s.welcome.contents,
    },
    4: {
      0: [s.onePager.greeting, s.onePager.bodyPart1].filter(Boolean).join("\n"),
      1: s.onePager.callout,
      4: s.onePager.subjectLine,
    },
    5: {
      0: [s.onePager.bodyPart2, doc.signature].filter(Boolean).join("\n\n"),
    },
    7: {
      1: s.chat.message,
    },
  } as Record<number, Record<number, string>>;
}

export async function buildMiniBoxFromTemplate(
  doc: MiniBoxDocument,
): Promise<Buffer> {
  const templateBuf = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);
  const replacements = buildReplacements(doc);

  for (const slideNum of DIVIDER_SLIDES) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const xml = await zip.file(slidePath)!.async("string");
    zip.file(slidePath, fixDividerSlideTitleFormatting(xml));
  }

  for (const [slideNumStr, shapeMap] of Object.entries(replacements)) {
    const slideNum = Number(slideNumStr);
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    let xml = await zip.file(slidePath)!.async("string");

    for (const [shapeIdxStr, text] of Object.entries(shapeMap)) {
      if (!text?.trim()) continue;
      xml = replaceShapeText(xml, Number(shapeIdxStr), text);
    }
    zip.file(slidePath, xml);
  }

  // Replace welcome closing on slide 2 block 2 append or separate - add to contents end
  const closing = doc.sections.welcome.closing;
  if (closing.trim()) {
    let xml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    const s2 = doc.sections;
    const combined = [s2.welcome.contents, closing].filter(Boolean).join("\n\n");
    xml = replaceShapeText(xml, 2, combined);
    zip.file("ppt/slides/slide2.xml", xml);
  }

  const gifs: Array<[number, GifSelection]> = [
    [2, doc.sections.welcome.gif],
    [4, doc.sections.onePager.gif],
    [7, doc.sections.chat.gif],
  ];

  for (const [slideNum, gif] of gifs) {
    const mediaPath = GIF_SLOTS[slideNum];
    if (!mediaPath || !gif) continue;
    const buf = await gifToBuffer(gif);
    if (buf) zip.file(mediaPath, buf);
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
  const NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const PNS = "http://schemas.openxmlformats.org/presentationml/2006/main";

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
