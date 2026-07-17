import JSZip from "jszip";

/**
 * Fast, dependency-light geometry check for a built CIAB deck. It parses shape
 * boxes straight from the slide XML (no rendering) and flags the layout defects
 * we care about: shapes/GIFs off the slide, a GIF sitting on top of text, copy
 * that overflows its box, and text autofit-shrunk to an unreadable size.
 *
 * This is a NUMERIC pre-check for the feedback loop — a fast regression gate.
 * A full visual render (LibreOffice -> PNG) remains the ground truth.
 */

const EMU_PER_PT = 12700;
const TOL = 91440; // ~0.1in slack so borderline touches are not flagged

export type Rect = { x: number; y: number; cx: number; cy: number };
export type Violation = {
  slide: number;
  kind: "off-slide" | "gif-overlaps-text" | "text-overflow" | "tiny-font";
  severity: "error" | "warn";
  detail: string;
};
export type VerifyReport = {
  slideW: number;
  slideH: number;
  slideCount: number;
  violations: Violation[];
  ok: boolean;
};

/** True when two rectangles overlap by more than `tol` on both axes. */
export function rectsOverlap(a: Rect, b: Rect, tol = TOL): boolean {
  return (
    a.x < b.x + b.cx - tol &&
    a.x + a.cx > b.x + tol &&
    a.y < b.y + b.cy - tol &&
    a.y + a.cy > b.y + tol
  );
}

function readRect(shapeXml: string): Rect | null {
  const off = shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return { x: +off[1], y: +off[2], cx: +ext[1], cy: +ext[2] };
}

function autofitScale(shapeXml: string): number {
  const m = shapeXml.match(/<a:normAutofit[^>]*\bfontScale="(\d+)"/);
  return m ? Number(m[1]) / 100000 : 1;
}

/** Same conservative estimate the placement engine uses, so verify and layout
 *  agree on where copy ends. Scaled by any autofit fontScale on the shape. */
export function estimateTextHeightEMU(shapeXml: string, widthEMU: number): number {
  const szMatch = shapeXml.match(/sz="(\d+)"/);
  const pt = (szMatch ? Number(szMatch[1]) : 1100) / 100;
  const lineH = 1.46 * pt * EMU_PER_PT;
  const charW = 0.66 * pt * EMU_PER_PT;
  const cpl = Math.max(8, Math.floor(widthEMU / charW));
  const paras = shapeXml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
  let lines = 0.7;
  for (const p of paras) {
    const t = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => m[1])
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    lines += t === "" ? 1.3 : Math.max(1, Math.ceil([...t].length / cpl));
  }
  return Math.round(lines * lineH * autofitScale(shapeXml));
}

/** A shape whose only content is the "Via Giphy" caption — a fixed one-line
 *  template label, excluded from the content text checks. */
function isCaption(shapeXml: string): boolean {
  const text = [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("");
  return /vi(a|ew)\s*giphy/i.test(text);
}

function textShapes(slideXml: string): { xml: string; box: Rect }[] {
  const out: { xml: string; box: Rect }[] = [];
  for (const s of slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || []) {
    if (!/<a:t[\s>]/.test(s)) continue;
    if (isCaption(s)) continue;
    const box = readRect(s);
    if (box) out.push({ xml: s, box });
  }
  return out;
}

function picShapes(slideXml: string): Rect[] {
  const out: Rect[] = [];
  for (const p of slideXml.match(/<p:pic\b[\s\S]*?<\/p:pic>/g) || []) {
    const box = readRect(p);
    if (box) out.push(box);
  }
  return out;
}

export function verifySlideXml(
  slide: number,
  slideXml: string,
  slideW: number,
  slideH: number,
): Violation[] {
  const violations: Violation[] = [];
  const texts = textShapes(slideXml);
  const pics = picShapes(slideXml);

  const inches = (emu: number) => (emu / 914400).toFixed(2);

  for (const { xml, box } of texts) {
    const textBottom = box.y + Math.max(box.cy, estimateTextHeightEMU(xml, box.cx));
    const label = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => m[1])
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
    if (textBottom > slideH + TOL) {
      violations.push({
        slide,
        kind: "off-slide",
        severity: "error",
        detail: `text "${label}…" reaches ${inches(textBottom)}in > slide ${inches(slideH)}in`,
      });
    } else if (box.y + estimateTextHeightEMU(xml, box.cx) > box.y + box.cy + TOL) {
      violations.push({
        slide,
        kind: "text-overflow",
        severity: "warn",
        detail: `text "${label}…" (~${inches(estimateTextHeightEMU(xml, box.cx))}in) overflows its box (${inches(box.cy)}in)`,
      });
    }
    const scale = autofitScale(xml);
    if (scale < 0.65) {
      violations.push({
        slide,
        kind: "tiny-font",
        severity: "warn",
        detail: `text "${label}…" autofit to ${Math.round(scale * 100)}%`,
      });
    }
  }

  for (const pic of pics) {
    if (pic.y + pic.cy > slideH + TOL || pic.x + pic.cx > slideW + TOL) {
      violations.push({
        slide,
        kind: "off-slide",
        severity: "error",
        detail: `GIF bottom ${inches(pic.y + pic.cy)}in / right ${inches(pic.x + pic.cx)}in exceeds slide`,
      });
    }
    for (const { xml, box } of texts) {
      // The GIF may legitimately sit inside an oversized-but-mostly-empty box,
      // so overlap is measured against where the copy ACTUALLY ends (the
      // autofit-aware estimate), not the full box height.
      const textBox: Rect = {
        x: box.x,
        y: box.y,
        cx: box.cx,
        cy: estimateTextHeightEMU(xml, box.cx),
      };
      if (rectsOverlap(pic, textBox)) {
        const label = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
          .map((m) => m[1])
          .join("")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32);
        violations.push({
          slide,
          kind: "gif-overlaps-text",
          severity: "error",
          detail: `GIF overlaps text "${label}…"`,
        });
      }
    }
  }
  return violations;
}

export async function verifyCiabDeck(pptxBuffer: Buffer): Promise<VerifyReport> {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const pres = (await zip.file("ppt/presentation.xml")?.async("string")) || "";
  const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const slideW = sz ? +sz[1] : 7772400;
  const slideH = sz ? +sz[2] : 10058400;

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)![1]);
      const nb = Number(b.match(/slide(\d+)/)![1]);
      return na - nb;
    });

  const violations: Violation[] = [];
  for (const f of slideFiles) {
    const num = Number(f.match(/slide(\d+)/)![1]);
    const xml = (await zip.file(f)?.async("string")) || "";
    violations.push(...verifySlideXml(num, xml, slideW, slideH));
  }

  return {
    slideW,
    slideH,
    slideCount: slideFiles.length,
    violations,
    ok: !violations.some((v) => v.severity === "error"),
  };
}

/** Human-readable one-line-per-violation summary for the harness output. */
export function formatVerifyReport(report: VerifyReport): string {
  const errors = report.violations.filter((v) => v.severity === "error");
  const warns = report.violations.filter((v) => v.severity === "warn");
  const lines = [
    `verify: ${report.slideCount} slides · ${errors.length} error(s) · ${warns.length} warning(s) · ${report.ok ? "PASS" : "FAIL"}`,
  ];
  for (const v of report.violations) {
    lines.push(`  [${v.severity === "error" ? "ERR " : "warn"}] slide ${v.slide}: ${v.kind} — ${v.detail}`);
  }
  return lines.join("\n");
}
