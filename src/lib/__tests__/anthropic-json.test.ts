// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseJsonFromModelText, repairJsonText } from "@/lib/model-json";

describe("parseJsonFromModelText — clean input", () => {
  it("parses plain JSON", () => {
    expect(parseJsonFromModelText('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced ```json blocks", () => {
    expect(parseJsonFromModelText('```json\n{"a":1,"b":"two"}\n```')).toEqual({
      a: 1,
      b: "two",
    });
  });

  it("extracts JSON wrapped in prose/citations", () => {
    const text = "Here are the results:\n{\"a\":1}\nHope that helps!";
    expect(parseJsonFromModelText(text)).toEqual({ a: 1 });
  });
});

describe("parseJsonFromModelText — truncated / malformed (the concept-research bug)", () => {
  it("repairs an object cut off before its closing brace", () => {
    expect(parseJsonFromModelText('{"a":1,"b":2')).toEqual({ a: 1, b: 2 });
  });

  it("repairs truncation in the middle of a string value", () => {
    expect(parseJsonFromModelText('{"title":"The Doors We Forg')).toEqual({
      title: "The Doors We Forg",
    });
  });

  it("drops a dangling key whose value never arrived", () => {
    expect(parseJsonFromModelText('{"a":1,"b":')).toEqual({ a: 1 });
  });

  it("strips a trailing comma", () => {
    expect(parseJsonFromModelText('{"a":1,}')).toEqual({ a: 1 });
  });

  it("repairs a truncated array of objects, preserving complete elements", () => {
    const truncated =
      '{"concepts":[{"id":"1","title":"X"},{"id":"2","title":"Y"';
    expect(parseJsonFromModelText(truncated)).toEqual({
      concepts: [
        { id: "1", title: "X" },
        { id: "2", title: "Y" },
      ],
    });
  });

  it("repairs a truncated numeric array with a trailing comma", () => {
    expect(parseJsonFromModelText('{"items":[1,2,3,')).toEqual({
      items: [1, 2, 3],
    });
  });

  it("throws when there is no JSON to salvage", () => {
    expect(() => parseJsonFromModelText("not json at all")).toThrow();
  });
});

describe("repairJsonText", () => {
  it("leaves already-valid JSON parseable", () => {
    const s = '{"a":[1,2],"b":{"c":3}}';
    expect(JSON.parse(repairJsonText(s))).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it("does not mangle braces that appear inside strings", () => {
    const s = '{"note":"use { and } carefully"}';
    expect(JSON.parse(repairJsonText(s))).toEqual({
      note: "use { and } carefully",
    });
  });

  it("balances nested truncation", () => {
    const s = '{"a":{"b":{"c":1';
    expect(JSON.parse(repairJsonText(s))).toEqual({ a: { b: { c: 1 } } });
  });
});
