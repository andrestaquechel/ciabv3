// @vitest-environment node
import { describe, it, expect } from "vitest";
import { pickUnusedGif, pickVariedUnusedGif } from "@/lib/giphy-search";

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

describe("pickVariedUnusedGif", () => {
  const list = () =>
    Array.from({ length: 20 }, (_, i) => g(String.fromCharCode(97 + i))); // a..t

  it("spreads picks across the top window by seed (cross-deck variety)", () => {
    // Same ranked list + different seeds must not all resolve to the same GIF.
    const ids = [0, 3, 7, 11].map((seed) => pickVariedUnusedGif(list(), new Set(), seed)!.id);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("keeps picks unique within a deck via the shared used set", () => {
    const used = new Set<string>();
    const ranked = list();
    const picks = [0, 1, 2, 3, 4].map((slot) => pickVariedUnusedGif(ranked, used, slot * 13)!.id);
    expect(new Set(picks).size).toBe(5);
  });

  it("respects ids already used by earlier slots", () => {
    const used = new Set<string>(["a", "b", "c"]);
    const pick = pickVariedUnusedGif([g("a"), g("b"), g("c"), g("d")], used, 0);
    expect(pick!.id).toBe("d");
  });

  it("falls back to the top candidate when everything is used", () => {
    const used = new Set<string>(["a", "b"]);
    expect(pickVariedUnusedGif([g("a"), g("b")], used, 5)!.id).toBe("a");
  });

  it("returns null for an empty candidate list", () => {
    expect(pickVariedUnusedGif([], new Set(), 3)).toBeNull();
  });
});
