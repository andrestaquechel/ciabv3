// @vitest-environment node
import { describe, it, expect } from "vitest";
import { rectsOverlap, verifySlideXml } from "@/lib/pptx/ciab-verify";

const W = 7772400;
const H = 10058400;

function textShape(y: number, cy: number, text: string, autofit?: number) {
  const af = autofit != null ? `<a:normAutofit fontScale="${autofit}"/>` : "";
  return (
    `<p:sp><p:spPr><a:xfrm><a:off x="600000" y="${y}"/><a:ext cx="6000000" cy="${cy}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr>${af}</a:bodyPr><a:p><a:r><a:rPr sz="1400"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
  );
}
function pic(y: number, cy: number) {
  return `<p:pic><p:spPr><a:xfrm><a:off x="600000" y="${y}"/><a:ext cx="2000000" cy="${cy}"/></a:xfrm></p:spPr></p:pic>`;
}

describe("rectsOverlap", () => {
  it("detects overlapping rectangles", () => {
    expect(rectsOverlap({ x: 0, y: 0, cx: 100, cy: 100 }, { x: 50, y: 50, cx: 100, cy: 100 }, 0)).toBe(true);
  });
  it("returns false for stacked, non-overlapping rectangles", () => {
    expect(rectsOverlap({ x: 0, y: 0, cx: 100, cy: 100 }, { x: 0, y: 200, cx: 100, cy: 100 }, 0)).toBe(false);
  });
});

describe("verifySlideXml", () => {
  it("passes a clean slide (short text, GIF safely below)", () => {
    const xml = `<p:spTree>${textShape(1400000, 900000, "Short copy")}${pic(2600000, 1900000)}</p:spTree>`;
    const v = verifySlideXml(2, xml, W, H);
    expect(v.filter((x) => x.severity === "error")).toHaveLength(0);
  });

  it("flags a GIF that overlaps the text box", () => {
    // GIF starts at 1.5M, inside the text box (1.4M..3.4M) → overlap.
    const xml = `<p:spTree>${textShape(1400000, 2000000, "Copy here")}${pic(1500000, 1900000)}</p:spTree>`;
    const v = verifySlideXml(3, xml, W, H);
    expect(v.some((x) => x.kind === "gif-overlaps-text")).toBe(true);
  });

  it("flags a GIF that overlaps text overflowing its small box", () => {
    // Small 0.3in box but ~long copy → estimated text extends well past the box;
    // a GIF placed just below the box still lands on the overflow text.
    const long = "word ".repeat(120);
    const xml = `<p:spTree>${textShape(1400000, 300000, long)}${pic(1800000, 1900000)}</p:spTree>`;
    const v = verifySlideXml(4, xml, W, H);
    expect(v.some((x) => x.kind === "gif-overlaps-text")).toBe(true);
  });

  it("flags a shape whose text runs past the slide bottom", () => {
    const long = "word ".repeat(400);
    const xml = `<p:spTree>${textShape(1400000, 8000000, long)}</p:spTree>`;
    const v = verifySlideXml(5, xml, W, H);
    expect(v.some((x) => x.kind === "off-slide")).toBe(true);
  });

  it("flags tiny autofit as a warning", () => {
    const xml = `<p:spTree>${textShape(1400000, 900000, "Copy", 55000)}</p:spTree>`;
    const v = verifySlideXml(6, xml, W, H);
    expect(v.some((x) => x.kind === "tiny-font")).toBe(true);
  });
});
