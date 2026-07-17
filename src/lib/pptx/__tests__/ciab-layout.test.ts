// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  stripLeadingGreeting,
  stripLeadingBullets,
  computeAutofit,
  computeGifPlacement,
  GIF_FLOOR_H,
  GIF_FLOOR_BELOW,
  deDoubleSpace,
} from "@/lib/pptx/ciab-template-export";

describe("stripLeadingBullets", () => {
  it("removes a leading bullet glyph from each line", () => {
    expect(stripLeadingBullets("• A blog post\n• Weekly emails")).toBe(
      "A blog post\nWeekly emails",
    );
  });
  it("leaves lines without a bullet untouched", () => {
    expect(stripLeadingBullets("In this box:\nA blog post")).toBe(
      "In this box:\nA blog post",
    );
  });
  it("does not strip a hyphen used as punctuation", () => {
    expect(stripLeadingBullets("end-to-end guidance")).toBe("end-to-end guidance");
  });
});

const SLIDE_H = 10058400;
const GIF_TARGET_H = 1920240;

describe("stripLeadingGreeting", () => {
  it("removes a greeting the body duplicates", () => {
    expect(stripLeadingGreeting("Hi, Everyone!", "Hi, Everyone! Let's talk.")).toBe(
      "Let's talk.",
    );
  });

  it("is case-insensitive on the greeting", () => {
    expect(stripLeadingGreeting("Hello Everyone,", "hello everyone, welcome")).toBe(
      "welcome",
    );
  });

  it("leaves a body that does not start with the greeting", () => {
    expect(stripLeadingGreeting("Hi, Team!", "Security matters.")).toBe(
      "Security matters.",
    );
  });

  it("handles an empty greeting", () => {
    expect(stripLeadingGreeting("", "  Body text  ")).toBe("Body text");
  });
});

describe("computeAutofit", () => {
  it("returns null when the text already fits", () => {
    expect(computeAutofit(1000, 2000)).toBeNull();
  });

  it("shrinks proportionally when text overflows", () => {
    const af = computeAutofit(2500, 2000);
    expect(af).not.toBeNull();
    expect(af!.fontScale).toBe(80000); // 2000/2500 = 0.8
    expect(af!.lnSpcReduction).toBe(20000);
  });

  it("never shrinks below the 55% floor", () => {
    const af = computeAutofit(100000, 1000); // ratio 0.01
    expect(af!.fontScale).toBe(55000);
  });

  it("uses a lighter line-spacing reduction for mild overflow", () => {
    const af = computeAutofit(2100, 2000); // ratio ~0.95
    expect(af!.lnSpcReduction).toBe(10000);
  });
});

function slide(bodyY: number, bodyCy: number, bodyText: string, extraBelow = "") {
  const body =
    `<p:sp><p:spPr><a:xfrm><a:off x="600000" y="${bodyY}"/>` +
    `<a:ext cx="6000000" cy="${bodyCy}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1400"/><a:t>${bodyText}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const caption =
    `<p:sp><p:spPr><a:xfrm><a:off x="600000" y="1500000"/>` +
    `<a:ext cx="6000000" cy="200000"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:p><a:r><a:t>Via Giphy</a:t></a:r></a:p></p:txBody></p:sp>`;
  return `<p:spTree>${body}${caption}${extraBelow}</p:spTree>`;
}

const CAPTION_XML =
  `<p:sp><p:spPr><a:xfrm><a:off x="600000" y="1500000"/>` +
  `<a:ext cx="6000000" cy="200000"/></a:xfrm></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:p><a:r><a:t>Via Giphy</a:t></a:r></a:p></p:txBody></p:sp>`;
const CAP = { x: 600000, y: 1500000, cx: 6000000, cy: 200000 };

describe("deDoubleSpace", () => {
  const para = (text: string, spcBef = 1200) =>
    `<a:p><a:pPr><a:spcBef><a:spcPts val="${spcBef}"/></a:spcBef></a:pPr>` +
    (text ? `<a:r><a:t>${text}</a:t></a:r>` : "") +
    `</a:p>`;
  const shape = (paras: string) => `<p:sp><p:txBody><a:bodyPr/>${paras}</p:txBody></p:sp>`;

  it("zeroes spcBef when the shape separates paragraphs with a blank line", () => {
    const out = deDoubleSpace(shape(para("Heading") + para("") + para("Body")));
    expect(out).not.toMatch(/val="1200"/);
    expect((out.match(/<a:spcPts val="0"\/>/g) || []).length).toBe(3);
  });

  it("leaves single-block copy (no blank paragraph) untouched", () => {
    const single = shape(para("Line one") + para("Line two"));
    expect(deDoubleSpace(single)).toBe(single);
  });
});

describe("computeGifPlacement", () => {
  it("always returns a placement (never skips the GIF)", () => {
    const xml = slide(1300000, 200000, "Short body");
    const p = computeGifPlacement(xml, CAPTION_XML, CAP, 480, 270);
    expect(p).not.toBeNull();
  });

  it("uses the target height when there is room", () => {
    const xml = slide(1300000, 200000, "Short body");
    const p = computeGifPlacement(xml, CAPTION_XML, CAP, 480, 270)!;
    expect(p.box.cy).toBe(GIF_TARGET_H);
  });

  it("floors (never skips) at the lower below-caption floor when content sits below", () => {
    // A fixed shape immediately below the caption squeezes the band negative.
    // Below-caption copy is kept full-size, so the GIF yields to the lower floor.
    const below =
      `<p:sp><p:spPr><a:xfrm><a:off x="600000" y="1900000"/>` +
      `<a:ext cx="6000000" cy="200000"/></a:xfrm></p:spPr>` +
      `<p:txBody><a:bodyPr/><a:p><a:r><a:t>Fixed footer</a:t></a:r></a:p></p:txBody></p:sp>`;
    const xml = slide(1300000, 200000, "Short body", below);
    const p = computeGifPlacement(xml, CAPTION_XML, CAP, 480, 270)!;
    expect(p.box.cy).toBe(GIF_FLOOR_BELOW);
  });

  it("holds the 1in floor when nothing sits below the caption", () => {
    // Long copy above the caption pushes the GIF anchor down so the band is tiny,
    // but with NO content below the caption the GIF holds the normal 1in floor.
    const longBody = "word ".repeat(300);
    const xml = slide(1300000, 200000, longBody);
    const p = computeGifPlacement(xml, CAPTION_XML, CAP, 480, 270)!;
    expect(p.box.cy).toBe(GIF_FLOOR_H);
  });

  it("keeps the GIF within the slide bottom in the roomy case", () => {
    const xml = slide(1300000, 200000, "Short body");
    const p = computeGifPlacement(xml, CAPTION_XML, CAP, 480, 270)!;
    expect(p.box.y + p.box.cy).toBeLessThanOrEqual(SLIDE_H);
  });
});
