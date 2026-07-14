/** Shadow AI Mini Box template — slide text formatting for pptx-viewer fidelity */

const FONT_INTER = `<a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/>`;
const FONT_INTER_MEDIUM = `<a:latin typeface="Inter Tight Medium"/><a:ea typeface="Inter Tight Medium"/><a:cs typeface="Inter Tight Medium"/><a:sym typeface="Inter Tight Medium"/>`;
const FILL_BLACK = `<a:solidFill><a:srgbClr val="000000"/></a:solidFill>`;
const FILL_DK1 = `<a:solidFill><a:schemeClr val="dk1"/></a:solidFill>`;
const FILL_ACCENT1 = `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>`;

export const TEMPLATE_NAME = "Shadow AI Mini Box";
export const TEMPLATE_FILE = "mini-box-master.pptx";

/** cx/cy from presentation.xml (EMU) */
export const SLIDE_ASPECT = 7772400 / 10058400;

/** Per-slide text shape default sizes (hundredths of a point) */
export const SLIDE_SHAPE_SIZES: Record<number, Record<number, number>> = {
  2: { 0: 1600, 1: 1100, 2: 1100 },
  4: { 0: 1100, 1: 1100, 3: 1600, 4: 1100 },
  5: { 0: 1100, 1: 1600 },
  7: { 0: 1600, 1: 1100 },
};

const DIVIDER_TITLE_LST_STYLE =
  '<a:lstStyle><a:lvl1pPr lvl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="5600"/><a:buFont typeface="Inter Tight"/><a:buNone/><a:defRPr sz="5600">' +
  FONT_INTER +
  '</a:defRPr></a:lvl1pPr></a:lstStyle>';

const DIVIDER_TITLE_RUN_PR = `<a:rPr lang="en" sz="5600">${FILL_BLACK}${FONT_INTER}</a:rPr>`;
const DIVIDER_END_PARA_RPR = `<a:endParaRPr sz="5600">${FILL_BLACK}${FONT_INTER}</a:endParaRPr>`;
const COVER_TOPIC_RUN_PR = `<a:rPr lang="en" sz="2600">${FILL_ACCENT1}${FONT_INTER}</a:rPr>`;
const COVER_SUBTITLE_RUN_PR = `<a:rPr lang="en" sz="1800" u="sng">${FONT_INTER_MEDIUM}</a:rPr>`;

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTextShapes(slideXml: string): string[] {
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const textShapes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = shapeRegex.exec(slideXml)) !== null) {
    if (/<a:t[\s>]/.test(m[0])) textShapes.push(m[0]);
  }
  return textShapes;
}

function replaceTextShape(slideXml: string, shapeIndex: number, newShape: string): string {
  const shapes = getTextShapes(slideXml);
  if (shapeIndex >= shapes.length) return slideXml;
  return slideXml.replace(shapes[shapeIndex], newShape);
}

function buildRunPr(sz: number, opts?: { underline?: boolean; accent?: boolean }) {
  const underline = opts?.underline ? ' u="sng"' : "";
  const fill = opts?.accent ? FILL_ACCENT1 : FILL_BLACK;
  const font = opts?.underline ? FONT_INTER_MEDIUM : FONT_INTER;
  return `<a:rPr lang="en" sz="${sz}"${underline}>${fill}${font}</a:rPr>`;
}

function extractParagraphProperties(shapeXml: string): string {
  const fromPara = shapeXml.match(/<a:pPr[\s\S]*?<\/a:pPr>/)?.[0];
  if (fromPara) return fromPara;
  return '<a:pPr indent="0" lvl="0" marL="0" rtl="0" algn="l"/>';
}

/** Rebuild all paragraphs in a text shape — avoids losing rPr on placeholder paras */
export function rebuildShapeParagraphs(
  shapeXml: string,
  lines: string[],
  sz: number,
): string {
  const pPr = extractParagraphProperties(shapeXml);
  const rPr = buildRunPr(sz);
  const content = lines
    .map(
      (line) =>
        `<a:p>${pPr}<a:r>${rPr}<a:t>${escapeXml(line)}</a:t></a:r></a:p>`,
    )
    .join("");

  return shapeXml.replace(
    /(<a:lstStyle\/>|<a:lstStyle>[\s\S]*?<\/a:lstStyle>)([\s\S]*?)(<\/a:txBody>)/,
    `$1${content}$3`,
  );
}

function ensureRunsHaveVisibleText(shapeXml: string, sz: number): string {
  const rPr = buildRunPr(sz);

  let result = shapeXml.replace(/<a:r>\s*<a:t>/g, `<a:r>${rPr}<a:t>`);
  result = result.replace(/<a:rPr lang="en"\/>/g, rPr);
  result = result.replace(
    /<a:endParaRPr\/>/g,
    `<a:endParaRPr sz="${sz}">${FILL_BLACK}${FONT_INTER}</a:endParaRPr>`,
  );

  return result;
}

function setShapeOffset(
  shapeXml: string,
  y: number,
  opts?: { cy?: number },
): string {
  let next = shapeXml.replace(
    /(<a:off x="\d+" y=")\d+(")/,
    `$1${y}$2`,
  );
  if (opts?.cy !== undefined) {
    next = next.replace(
      /(<a:ext cx="\d+" cy=")\d+(")/,
      `$1${opts.cy}$2`,
    );
  }
  return next;
}

/** Reposition GIFs and text boxes so content does not overlap headers or GIFs */
export function fixSlideLayout(slideNum: number, slideXml: string): string {
  let xml = slideXml;

  if (slideNum === 2) {
    // Move GIF below intro block; keep contents list below GIF
    xml = xml.replace(
      /(<p:pic>[\s\S]*?<a:off x="\d+" y=")\d+(")/,
      `$1${3_100_000}$2`,
    );
    xml = xml.replace(
      /(<p:pic>[\s\S]*?<a:ext cx="\d+" cy=")\d+(")/,
      `$1${2_300_000}$2`,
    );

    const shapes = getTextShapes(xml);
    if (shapes[1]) {
      xml = replaceTextShape(
        xml,
        1,
        setShapeOffset(shapes[1], 1_650_000, { cy: 1_350_000 }),
      );
    }
    if (shapes[2]) {
      xml = replaceTextShape(
        xml,
        2,
        setShapeOffset(shapes[2], 5_650_000),
      );
    }
  }

  if (slideNum === 4) {
    // Keep subject below red header band; push main body below subject
    xml = xml.replace(
      /(<p:pic>[\s\S]*?<a:off x="\d+" y=")\d+(")/,
      `$1${6_700_000}$2`,
    );

    const shapes = getTextShapes(xml);
    if (shapes[0]) {
      xml = replaceTextShape(
        xml,
        0,
        setShapeOffset(shapes[0], 2_050_000, { cy: 1_450_000 }),
      );
    }
    if (shapes[4]) {
      xml = replaceTextShape(xml, 4, setShapeOffset(shapes[4], 1_050_000));
    }
  }

  if (slideNum === 7) {
    xml = xml.replace(
      /(<p:pic>[\s\S]*?<a:off x="\d+" y=")\d+(")/,
      `$1${5_450_000}$2`,
    );

    const shapes = getTextShapes(xml);
    if (shapes[1]) {
      xml = replaceTextShape(
        xml,
        1,
        setShapeOffset(shapes[1], 1_650_000, { cy: 1_450_000 }),
      );
    }
  }

  return xml;
}

/** Divider slides (3, 6): One-Pager and Chats titles */
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

function fixCoverSlide(slideXml: string): string {
  let xml = slideXml;
  const shapes = getTextShapes(xml);

  if (shapes[0]) {
    let shape = shapes[0];
    shape = shape.replace(/<a:r><a:rPr lang="en"\/>/, `<a:r>${COVER_TOPIC_RUN_PR}`);
    shape = shape.replace(/<a:endParaRPr\/>/, `<a:endParaRPr sz="2600"/>`);
    xml = replaceTextShape(xml, 0, shape);
  }

  if (shapes[1]) {
    let shape = shapes[1];
    shape = shape.replace(/<a:rPr lang="en" u="sng"\/>/g, COVER_SUBTITLE_RUN_PR);
    shape = shape.replace(/<a:endParaRPr u="sng"\/>/g, `<a:endParaRPr sz="1800" u="sng"/>`);
    xml = replaceTextShape(xml, 1, shape);
  }

  return xml;
}

function fixContentSlide(slideNum: number, slideXml: string): string {
  const sizeMap = SLIDE_SHAPE_SIZES[slideNum];
  if (!sizeMap) return slideXml;

  let xml = slideXml;
  const shapes = getTextShapes(xml);

  shapes.forEach((shape, idx) => {
    const sz = sizeMap[idx] ?? 1100;
    const patched = ensureRunsHaveVisibleText(shape, sz);
    xml = replaceTextShape(xml, idx, patched);
  });

  return xml;
}

/** Apply all template formatting fixes for pptx-viewer preview fidelity */
export function fixSlideFormatting(slideNum: number, slideXml: string): string {
  if (slideNum === 1) return fixCoverSlide(slideXml);
  if (slideNum === 3 || slideNum === 6) return fixDividerSlideTitleFormatting(slideXml);
  return fixContentSlide(slideNum, slideXml);
}
