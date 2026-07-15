/** Shadow AI Mini Box template — slide formatting helpers for pptx-viewer fidelity.
 *
 * Philosophy: the template is the source of truth. We do NOT reposition shapes or
 * override the template's own run sizes/colors on content slides — doing so is what
 * caused white text, wrong sizes, and header/GIF overlap. We only patch the two
 * placeholder-title slide families (cover + dividers) whose empty run properties
 * pptx-viewer cannot resolve on its own.
 */

const FONT_INTER = `<a:latin typeface="Inter Tight"/><a:ea typeface="Inter Tight"/><a:cs typeface="Inter Tight"/><a:sym typeface="Inter Tight"/>`;
const FONT_INTER_MEDIUM = `<a:latin typeface="Inter Tight Medium"/><a:ea typeface="Inter Tight Medium"/><a:cs typeface="Inter Tight Medium"/><a:sym typeface="Inter Tight Medium"/>`;
const FILL_BLACK = `<a:solidFill><a:srgbClr val="000000"/></a:solidFill>`;
const FILL_WHITE = `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`;
const FILL_ACCENT1 = `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>`;

export const TEMPLATE_NAME = "Shadow AI Mini Box";
export const TEMPLATE_FILE = "mini-box-master.pptx";

/** cx/cy from presentation.xml (EMU) — portrait US-Letter one-pager */
export const SLIDE_ASPECT = 7772400 / 10058400;

const DIVIDER_TITLE_LST_STYLE =
  '<a:lstStyle><a:lvl1pPr lvl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="5600"/><a:buFont typeface="Inter Tight"/><a:buNone/><a:defRPr sz="5600">' +
  FONT_INTER +
  '</a:defRPr></a:lvl1pPr></a:lstStyle>';

const DIVIDER_TITLE_RUN_PR = `<a:rPr lang="en" sz="5600">${FILL_BLACK}${FONT_INTER}</a:rPr>`;
const DIVIDER_END_PARA_RPR = `<a:endParaRPr sz="5600">${FILL_BLACK}${FONT_INTER}</a:endParaRPr>`;
const COVER_TOPIC_RUN_PR = `<a:rPr lang="en" sz="2600">${FILL_ACCENT1}${FONT_INTER}</a:rPr>`;
const COVER_SUBTITLE_RUN_PR = `<a:rPr lang="en" sz="1800" u="sng">${FONT_INTER_MEDIUM}</a:rPr>`;

export function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getTextShapes(slideXml: string): string[] {
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const textShapes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = shapeRegex.exec(slideXml)) !== null) {
    if (/<a:t[\s>]/.test(m[0])) textShapes.push(m[0]);
  }
  return textShapes;
}

export function replaceTextShape(
  slideXml: string,
  shapeIndex: number,
  newShape: string,
): string {
  const shapes = getTextShapes(slideXml);
  if (shapeIndex >= shapes.length) return slideXml;
  return slideXml.replace(shapes[shapeIndex], newShape);
}

/** Divider slides (3, 6): One-Pager and Chats titles */
function fixDividerSlideTitleFormatting(slideXml: string): string {
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

export { fixDividerSlideTitleFormatting };

/**
 * Apply template formatting fixes. Only the placeholder-title slides (cover=1,
 * dividers=3/6) need help; content slides (2/4/5/7) are left exactly as the
 * template defines them so the preview matches the source deck.
 */
export function fixSlideFormatting(slideNum: number, slideXml: string): string {
  if (slideNum === 1) return fixCoverSlide(slideXml);
  if (slideNum === 3 || slideNum === 6) return fixDividerSlideTitleFormatting(slideXml);
  return slideXml;
}

/**
 * Minimum body-box heights (EMU) that keep long paragraphs fully visible.
 *
 * The template's body boxes are top-anchored with `noAutofit`, so in PowerPoint
 * long text simply overflows and stays visible. `pptx-viewer` instead clips text
 * to the box height, hiding paragraphs. Growing these (invisible, fill-less)
 * boxes downward has no effect in PowerPoint but lets the preview show the full
 * text. Values stay clear of the GIF / next element below each box.
 */
const CONTENT_BOX_MIN_CY: Record<number, Record<number, number>> = {
  4: { 0: 4_600_000 }, // greeting + body pt1 (GIF starts at y≈6_540_750)
  5: { 0: 6_000_000 }, // body pt2 + signature (nothing below on the slide)
  7: { 1: 3_300_000 }, // chat message (GIF starts at y≈5_261_075)
};

/**
 * Color the content-slide title placeholders white.
 *
 * The header and subject on content slides are `title` placeholders sitting on
 * the red band. Their runs carry a `schemeClr dk1` fill, but because they are
 * title placeholders PowerPoint resolves them to the layout's light color and
 * renders them white. pptx-viewer does not replicate that placeholder color
 * resolution, so it renders them dark. Since these are static template labels,
 * we drop the placeholder designation (so pptx-viewer honors the run fill) and
 * force white on any `title` placeholder shape (header + subject), leaving the
 * dark body/callout text untouched. Position/size stay intact because these
 * shapes carry explicit off/ext and run sizes.
 */
export function fixContentHeaderColor(slideXml: string): string {
  let xml = slideXml;
  for (const shape of getTextShapes(xml)) {
    if (!/<p:ph[^>]*type="title"/.test(shape)) continue;
    const patched = shape
      .replace(/<p:ph[^>]*\/>/g, "")
      .replace(/<a:schemeClr val="dk1"\/>/g, `<a:srgbClr val="FFFFFF"/>`)
      .replace(/<a:rPr lang="en"\/>/g, `<a:rPr lang="en">${FILL_WHITE}</a:rPr>`)
      .replace(
        /<a:endParaRPr([^>]*)\/>/g,
        `<a:endParaRPr$1>${FILL_WHITE}</a:endParaRPr>`,
      );
    if (patched !== shape) xml = xml.replace(shape, patched);
  }
  return xml;
}

/** Grow overflow-prone content boxes so pptx-viewer renders their full text. */
export function fixContentBoxOverflow(slideNum: number, slideXml: string): string {
  const map = CONTENT_BOX_MIN_CY[slideNum];
  if (!map) return slideXml;

  let xml = slideXml;
  for (const [idxStr, minCy] of Object.entries(map)) {
    const idx = Number(idxStr);
    const shape = getTextShapes(xml)[idx];
    if (!shape) continue;
    const patched = shape.replace(
      /(<a:ext cx="\d+" cy=")(\d+)(")/,
      (full, pre, cy, post) => (Number(cy) >= minCy ? full : `${pre}${minCy}${post}`),
    );
    if (patched !== shape) xml = xml.replace(shape, patched);
  }
  return xml;
}
