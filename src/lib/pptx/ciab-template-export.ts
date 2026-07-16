import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import type { CiabGeneratedContent, CiabGifs } from "@/lib/ciab";
import type { GifSelection } from "@/lib/mini-box";
import { replaceShapeText } from "@/lib/pptx/template-export";

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

function buildEdits(content: CiabGeneratedContent): Record<number, Edit[]> {
  const edits: Record<number, Edit[]> = {};
  const add = (slide: number, shape: number, text: string) => {
    (edits[slide] ||= []).push({ shape, text });
  };

  add(1, 0, content.topic);

  const [welcomeIntro, welcomeContents] = splitWelcome(content.welcome.body);
  add(2, 1, welcomeIntro);
  add(2, 2, welcomeContents);

  const blogSectionText = (i: number) => {
    const s = content.blog.sections[i];
    if (!s) return "";
    return joinLines([s.heading, "", s.body, "", yourMoveLine("Your Move:", s.yourMove)]);
  };
  add(3, 2, content.blog.title || content.topic); // blog sub-title (replaces leftover example heading)
  add(3, 1, content.blog.intro);
  add(3, 4, blogSectionText(0));
  add(4, 0, blogSectionText(1));
  add(4, 1, "");
  add(5, 1, blogSectionText(2));
  add(5, 3, "");
  add(6, 1, blogSectionText(3));
  add(
    7,
    1,
    joinLines([
      content.blog.conclusion.heading,
      "",
      content.blog.conclusion.body,
      "",
      yourMoveLine("Your Final Move:", content.blog.conclusion.yourFinalMove),
    ]),
  );

  for (const w of WEEK_SLIDES) {
    const email = content.emails.find((e) => e.week === w.week) || content.emails[w.week - 1];
    const chat = content.chats.find((c) => c.week === w.week) || content.chats[w.week - 1];
    if (email) {
      add(w.emailSlide, w.emailBody, joinLines([email.greeting, "", email.body]));
      add(w.emailSlide, w.emailSubject, email.subject ? `Subject: ${email.subject}` : "");
    }
    if (chat) add(w.chatSlide, w.chatBody, chat.message);
  }

  add(20, 1, joinLines([content.resources.intro, "", ...content.resources.items]));

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
const CAP_GAP = 91440; // 0.10in — GIF bottom → caption top
const GIF_TARGET_H = 1920240; // ~2.1in — preferred GIF height
const GIF_MIN_H = 480000; // ~0.53in — below this, skip the GIF
const GIF_MAX_W = 3520440; // ~3.85in
const GIF_TOP_LIMIT = 1280160; // keep clear of the red page header
const BOTTOM_MARGIN = 320040; // keep the caption clear of the slide bottom
const EMU_PER_PT = 12700;

type Geom = { x: number; y: number; cx: number; cy: number };

/** All text shapes on a slide that carry explicit geometry. */
function geomTextShapes(slideXml: string): Array<{ xml: string; box: Geom }> {
  const shapes = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
  const out: Array<{ xml: string; box: Geom }> = [];
  for (const s of shapes) {
    if (!/<a:t[\s>]/.test(s)) continue;
    const box = readOffExt(s);
    if (box) out.push({ xml: s, box });
  }
  return out;
}

/** Rough rendered height (EMU) of a shape's current text at its box width.
 *  Deliberately CONSERVATIVE (over-estimates) so the GIF is pushed safely below
 *  the copy and shrinks to fit rather than ever overlapping it. */
function estimateTextHeight(shapeXml: string, widthEMU: number): number {
  const szMatch = shapeXml.match(/sz="(\d+)"/);
  const pt = (szMatch ? Number(szMatch[1]) : 1100) / 100;
  const lineH = 1.38 * pt * EMU_PER_PT; // slightly generous line height
  const charW = 0.6 * pt * EMU_PER_PT; // slightly wide chars → err toward more lines
  const cpl = Math.max(8, Math.floor(widthEMU / charW));
  const paras = shapeXml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
  let lines = 0.4; // base padding
  for (const p of paras) {
    const t = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
    // Each paragraph is at least one line; blank paragraphs still take vertical space.
    lines += t === "" ? 0.85 : Math.max(1, Math.ceil([...t].length / cpl));
  }
  return Math.round(lines * lineH);
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
function computeGifPlacement(
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
  for (const s of geomTextShapes(slideXml)) {
    if (s.xml === captionXml) continue;
    const horizOverlap = !(s.box.x + s.box.cx < cap.x - 250000 || s.box.x > cap.x + cap.cx + 250000);
    if (!horizOverlap) continue;
    if (s.box.y < cap.y) {
      // Text above the caption's original position — anchor the GIF below it.
      aboveBottom = Math.max(aboveBottom, s.box.y + estimateTextHeight(s.xml, s.box.cx));
    } else {
      // Fixed content below — the GIF + caption must clear it.
      belowTop = Math.min(belowTop, s.box.y);
    }
  }

  const gifTop = aboveBottom + GIF_GAP;
  const band = belowTop - GIF_GAP - gifTop; // room for GIF + CAP_GAP + caption
  let cy = Math.min(GIF_TARGET_H, band - CAP_GAP - cap.cy);
  if (cy < GIF_MIN_H) return null;

  let cx = Math.round(cy / aspect);
  if (cx > GIF_MAX_W) {
    cx = GIF_MAX_W;
    cy = Math.round(cx * aspect);
  }
  const x = Math.round(capCenterX - cx / 2);
  const captionY = gifTop + cy + CAP_GAP;
  return { box: { x, y: gifTop, cx, cy }, captionY };
}

/** Move a caption shape to a new Y (preserving X). */
function setCaptionY(shapeXml: string, y: number): string {
  return shapeXml.replace(/<a:off x="(-?\d+)" y="-?\d+"\/>/, (_m, x) => `<a:off x="${x}" y="${y}"/>`);
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

    // Move the "Via Giphy" caption to sit just below the GIF.
    const movedCaption = setCaptionY(caption, captionY);
    if (movedCaption !== caption) slideXml = slideXml.replace(caption, () => movedCaption);

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
): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const edits = buildEdits(content);
  for (const [slideStr, slideEdits] of Object.entries(edits)) {
    const slideNum = Number(slideStr);
    const file = zip.file(`ppt/slides/slide${slideNum}.xml`);
    if (!file) continue;
    let xml = await file.async("string");
    for (const edit of [...slideEdits].sort((a, b) => b.shape - a.shape)) {
      xml = replaceShapeText(xml, edit.shape, edit.text, slideNum);
    }
    zip.file(`ppt/slides/slide${slideNum}.xml`, xml);
  }

  await injectGifs(zip, gifs);

  return zip.generateAsync({ type: "nodebuffer" });
}
