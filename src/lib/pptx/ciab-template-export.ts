import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import type { CiabGeneratedContent, CiabGifs } from "@/lib/ciab";
import type { CiabSource } from "@/lib/ciab-prompts";
import type { GifSelection } from "@/lib/mini-box";
import { applyHyperlinkRels, replaceShapeText } from "@/lib/pptx/template-export";

/**
 * CIAB "Main Box" branded deck export.
 *
 * Fills the branded 20-slide master (`templates/ciab-master.pptx`, derived from
 * CiaB_06.26 with GIFs stripped) with generated content — preserving the
 * template's embedded InterTight fonts, colors, and layout via the same
 * paragraph-styling-preserving replacement the Mini Box uses — and injects a GIF
 * above each "Via Giphy" caption.
 *
 * Slide map (text-shape order, confirmed from the master):
 *   1  cover        [0]=title
 *   2  welcome      [1]=Hello+framing  [2]="In this box…"+signoff  caption:"Via Giphy"
 *   3-7 blog        body shapes vary per slide (see buildEdits)
 *   8/11/14/17 dividers (static)
 *   9  wk1 email    [0]=body  [3]=Subject          10 wk1 chat  [1]
 *   12 wk2 email    [1]=body  [3]=Subject          13 wk2 chat  [1]
 *   15 wk3 email    [0]=body  [2]=Subject          16 wk3 chat  [1]
 *   18 wk4 email    [2]=body  [3]=Subject          19 wk4 chat  [1]
 *   20 resources    [1]=modules
 */

export const CIAB_TEMPLATE_FILE = "ciab-master.pptx";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", CIAB_TEMPLATE_FILE);

type Edit = { shape: number; text: string };

const WEEK_SLIDES = [
  { week: 1, emailSlide: 9, emailBody: 0, emailSubject: 3, chatSlide: 10, chatBody: 1 },
  { week: 2, emailSlide: 12, emailBody: 1, emailSubject: 3, chatSlide: 13, chatBody: 1 },
  { week: 3, emailSlide: 15, emailBody: 0, emailSubject: 2, chatSlide: 16, chatBody: 1 },
  { week: 4, emailSlide: 18, emailBody: 2, emailSubject: 3, chatSlide: 19, chatBody: 1 },
] as const;

function yourMoveLine(prefix: string, text: string): string {
  const cleaned = (text || "").replace(/^🎯\s*Your (Final )?Move:\s*/i, "").trim();
  return cleaned ? `🎯 ${prefix} ${cleaned}` : "";
}

function joinLines(lines: (string | undefined)[]): string {
  return lines.filter((l) => l !== undefined).join("\n").trim();
}

/** The template auto-bullets list paragraphs, so a leading bullet glyph in the
 *  generated copy renders as a DOUBLE bullet ("•  • A blog post…"). Strip a
 *  leading bullet marker from each line. */
export function stripLeadingBullets(text: string): string {
  return (text || "")
    .split("\n")
    .map((line) => line.replace(/^\s*[•‣●▪·]\s*/, ""))
    .join("\n");
}

/** The generated email body sometimes already opens with the greeting; the slide
 *  also prepends `email.greeting`, which rendered "Hi, Everyone!Hi, Everyone!".
 *  Strip a leading duplicate greeting from the body so it appears exactly once. */
export function stripLeadingGreeting(greeting: string, body: string): string {
  const g = (greeting || "").trim();
  const b = (body || "").replace(/^\s+/, "");
  if (!g) return b.trim();
  if (b.toLowerCase().startsWith(g.toLowerCase())) {
    return b.slice(g.length).replace(/^\s+/, "");
  }
  return b;
}

/**
 * Split the welcome note the way the template lays it out: the greeting +
 * framing go in the top shape (above the GIF), and the "In this month's box you
 * will find…" list + sign-off go in the lower shape (below the caption). This
 * keeps the top shape short so the welcome GIF has room.
 */
function splitWelcome(body: string): [string, string] {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => /in this[\s\S]*box[\s\S]*(you|find)|you will find/i.test(l));
  if (idx <= 0) return [body, ""];
  return [lines.slice(0, idx).join("\n").trim(), lines.slice(idx).join("\n").trim()];
}

/** Wrap the first (case-insensitive) occurrence of `phrase` in **bold** markdown,
 *  which replaceShapeText renders as a bold run. Used to bold the campaign/article
 *  title where it is mentioned in the welcome note. */
function boldFirst(text: string, phrase: string): string {
  const p = (phrase || "").trim();
  if (!p) return text;
  const i = text.toLowerCase().indexOf(p.toLowerCase());
  if (i < 0) return text;
  return `${text.slice(0, i)}**${text.slice(i, i + p.length)}**${text.slice(i + p.length)}`;
}

/** Match-strings for a source, longest first — the copy cites sources by their
 *  name OR publisher (often a publisher prefix, e.g. "Singapore Police Force"),
 *  so we try all of them and link the longest that appears. */
function sourceMatchStrings(s: CiabSource): string[] {
  const out = new Set<string>();
  const add = (v?: string) => {
    const t = (v || "").trim();
    if (t.length >= 6) out.add(t);
  };
  add(s.name);
  add(s.publisher);
  add((s.publisher || "").split(/[,/&(]/)[0]); // publisher before a delimiter
  return [...out].sort((a, b) => b.length - a.length);
}

/** Turn the first mention of each cited source (by name or publisher) into a real
 *  [text](url) markdown link — rendered as a clickable hyperlink — using the
 *  vetted source URLs, so sources referenced in the copy are clickable. */
function linkifySources(text: string, sources: CiabSource[]): string {
  let out = text;
  const usedUrls = new Set<string>();
  for (const s of sources || []) {
    const url = s?.url?.trim();
    if (!url || usedUrls.has(url)) continue;
    for (const cand of sourceMatchStrings(s)) {
      const i = out.toLowerCase().indexOf(cand.toLowerCase());
      if (i < 0) continue;
      // Skip if this span is already inside a markdown link.
      if (/\[[^\]]*$/.test(out.slice(0, i))) continue;
      out = `${out.slice(0, i)}[${out.slice(i, i + cand.length)}](${url})${out.slice(i + cand.length)}`;
      usedUrls.add(url);
      break;
    }
  }
  return out;
}

/** Pin a shape (matched by its exact text — the blog subtitle) to no-autofit so
 *  Google Slides renders it at its real size instead of shrinking a longer title
 *  to an unreadable few points. */
function pinShapeNoAutofit(slideXml: string, exactText: string): string {
  const key = (exactText || "").trim();
  if (!key) return slideXml;
  return slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (sp) => {
    const t = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").trim();
    return t === key ? setNoAutofit(sp) : sp;
  });
}

function buildEdits(
  content: CiabGeneratedContent,
  sources: CiabSource[] = [],
): Record<number, Edit[]> {
  const link = (t: string) => linkifySources(t, sources);
  const edits: Record<number, Edit[]> = {};
  const add = (slide: number, shape: number, text: string) => {
    (edits[slide] ||= []).push({ shape, text });
  };

  add(1, 0, content.topic);

  const [welcomeIntro, welcomeContents] = splitWelcome(content.welcome.body);
  // Bold the campaign/article title where the welcome note names it.
  add(2, 1, boldFirst(welcomeIntro, content.topic));
  add(2, 2, stripLeadingBullets(welcomeContents));

  const blogSectionText = (i: number) => {
    const s = content.blog.sections[i];
    if (!s) return "";
    return link(joinLines([s.heading, "", s.body, "", yourMoveLine("Your Move:", s.yourMove)]));
  };
  add(3, 2, content.blog.title || content.topic); // blog sub-title (replaces leftover example heading)
  add(3, 1, link(content.blog.intro));
  add(3, 4, blogSectionText(0));
  add(4, 0, blogSectionText(1));
  add(4, 1, "");
  add(5, 1, blogSectionText(2));
  add(5, 3, "");
  add(6, 1, blogSectionText(3));
  add(
    7,
    1,
    link(
      joinLines([
        content.blog.conclusion.heading,
        "",
        content.blog.conclusion.body,
        "",
        yourMoveLine("Your Final Move:", content.blog.conclusion.yourFinalMove),
      ]),
    ),
  );

  for (const w of WEEK_SLIDES) {
    const email = content.emails.find((e) => e.week === w.week) || content.emails[w.week - 1];
    const chat = content.chats.find((c) => c.week === w.week) || content.chats[w.week - 1];
    if (email) {
      const emailBody = stripLeadingGreeting(email.greeting, email.body);
      add(w.emailSlide, w.emailBody, link(joinLines([email.greeting, "", emailBody])));
      add(w.emailSlide, w.emailSubject, email.subject ? `Subject: ${email.subject}` : "");
    }
    if (chat) add(w.chatSlide, w.chatBody, link(chat.message));
  }

  add(20, 1, stripLeadingBullets(joinLines([content.resources.intro, "", ...content.resources.items])));

  return edits;
}

/* ------------------------------------------------------------------ */
/* GIF injection                                                       */
/* ------------------------------------------------------------------ */

/** slide → GIF for that slide's "Via Giphy" caption. */
function gifSlideMap(gifs?: Partial<CiabGifs>): Record<number, GifSelection> {
  if (!gifs) return {};
  const map: Record<number, GifSelection> = {};
  if (gifs.welcome) map[2] = gifs.welcome;
  const blog = gifs.blog || [];
  [3, 4, 5, 6, 7].forEach((slide, i) => {
    if (blog[i]) map[slide] = blog[i];
  });
  const emails = gifs.emails || [];
  [9, 12, 15, 18].forEach((slide, i) => {
    if (emails[i]) map[slide] = emails[i];
  });
  const chats = gifs.chats || [];
  [10, 13, 16, 19].forEach((slide, i) => {
    if (chats[i]) map[slide] = chats[i];
  });
  return map;
}

async function fetchGif(gif: GifSelection): Promise<Buffer | null> {
  const url = gif?.url || gif?.previewUrl;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

/** Read width/height from a GIF header (bytes 6-9, little-endian). */
function gifDimensions(buf: Buffer): { w: number; h: number } {
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { w: buf.readUInt16LE(6) || 480, h: buf.readUInt16LE(8) || 270 };
  }
  return { w: 480, h: 270 };
}

function readOffExt(shapeXml: string) {
  const off = shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return { x: +off[1], y: +off[2], cx: +ext[1], cy: +ext[2] };
}

/** Concatenated text of a shape (runs may split a word across <a:t> tags). */
function shapePlainText(shapeXml: string): string {
  return [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("");
}

/** Find the "Via Giphy" / "View Giphy" caption shape on a slide. Matches on the
 *  shape's concatenated run text so a caption split across runs still resolves. */
function findCaptionShape(slideXml: string): string | null {
  const shapes = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
  return shapes.find((s) => /vi(a|ew)\s*giphy/i.test(shapePlainText(s))) || null;
}

const SLIDE_H = 10058400;
const GIF_GAP = 137160; // 0.15in — uniform gap: text → GIF and GIF → caption
// Extra clearance below the estimated text bottom before the GIF starts. The
// text-height estimate runs ~1 line short of the real render on multi-line copy;
// this margin absorbs that so the GIF never grazes the last line. Kept in the
// placement (not the estimate) so overflow/caption detection stays accurate.
const GIF_SAFETY_GAP = 411480; // ~0.45in
const CAP_GAP = 91440; // 0.10in — GIF bottom → caption top
const GIF_SECTION_GAP = 164592; // ~0.18in — moved caption → content snapped up below it
// "Via Giphy" caption: a small, fixed box centered under the GIF, 10pt Arial.
const CAP_W = 1097280; // ~1.2in
const CAP_H = 365760; // ~0.4in
const CAP_FONT_SZ = "1000"; // 10pt
const GIF_TARGET_H = 1920240; // ~2.1in — preferred GIF height
export const GIF_FLOOR_H = 914400; // ~1.0in — never render a GIF smaller than this
// Lower floor used only when content sits BELOW the caption (slide 3's blog
// section): that copy is kept at REGULAR size (never autofit-shrunk), so the GIF
// yields more room — down to this smaller floor — to keep the font uniform.
export const GIF_FLOOR_BELOW = 548640; // ~0.6in
const GIF_MAX_W = 3520440; // ~3.85in
const GIF_TOP_LIMIT = 1280160; // keep clear of the red page header
const BOTTOM_MARGIN = 320040; // keep the caption clear of the slide bottom
const EMU_PER_PT = 12700;
// Bottom band kept clear of body copy (on GIF-slot slides) so the GIF + caption
// always have room: GIF target + gaps + a caption line.
const GIF_BAND_RESERVE = GIF_TARGET_H + GIF_GAP + CAP_GAP + 457200; // ~2.75in
const MIN_AUTOFIT_SCALE = 0.55; // never shrink body text below 55%
const VERIFY_TOL = 91440; // ~0.1in — must match ciab-verify's overflow tolerance (TOL)

/** Autofit scale for text estimated at `estHeight` in a box of `boxCy`. Returns
 *  null when it already fits (no shrink needed). Pure — unit-tested. */
export function computeAutofit(
  estHeight: number,
  boxCy: number,
): { fontScale: number; lnSpcReduction: number } | null {
  if (boxCy <= 0 || estHeight <= boxCy) return null;
  const scale = Math.max(MIN_AUTOFIT_SCALE, boxCy / estHeight);
  return {
    fontScale: Math.round(scale * 100000),
    lnSpcReduction: scale < 0.9 ? 20000 : 10000,
  };
}

type Geom = { x: number; y: number; cx: number; cy: number };

/** All NON-EMPTY text shapes on a slide that carry explicit geometry. Empty
 *  placeholders (an <a:t> tag but no copy — the template leaves some, e.g. below
 *  the week-4 email caption) are skipped: they must not constrain GIF placement
 *  or count as content below the caption, which shrank that email's GIF tiny. */
function geomTextShapes(slideXml: string): Array<{ xml: string; box: Geom }> {
  const shapes = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
  const out: Array<{ xml: string; box: Geom }> = [];
  for (const s of shapes) {
    if (!/<a:t[\s>]/.test(s)) continue;
    const text = [...s.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").trim();
    if (!text) continue;
    const box = readOffExt(s);
    if (box) out.push({ xml: s, box });
  }
  return out;
}

/** Rough rendered height (EMU) of a shape's current text at its box width.
 *  Deliberately CONSERVATIVE (over-estimates) so the GIF is pushed safely below
 *  the copy and shrinks to fit rather than ever overlapping it. */
function autofitScale(shapeXml: string): number {
  const m = shapeXml.match(/<a:normAutofit[^>]*\bfontScale="(\d+)"/);
  return m ? Number(m[1]) / 100000 : 1;
}

function estimateTextHeight(shapeXml: string, widthEMU: number): number {
  const szMatch = shapeXml.match(/sz="(\d+)"/);
  const pt = (szMatch ? Number(szMatch[1]) : 1100) / 100;
  // Deliberately CONSERVATIVE (over-estimates height): a wide char width yields
  // more wrapped lines and a generous line height, so the GIF is anchored safely
  // BELOW the copy rather than ever landing on top of it. Under-estimating here
  // is what caused GIFs to overlap text, so we err the other way. Scaled by any
  // autofit fontScale already applied to the shape so the estimate tracks the
  // shrunk text, keeping this in agreement with ciab-verify.
  const lineH = 1.46 * pt * EMU_PER_PT;
  const charW = 0.66 * pt * EMU_PER_PT;
  const cpl = Math.max(8, Math.floor(widthEMU / charW));
  const paras = shapeXml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
  let lines = 0.7; // base padding
  // The template puts a real `spcBef` (space-before, in points) on every body
  // paragraph — ~12pt each. That inter-paragraph spacing is a large fraction of a
  // multi-paragraph section's height (5 paras ≈ 0.8in) and used to be MISSING from
  // this estimate, so the GIF anchored ~this much too high and landed on the last
  // "Your Move" line. Model it explicitly (per-paragraph) instead of faking it
  // with an inflated blank-line factor, so the estimate tracks the real render.
  let spcBefEmu = 0;
  for (const p of paras) {
    const t = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
    // Each paragraph is at least one line; a blank paragraph is one empty line
    // (its inter-paragraph gap is now carried by the modeled spcBef below).
    lines += t === "" ? 1.0 : Math.max(1, Math.ceil([...t].length / cpl));
    const bef = p.match(/<a:spcBef>\s*<a:spcPts val="(\d+)"\/>/);
    if (bef) spcBefEmu += (Number(bef[1]) / 100) * EMU_PER_PT;
  }
  return Math.round((lines * lineH + spcBefEmu) * autofitScale(shapeXml));
}

/** Ensure a shape's text stays inside its box: if the estimated copy height
 *  exceeds the (possibly grown) box, add an `<a:normAutofit>` with a concrete
 *  fontScale so PowerPoint AND Google Slides shrink it rather than letting it
 *  spill off the slide. */
function applyAutofit(shapeXml: string, box: Geom): string {
  const af = computeAutofit(estimateTextHeight(shapeXml, box.cx), box.cy);
  if (!af) return shapeXml;
  const node = `<a:normAutofit fontScale="${af.fontScale}" lnSpcReduction="${af.lnSpcReduction}"/>`;
  if (/<a:(no|norm|sp)Autofit\b[^>]*\/>/.test(shapeXml)) {
    return shapeXml.replace(/<a:(no|norm|sp)Autofit\b[^>]*\/>/, node);
  }
  if (/<a:bodyPr\b[^>]*\/>/.test(shapeXml)) {
    return shapeXml.replace(/<a:bodyPr\b([^>]*)\/>/, `<a:bodyPr$1>${node}</a:bodyPr>`);
  }
  if (/<a:bodyPr\b[^>]*>/.test(shapeXml)) {
    return shapeXml.replace(/(<a:bodyPr\b[^>]*>)/, `$1${node}`);
  }
  return shapeXml;
}

/** Force a shape to NOT autofit — its text renders at its regular size and may
 *  overflow rather than shrink. Used for slide 3's blog section, which must keep
 *  the same font size as the rest of the deck. */
function setNoAutofit(shapeXml: string): string {
  const node = "<a:noAutofit/>";
  if (/<a:(no|norm|sp)Autofit\b[^>]*\/>/.test(shapeXml)) {
    return shapeXml.replace(/<a:(no|norm|sp)Autofit\b[^>]*\/>/, node);
  }
  if (/<a:bodyPr\b[^>]*\/>/.test(shapeXml)) {
    return shapeXml.replace(/<a:bodyPr\b([^>]*)\/>/, `<a:bodyPr$1>${node}</a:bodyPr>`);
  }
  if (/<a:bodyPr\b[^>]*>/.test(shapeXml)) {
    return shapeXml.replace(/(<a:bodyPr\b[^>]*>)/, `$1${node}`);
  }
  return shapeXml;
}

/** Set a shape's box height (cy), never shrinking below its current value. */
function growBoxTo(shapeXml: string, minCy: number): string {
  return shapeXml.replace(
    /(<a:ext cx="\d+" cy=")(\d+)(")/,
    (full, pre, cy, post) => (Number(cy) >= minCy ? full : `${pre}${minCy}${post}`),
  );
}

/**
 * Keep every content body on its slide: grow an overflowing body box downward
 * into the free space above the next element (reserving the GIF band on GIF-slot
 * slides), then autofit-shrink whatever still does not fit. Index-agnostic — it
 * targets exactly the shapes whose copy overruns their box, so short template
 * labels are never touched.
 */
function fitContentShapes(slideXml: string): string {
  let xml = slideXml;
  const caption = findCaptionShape(xml);
  const capBox = caption ? readOffExt(caption) : null;
  const shapes = geomTextShapes(xml);

  for (const { xml: shapeXml, box } of shapes) {
    if (caption && shapeXml === caption) continue;
    const est = estimateTextHeight(shapeXml, box.cx);
    if (est <= box.cy) continue; // fits already — leave the template alone

    // Nearest horizontally-overlapping shape below this one bounds the growth.
    // The caption IS counted here: its original position marks where the GIF
    // band begins, so a box above it must never grow down through it (that was
    // the slide-3 collision where the intro grew into the section below).
    let belowTop = SLIDE_H - BOTTOM_MARGIN;
    for (const other of shapes) {
      if (other.xml === shapeXml) continue;
      const horiz = !(other.box.x + other.box.cx < box.x || other.box.x > box.x + box.cx);
      if (horiz && other.box.y > box.y) belowTop = Math.min(belowTop, other.box.y);
    }
    // Reserve the GIF band ONLY under shapes above the caption (the GIF sits
    // below them). A shape BELOW the caption — e.g. the bottom blog section on
    // slide 3 — has no GIF beneath it, so it may grow to the slide bottom
    // instead of being pinned tiny.
    const aboveCaption = capBox ? box.y < capBox.y : false;
    const reserve = aboveCaption ? GIF_BAND_RESERVE : 0;
    const maxBottom = Math.min(belowTop - GIF_GAP, SLIDE_H - BOTTOM_MARGIN - reserve);
    const targetCy = Math.max(box.cy, maxBottom - box.y);

    let patched = growBoxTo(shapeXml, targetCy);
    patched = applyAutofit(patched, { ...box, cy: Math.max(box.cy, targetCy) });
    if (patched !== shapeXml) xml = xml.replace(shapeXml, () => patched);
  }
  return xml;
}

/**
 * Systematic GIF placement, anchored to the copy:
 *   text bottom → [GIF_GAP] → GIF → [CAP_GAP] → "Via Giphy" caption
 * The GIF always sits a uniform gap below where the copy ends, and the caption
 * always sits a uniform gap below the GIF — so the spacing is identical no matter
 * how much text a slide carries. The caption is moved to follow the GIF. Any
 * fixed content that lives BELOW (welcome list, next blog section) constrains
 * the band, shrinking the GIF; if the band is too small, the GIF is skipped.
 * Returns the GIF box and the new caption Y (or null to skip).
 */
export function computeGifPlacement(
  slideXml: string,
  captionXml: string,
  cap: Geom,
  gifW: number,
  gifH: number,
): { box: Geom; captionY: number } | null {
  const aspect = gifH / gifW || 0.5625;
  const capCenterX = cap.x + cap.cx / 2;

  let aboveBottom = GIF_TOP_LIMIT;
  let belowTop = SLIDE_H - BOTTOM_MARGIN;
  let belowNeed = 0; // height the below-caption content needs at full size
  for (const s of geomTextShapes(slideXml)) {
    if (s.xml === captionXml) continue;
    const horizOverlap = !(s.box.x + s.box.cx < cap.x - 250000 || s.box.x > cap.x + cap.cx + 250000);
    if (!horizOverlap) continue;
    if (s.box.y < cap.y) {
      // Text above the caption's original position — anchor the GIF just below
      // where the copy ACTUALLY ends (autofit-aware estimate), not the box
      // bottom. Using the box bottom let the GIF land on copy that overflowed a
      // short box; anchoring to the real text extent clears it.
      const textBottom = s.box.y + estimateTextHeight(s.xml, s.box.cx);
      aboveBottom = Math.max(aboveBottom, textBottom);
    } else {
      // Content below — the GIF + caption must clear it. This content is snapped
      // up to just under the moved caption (see injectGifs), so track how much
      // height it needs so the GIF can yield room to it below.
      belowTop = Math.min(belowTop, s.box.y);
      // Measure the FULL-SIZE need: fitContentShapes may have already autofit this
      // section down to fit its short template box, which would scale the estimate
      // down and hide how much room it actually wants. Strip that autofit first so
      // the GIF yields enough room for the section to render at readable size.
      const rawBelow = s.xml.replace(/<a:normAutofit[^>]*\/>/, "<a:normAutofit/>");
      belowNeed = Math.max(belowNeed, estimateTextHeight(rawBelow, s.box.cx));
    }
  }

  const gifTop = aboveBottom + GIF_GAP + GIF_SAFETY_GAP;
  const band = belowTop - GIF_GAP - gifTop; // room for GIF + CAP_GAP + caption
  // Never skip the GIF: prefer the target height, shrink toward the band, but
  // never below the 1in floor even if it means using a little of the bottom
  // margin. A GIF is always placed.
  let cy = Math.min(GIF_TARGET_H, band - CAP_GAP - cap.cy);
  // When content sits below the caption it snaps up to just under the moved
  // caption, so the GIF must leave it enough room to render at a readable size.
  // A long section (slide 3's first blog section) otherwise kept the GIF at full
  // size and was autofit-shrunk tiny. Cap the GIF by what the section needs,
  // never below the floor — a readable section beats a big GIF on a crowded slide.
  if (belowNeed > 0) {
    const cyForBelow =
      SLIDE_H - BOTTOM_MARGIN - gifTop - CAP_GAP - cap.cy - GIF_SECTION_GAP - belowNeed;
    cy = Math.min(cy, cyForBelow);
  }
  // Below-caption copy is kept at regular size, so let the GIF drop to the lower
  // floor to make room; elsewhere hold the normal 1in floor.
  const floor = belowNeed > 0 ? GIF_FLOOR_BELOW : GIF_FLOOR_H;
  if (cy < floor) cy = floor;

  let cx = Math.round(cy / aspect);
  if (cx > GIF_MAX_W) {
    cx = GIF_MAX_W;
    cy = Math.round(cx * aspect);
  }
  const x = Math.round(capCenterX - cx / 2);
  const captionY = gifTop + cy + CAP_GAP;
  return { box: { x, y: gifTop, cx, cy }, captionY };
}

/**
 * Style the "Via Giphy" caption: a small fixed box centered under the GIF, with
 * its text locked to 10pt Arial. Keeps the caption compact and consistent across
 * all 14 GIF slots (the template shipped a wide box with a mixed 10/18pt font).
 */
function styleCaption(shapeXml: string, gifCenterX: number, y: number): string {
  const x = Math.round(gifCenterX - CAP_W / 2);
  let s = shapeXml;
  // Box: small, fixed size, centered under the GIF.
  s = s.replace(/<a:off x="-?\d+" y="-?\d+"\/>/, `<a:off x="${x}" y="${y}"/>`);
  s = s.replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${CAP_W}" cy="${CAP_H}"/>`);
  // Lock every run (and the trailing endParaRPr) to 10pt so the line height is
  // tight and uniform — the template left an 18pt endParaRPr that inflated it.
  s = s.replace(/(<a:(?:rPr|endParaRPr)\b[^>]*?)\bsz="\d+"/g, `$1sz="${CAP_FONT_SZ}"`);
  // Force the Arial typeface on each run that doesn't already declare one.
  s = s.replace(/<a:rPr\b((?:(?!<\/a:rPr>)[\s\S])*?)<\/a:rPr>/g, (m, inner) => {
    if (/<a:latin\b/.test(inner)) return m;
    const arial = '<a:latin typeface="Arial"/><a:cs typeface="Arial"/>';
    return /<a:hlinkClick/.test(inner)
      ? `<a:rPr${inner.replace(/<a:hlinkClick/, `${arial}<a:hlinkClick`)}</a:rPr>`
      : `<a:rPr${inner}${arial}</a:rPr>`;
  });
  return s;
}

/**
 * Remove the redundant per-paragraph `spcBef` from a body shape that already
 * separates its paragraphs with blank lines. The template double-spaced these
 * (a blank paragraph AND ~12pt space-before), which spread copy out and starved
 * the GIF of room; blank lines alone give clean, tighter spacing.
 */
export function deDoubleSpace(shapeXml: string): string {
  const paras = shapeXml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
  const hasBlank = paras.some(
    (p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").trim() === "",
  );
  if (!hasBlank) return shapeXml; // single-block copy keeps its spacing
  return shapeXml.replace(/<a:spcBef>\s*<a:spcPts val="\d+"\/>\s*<\/a:spcBef>/g, '<a:spcBef><a:spcPts val="0"/></a:spcBef>');
}

function buildPicXml(id: number, relId: string, name: string, box: { x: number; y: number; cx: number; cy: number }): string {
  return (
    `<p:pic>` +
    `<p:nvPicPr>` +
    `<p:cNvPr id="${id}" name="${name}"/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>` +
    `<p:nvPr/>` +
    `</p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>` +
    `<a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</p:spPr>` +
    `</p:pic>`
  );
}

function nextRelId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => +m[1]);
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

function ensureGifContentType(zip: JSZip, ctXml: string): string {
  if (/Extension="gif"/i.test(ctXml)) return ctXml;
  return ctXml.replace(
    /<\/Types>/,
    `<Default Extension="gif" ContentType="image/gif"/></Types>`,
  );
}

/**
 * Inject the mapped GIFs above their captions. Mutates the zip (media + rels +
 * content types) and returns nothing; slide XML edits are applied in place.
 */
async function injectGifs(zip: JSZip, gifs: Partial<CiabGifs> | undefined): Promise<void> {
  const map = gifSlideMap(gifs);
  const slides = Object.keys(map).map(Number);
  if (!slides.length) return;

  let ctXml = (await zip.file("[Content_Types].xml")?.async("string")) || "";
  ctXml = ensureGifContentType(zip, ctXml);
  if (ctXml) zip.file("[Content_Types].xml", ctXml);

  for (const slide of slides) {
    const gif = map[slide];
    const buf = await fetchGif(gif);
    if (!buf) continue;

    const slideFile = zip.file(`ppt/slides/slide${slide}.xml`);
    const relsFile = zip.file(`ppt/slides/_rels/slide${slide}.xml.rels`);
    if (!slideFile || !relsFile) continue;

    let slideXml = await slideFile.async("string");
    let relsXml = await relsFile.async("string");

    const caption = findCaptionShape(slideXml);
    const capBox = caption ? readOffExt(caption) : null;
    if (!caption || !capBox) continue;

    // Geometry first: anchor the GIF a uniform gap below the copy and move the
    // caption below the GIF. If there is no clear space, skip rather than cover.
    const { w, h } = gifDimensions(buf);
    const placement = computeGifPlacement(slideXml, caption, capBox, w, h);
    if (!placement) continue;
    const { box, captionY } = placement;

    // Restyle the "Via Giphy" caption: 10pt Arial in a small box centered under
    // the GIF, sitting just below it.
    const movedCaption = styleCaption(caption, box.x + box.cx / 2, captionY);
    if (movedCaption !== caption) slideXml = slideXml.replace(caption, () => movedCaption);

    // Reclaim the gap a rising caption leaves ABOVE content that sits below it.
    // When the copy above the GIF is short, the caption rises to meet the GIF —
    // but any content shape below the caption (the welcome list on slide 2, the
    // blog section on slide 3) kept its low template Y, stranding dead space above
    // it AND getting autofit-shrunk tiny in its short box. Snap such a shape up to
    // just under the moved caption and regrow/re-autofit it into the taller berth.
    const newCapBottom = captionY + capBox.cy;
    for (const { xml: secXml, box: secBox } of geomTextShapes(slideXml)) {
      if (secXml === movedCaption) continue;
      if (secBox.y <= capBox.y) continue; // only shapes originally below the caption
      const horizBand = !(
        secBox.x + secBox.cx < capBox.x - 250000 || secBox.x > capBox.x + capBox.cx + 250000
      );
      if (!horizBand) continue;
      const newTop = newCapBottom + GIF_SECTION_GAP;
      if (newTop >= secBox.y) continue; // never push content DOWN, only reclaim gap
      const newCy = Math.max(secBox.cy, SLIDE_H - BOTTOM_MARGIN - newTop);
      let moved = secXml.replace(
        /<a:off x="(-?\d+)" y="-?\d+"\/>/,
        (_m, x) => `<a:off x="${x}" y="${newTop}"/>`,
      );
      moved = growBoxTo(moved, newCy);
      // Keep this copy at its REGULAR size — never autofit-shrink it — so slide 3's
      // blog section matches the font size of the intro and the rest of the deck.
      // The GIF above was already sized (computeGifPlacement) to leave it full-size
      // room, and the box grows to the bottom margin, so full-size copy fits. Only
      // if the copy is so long it would still run off the slide do we fall back to
      // autofit, purely to prevent it spilling off the bottom.
      const fullSize = setNoAutofit(moved);
      const est = estimateTextHeight(fullSize, secBox.cx);
      // Keep full size while the copy fits the grown box within the verifier's
      // overflow tolerance (VERIFY_TOL) — so placement and verify never disagree.
      if (newTop + est <= SLIDE_H - BOTTOM_MARGIN + VERIFY_TOL) {
        moved = fullSize;
      } else {
        moved = moved.replace(/<a:normAutofit[^>]*\/>/, "<a:normAutofit/>");
        moved = applyAutofit(moved, { ...secBox, y: newTop, cy: newCy });
      }
      slideXml = slideXml.replace(secXml, () => moved);
    }

    // Media + relationship
    const mediaName = `ciab-gif-slide${slide}.gif`;
    zip.file(`ppt/media/${mediaName}`, buf);
    const relId = nextRelId(relsXml);
    relsXml = relsXml.replace(
      /<\/Relationships>/,
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/></Relationships>`,
    );

    // Point the "Via Giphy" caption hyperlink at this GIF (best-effort).
    const gifUrl = gif?.url || gif?.previewUrl;
    const hl = caption?.match(/<a:hlinkClick[^>]*r:id="(rId\d+)"/);
    if (gifUrl && hl) {
      relsXml = relsXml.replace(
        new RegExp(`(<Relationship Id="${hl[1]}"[^>]*Target=")[^"]*(")`),
        (_m, pre, post) => `${pre}${gifUrl.replace(/&/g, "&amp;")}${post}`,
      );
    }

    const pic = buildPicXml(9000 + slide, relId, `CIAB GIF ${slide}`, box);
    slideXml = slideXml.replace(/<\/p:spTree>/, `${pic}</p:spTree>`);

    zip.file(`ppt/slides/slide${slide}.xml`, slideXml);
    zip.file(`ppt/slides/_rels/slide${slide}.xml.rels`, relsXml);
  }
}

/* ------------------------------------------------------------------ */

export async function buildCiabDeckFromTemplate(
  content: CiabGeneratedContent,
  gifs?: Partial<CiabGifs>,
  sources: CiabSource[] = [],
): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const edits = buildEdits(content, sources);
  const blogSubtitle = content.blog.title || content.topic;
  for (const [slideStr, slideEdits] of Object.entries(edits)) {
    const slideNum = Number(slideStr);
    const file = zip.file(`ppt/slides/slide${slideNum}.xml`);
    if (!file) continue;
    let xml = await file.async("string");
    // Collect hyperlink urls from [name](url) markdown across this slide's edits.
    const linkSink: { url: string }[] = [];
    for (const edit of [...slideEdits].sort((a, b) => b.shape - a.shape)) {
      xml = replaceShapeText(xml, edit.shape, edit.text, slideNum, linkSink);
    }
    // Drop the template's redundant double-spacing (blank line + 12pt-before) on
    // multi-paragraph body copy — tighter, cleaner, and frees room for the GIF.
    xml = xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (sp) => deDoubleSpace(sp));
    // Keep long copy on the slide: grow + autofit any overflowing body box.
    xml = fitContentShapes(xml);
    // The blog subtitle must render at its real size, not be shrunk by Slides.
    if (slideNum === 3) xml = pinShapeNoAutofit(xml, blogSubtitle);
    // Turn [name](url) placeholders into real slide hyperlink relationships.
    if (linkSink.length) xml = await applyHyperlinkRels(zip, slideNum, xml, linkSink);
    zip.file(`ppt/slides/slide${slideNum}.xml`, xml);
  }

  await injectGifs(zip, gifs);

  return zip.generateAsync({ type: "nodebuffer" });
}
