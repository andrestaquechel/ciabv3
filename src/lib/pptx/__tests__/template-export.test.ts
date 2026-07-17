// @vitest-environment node
import { describe, it, expect } from "vitest";
import { replaceShapeText } from "@/lib/pptx/template-export";

/** A template paragraph whose first run is self-closing (<a:rPr .../>) followed
 *  by a second, differently-styled paired run (<a:rPr>…</a:rPr>). This is the
 *  shape that broke firstRunProps and duplicated the slide-20 resources intro. */
const MULTI_RUN_SHAPE =
  `<p:sp><p:txBody><a:bodyPr/><a:lstStyle/>` +
  `<a:p><a:pPr/>` +
  `<a:r><a:rPr lang="en" sz="2000"/><a:t>Original black prefix </a:t></a:r>` +
  `<a:r><a:rPr lang="en" sz="2000"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr><a:t>red bit</a:t></a:r>` +
  `</a:p></p:txBody></p:sp>`;

describe("replaceShapeText — multi-run template paragraph (slide-20 regression)", () => {
  const out = replaceShapeText(`<p:spTree>${MULTI_RUN_SHAPE}</p:spTree>`, 0, "Fresh content", 20);
  const para = out.match(/<a:p>[\s\S]*?<\/a:p>/)![0];
  const runs = para.match(/<a:r>/g) || [];

  it("replaces the whole paragraph with a single run", () => {
    expect(runs.length).toBe(1);
  });

  it("does not leave the template's original run text behind", () => {
    expect(out).not.toContain("Original black prefix");
  });

  it("contains the new content exactly once", () => {
    expect(out.split("Fresh content").length - 1).toBe(1);
  });

  it("does not apply the template's accent color to the new run", () => {
    expect(para).not.toContain("accent1");
  });
});
