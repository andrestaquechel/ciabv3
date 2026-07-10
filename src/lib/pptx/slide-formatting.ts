/** Shadow AI Mini Box template — slide text formatting for pptx-viewer fidelity */

const FONT_INTER = `<a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/>`;
const FONT_INTER_MEDIUM = `<a:latin typeface="Inter Tight Medium"/><a:ea typeface="Inter Tight Medium"/><a:cs typeface="Inter Tight Medium"/><a:sym typeface="Inter Tight Medium"/>`;
const FILL_DK1 = `<a:solidFill><a:schemeClr val="dk1"/></a:solidFill>`;
const FILL_ACCENT1 = `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>`;

export const TEMPLATE_NAME = "Shadow AI Mini Box";
export const TEMPLATE_FILE = "mini-box-master.pptx";

/** cx/cy from presentation.xml (EMU) */
export const SLIDE_ASPECT = 7772400 / 10058400;

const DIVIDER_TITLE_LST_STYLE =
  '<a:lstStyle><a:lvl1pPr lvl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="5600"/><a:buFont typeface="Inter Tight"/><a:buNone/><a:defRPr sz="5600">' +
  FONT_INTER +
  '</a:defRPr></a:lvl1pPr></a:lstStyle>';

const DIVIDER_TITLE_RUN_PR = `<a:rPr lang="en" sz="5600">${FONT_INTER}</a:rPr>`;
const DIVIDER_END_PARA_RPR = `<a:endParaRPr sz="5600">${FONT_INTER}</a:endParaRPr>`;
const COVER_TOPIC_RUN_PR = `<a:rPr lang="en" sz="2600">${FILL_ACCENT1}${FONT_INTER}</a:rPr>`;
const COVER_SUBTITLE_RUN_PR = `<a:rPr lang="en" sz="1800" u="sng">${FONT_INTER_MEDIUM}</a:rPr>`;

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

function addSzToRuns(shapeXml: string, sz: number): string {
  let result = shapeXml;

  result = result.replace(/<a:rPr lang="en"\/>/g, () => {
    return `<a:rPr lang="en" sz="${sz}">${FILL_DK1}${FONT_INTER}</a:rPr>`;
  });

  result = result.replace(/<a:rPr lang="en" u="sng"\/>/g, () => {
    return `<a:rPr lang="en" sz="${sz}" u="sng">${FONT_INTER_MEDIUM}</a:rPr>`;
  });

  result = result.replace(/<a:rPr([^>]*?)>/g, (full, attrs) => {
    if (attrs.includes("sz=")) return full;
    return `<a:rPr${attrs} sz="${sz}">`;
  });

  result = result.replace(/<a:endParaRPr\/>/g, `<a:endParaRPr sz="${sz}"/>`);
  result = result.replace(/<a:endParaRPr([^/>]*)\/>/g, (full, attrs) => {
    if (attrs.includes("sz=")) return full;
    return `<a:endParaRPr${attrs} sz="${sz}"/>`;
  });

  return result;
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

/** Per-slide default font sizes (hundredths of a point) for text shapes */
const SLIDE_SHAPE_SIZES: Record<number, Record<number, number>> = {
  2: { 0: 1600, 1: 1100, 2: 1100 },
  4: { 0: 1100, 1: 1100, 3: 1600, 4: 1100 },
  5: { 0: 1100, 1: 1600 },
  7: { 0: 1600, 1: 1100 },
};

function fixContentSlide(slideNum: number, slideXml: string): string {
  const sizeMap = SLIDE_SHAPE_SIZES[slideNum];
  if (!sizeMap) return slideXml;

  let xml = slideXml;
  const shapes = getTextShapes(xml);

  for (const [idxStr, sz] of Object.entries(sizeMap)) {
    const idx = Number(idxStr);
    if (!shapes[idx]) continue;
    const patched = addSzToRuns(shapes[idx], sz);
    xml = replaceTextShape(xml, idx, patched);
  }

  return xml;
}

/** Apply all template formatting fixes for pptx-viewer preview fidelity */
export function fixSlideFormatting(slideNum: number, slideXml: string): string {
  if (slideNum === 1) return fixCoverSlide(slideXml);
  if (slideNum === 3 || slideNum === 6) return fixDividerSlideTitleFormatting(slideXml);
  return fixContentSlide(slideNum, slideXml);
}
