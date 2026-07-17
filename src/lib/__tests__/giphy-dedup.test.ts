// @vitest-environment node
import { describe, it, expect } from "vitest";
import { pickUnusedGif } from "@/lib/giphy-search";

const g = (id: string) => ({ id, url: `https://x/${id}.gif`, previewUrl: "", query: "" });

describe("pickUnusedGif", () => {
  it("returns the top candidate and marks it used", () => {
    const used = new Set<string>();
    const pick = pickUnusedGif([g("a"), g("b")], used);
    expect(pick!.id).toBe("a");
    expect(used.has("a")).toBe(true);
  });

  it("skips already-used candidates so slots get distinct GIFs", () => {
    const used = new Set<string>(["a"]);
    const pick = pickUnusedGif([g("a"), g("b"), g("c")], used);
    expect(pick!.id).toBe("b");
  });

  it("assigns unique GIFs across a sequence of slots", () => {
    const used = new Set<string>();
    const lists = [
      [g("a"), g("b"), g("c")],
      [g("a"), g("b"), g("c")],
      [g("a"), g("b"), g("c")],
    ];
    const picks = lists.map((l) => pickUnusedGif(l, used)!.id);
    expect(new Set(picks).size).toBe(3); // a, b, c — no repeats
  });

  it("falls back to the top candidate when everything is used", () => {
    const used = new Set<string>(["a", "b"]);
    const pick = pickUnusedGif([g("a"), g("b")], used);
    expect(pick!.id).toBe("a");
  });

  it("returns null for an empty candidate list", () => {
    expect(pickUnusedGif([], new Set())).toBeNull();
  });
});
