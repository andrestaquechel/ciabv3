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

/** Template cover geometry (EMU). Portrait US-Letter; slide height 10058400. */
const COVER_SLIDE_H_EMU = 10058400;
const COVER_TITLE_TOC_GAP = 200000; // breathing room between title and TOC
const COVER_BOTTOM_MARGIN = 320000; // keep the TOC clear of the slide bottom
const COVER_TITLE_DEFAULT_SZ = 2600; // house cover-title size (26pt)

/** Rough wrapped height (EMU) of the cover title at a given point size. The 0.64
 *  char-width factor errs toward more lines (the large display font runs wider
 *  than body text) so we clear rather than overlap the TOC. */
function coverTitleHeightEMU(text: string, sz: number, widthEMU: number): number {
  const len = [...(text || "")].length || 1;
  const pt = sz / 100;
  const cpl = Math.max(8, Math.floor(widthEMU / (0.64 * pt * 12700)));
  const lines = Math.max(1, Math.ceil(len / cpl));
  return Math.round(lines * 1.25 * pt * 12700);
}

/** Smallest safety size (of a descending set) whose wrapped title still fits the
 *  space above the TOC's lowest allowed position — used only as a last resort for
 *  pathologically long titles once the TOC has already been pushed all the way
 *  down. Normal/concise titles keep their original size. */
function fitCoverTopicSz(text: string, widthEMU: number, availEMU: number): number {
  for (const sz of [2600, 2400, 2200, 2000, 1800, 1600, 1400]) {
    if (coverTitleHeightEMU(text, sz, widthEMU) <= availEMU) return sz;
  }
  return 1400;
}

function coverTopicRunPr(sz: number): string {
  return `<a:rPr lang="en" sz="${sz}">${FILL_ACCENT1}${FONT_INTER}</a:rPr>`;
}

function shapeOffY(el: string): number | null {
  const m = el.match(/<a:off x="-?\d+" y="(-?\d+)"\/>/);
  return m ? Number(m[1]) : null;
}
function setShapeOffY(el: string, y: number): string {
  return el.replace(/<a:off x="(-?\d+)" y="-?\d+"\/>/, (_m, x) => `<a:off x="${x}" y="${y}"/>`);
}

/**
 * Cover slide: keep the topic title at its original (large) size and, when a
 * longer title needs the room, push the table-of-contents ("Welcome Message for
 * Program Owners", "One-Pager", "Chat") DOWN to clear it instead of shrinking
 * the title. Short/concise titles leave the TOC at its template position. Only a
 * title so long it can't fit even with the TOC pushed to the slide bottom falls
 * back to shrinking.
 */
function fixCoverSlide(slideXml: string): string {
  let xml = slideXml;
  const shapes = getTextShapes(xml);
  if (!shapes[0]) return xml;

  const titleShape = shapes[0];
  const topic = [...titleShape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((m) => m[1])
    .join("");
  const titleTop = shapeOffY(titleShape) ?? 4724325;
  const titleExt = titleShape.match(/<a:ext cx="(\d+)" cy="\d+"\/>/);
  const width = titleExt ? Number(titleExt[1]) : 6149700;

  // The title keeps whatever size the template run carries (26pt); we do not
  // shrink to fit anymore.
  const existingSz = titleShape.match(/\bsz="(\d+)"/);
  let titleSz = existingSz ? Number(existingSz[1]) : COVER_TITLE_DEFAULT_SZ;

  const tocShape = shapes[1];
  const tocTemplateTop = tocShape ? shapeOffY(tocShape) ?? 5625250 : 5625250;
  const tocExt = tocShape?.match(/<a:ext cx="\d+" cy="(\d+)"\/>/);
  const tocCy = tocExt ? Number(tocExt[1]) : 1119900;
  const tocMaxTop = COVER_SLIDE_H_EMU - COVER_BOTTOM_MARGIN - tocCy;

  // Where does the full-size title actually end?
  let titleBottom = titleTop + coverTitleHeightEMU(topic, titleSz, width);
  let newTocTop = Math.max(tocTemplateTop, titleBottom + COVER_TITLE_TOC_GAP);

  // Last resort: if even pushing the TOC to the bottom can't clear the title,
  // shrink the title just enough to fit above the TOC's lowest position.
  if (newTocTop > tocMaxTop) {
    const avail = Math.max(400000, tocMaxTop - titleTop - COVER_TITLE_TOC_GAP);
    titleSz = fitCoverTopicSz(topic, width, avail);
    titleBottom = titleTop + coverTitleHeightEMU(topic, titleSz, width);
    newTocTop = Math.min(
      tocMaxTop,
      Math.max(tocTemplateTop, titleBottom + COVER_TITLE_TOC_GAP),
    );
  }

  // Apply title size (only rewrites the run if we actually changed it or the
  // template run lacked an explicit size / accent styling).
  let newTitleShape = titleShape;
  if (/\bsz="\d+"/.test(titleShape)) {
    if (titleSz !== (existingSz ? Number(existingSz[1]) : titleSz)) {
      newTitleShape = titleShape.replace(/\bsz="\d+"/g, `sz="${titleSz}"`);
    }
  } else {
    newTitleShape = titleShape
      .replace(/<a:r><a:rPr lang="en"\/>/, `<a:r>${coverTopicRunPr(titleSz)}`)
      .replace(/<a:endParaRPr\/>/, `<a:endParaRPr sz="${titleSz}"/>`);
  }
  if (newTitleShape !== titleShape) {
    xml = replaceTextShape(xml, 0, newTitleShape);
  }

  if (tocShape) {
    let shape = tocShape;
    shape = shape.replace(/<a:rPr lang="en" u="sng"\/>/g, COVER_SUBTITLE_RUN_PR);
    shape = shape.replace(/<a:endParaRPr u="sng"\/>/g, `<a:endParaRPr sz="1800" u="sng"/>`);
    if (newTocTop !== tocTemplateTop) shape = setShapeOffY(shape, newTocTop);
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
