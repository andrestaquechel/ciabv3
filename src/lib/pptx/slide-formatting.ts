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
const COVER_SUBTITLE_RUN_PR = `<a:rPr lang="en" sz="1800" u="sng">${FONT_INTER_MEDIUM}</a:rPr>`;

/** Font size (hundredths of a pt) for the red-band page header. The template
 *  ships these titles at 16pt, which reads small against the band — the house
 *  style uses a larger header. The one-pager subject line (a lower title
 *  placeholder) keeps its own size. */
const CONTENT_HEADER_SZ = 2800;

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

/** Rendered height (EMU) of the cover topic title at its own size, so we know
 *  how far to push the table-of-contents down for a multi-line title. The 0.62
 *  char-width factor errs toward more lines (the large display font runs wider
 *  than body text) so we push a touch low rather than overlap. */
function coverTitleHeightEMU(text: string, widthEMU: number, sz: number): number {
  const len = [...(text || "")].length || 1;
  const pt = sz / 100;
  const cpl = Math.max(8, Math.floor(widthEMU / (0.62 * pt * 12700)));
  const lines = Math.max(1, Math.ceil(len / cpl));
  return Math.round(lines * 1.25 * pt * 12700);
}

function fixCoverSlide(slideXml: string): string {
  let xml = slideXml;
  const shapes = getTextShapes(xml);

  // The topic title keeps its template size; when it's long enough to wrap
  // toward the table-of-contents, we push the TOC down instead of shrinking it.
  let pushTocTo: number | null = null;
  if (shapes[0]) {
    const shape = shapes[0];
    const topic = [...shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("");
    const titleOff = shape.match(/<a:off x="-?\d+" y="(-?\d+)"\/>/);
    const titleExt = shape.match(/<a:ext cx="(\d+)" cy="\d+"\/>/);
    const szMatch = shape.match(/\bsz="(\d+)"/);
    const titleTop = titleOff ? Number(titleOff[1]) : 4724325;
    const width = titleExt ? Number(titleExt[1]) : 6149700;
    const sz = szMatch ? Number(szMatch[1]) : 2600;
    pushTocTo = titleTop + coverTitleHeightEMU(topic, width, sz) + 60000;
  }

  if (shapes[1]) {
    let shape = shapes[1];
    shape = shape.replace(/<a:rPr lang="en" u="sng"\/>/g, COVER_SUBTITLE_RUN_PR);
    shape = shape.replace(/<a:endParaRPr u="sng"\/>/g, `<a:endParaRPr sz="1800" u="sng"/>`);
    const tocOff = shape.match(/<a:off x="-?\d+" y="(-?\d+)"\/>/);
    const origTocTop = tocOff ? Number(tocOff[1]) : 0;
    if (pushTocTo != null && pushTocTo > origTocTop) {
      // Only the first <a:off> is the shape's xfrm position.
      shape = shape.replace(
        /<a:off x="(-?\d+)" y="-?\d+"\/>/,
        (_m, x) => `<a:off x="${x}" y="${pushTocTo}"/>`,
      );
    }
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
 * Color the content-slide title placeholders white and enlarge the page header.
 *
 * The header and subject on content slides are `title` placeholders sitting on
 * the red band. Their runs carry a `schemeClr dk1` fill, but because they are
 * title placeholders PowerPoint resolves them to the layout's light color and
 * renders them white. pptx-viewer does not replicate that placeholder color
 * resolution, so it renders them dark. Since these are static template labels,
 * we drop the placeholder designation (so pptx-viewer honors the run fill) and
 * force white on any `title` placeholder shape (header + subject), leaving the
 * dark body/callout text untouched.
 *
 * We also enlarge the page header (the topmost title placeholder) to the house
 * style size; the one-pager subject line is a lower title placeholder and keeps
 * its own smaller size.
 */
export function fixContentHeaderColor(slideXml: string): string {
  let xml = slideXml;
  for (const shape of getTextShapes(xml)) {
    if (!/<p:ph[^>]*type="title"/.test(shape)) continue;
    // The page header sits at the top of the slide; the one-pager subject line
    // is a second title placeholder lower down — enlarge only the header.
    const yMatch = shape.match(/<a:off x="-?\d+" y="(-?\d+)"\/>/);
    const isHeader = yMatch ? Number(yMatch[1]) < 500000 : false;
    let patched = shape
      .replace(/<p:ph[^>]*\/>/g, "")
      .replace(/<a:schemeClr val="dk1"\/>/g, `<a:srgbClr val="FFFFFF"/>`)
      .replace(/<a:rPr lang="en"\/>/g, `<a:rPr lang="en">${FILL_WHITE}</a:rPr>`)
      .replace(
        /<a:endParaRPr([^>]*)\/>/g,
        `<a:endParaRPr$1>${FILL_WHITE}</a:endParaRPr>`,
      );
    if (isHeader) {
      patched = patched
        .replace(/\bsz="\d+"/g, `sz="${CONTENT_HEADER_SZ}"`)
        .replace(/<a:rPr\b((?:(?!sz=)[^>])*?)(\/?)>/g, (m, attrs, slash) =>
          /\bsz=/.test(m) ? m : `<a:rPr${attrs} sz="${CONTENT_HEADER_SZ}"${slash}>`,
        );
    }
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
