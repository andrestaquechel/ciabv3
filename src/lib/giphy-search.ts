import type { GifSelection } from "@/lib/mini-box";

/**
 * Fallback Giphy REST API key, used only when GIPHY_API_KEY is not set in the
 * environment (the env var always takes precedence). This is a standard Giphy
 * "API" key passed as the `api_key` query param to the REST endpoint — not the
 * JS SDK. Prefer setting GIPHY_API_KEY in the deployment env; this constant is
 * a convenience so GIF search still works without it.
 */
const GIPHY_FALLBACK_API_KEY = "4GXP73mOSrZ6KwUiqunCSwWwjPEDyUMx";

const MOCK_GIFS: NonNullable<GifSelection>[] = [
  {
    id: "mock-welcome",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif",
    title: "Security awareness",
    query: "security welcome",
  },
  {
    id: "mock-onepager",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif",
    title: "Thinking",
    query: "cybersecurity",
  },
  {
    id: "mock-chat",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/200.gif",
    title: "Reaction",
    query: "reaction chat",
  },
];

type GiphyGif = {
  id: string;
  title: string;
  images: { fixed_height: { url: string }; original: { url: string } };
};

/** Function words that add no GIF-search signal. */
const STOPWORDS = new Set([
  "your", "that", "with", "from", "have", "this", "they", "them", "then",
  "than", "into", "about", "just", "like", "some", "more", "most", "over",
  "under", "before", "after", "been", "being", "only", "also", "very",
  "cant", "dont", "what", "when", "where", "which", "their", "will",
  "would", "could", "should", "make", "makes", "made", "take", "need",
  "needs", "using", "used", "here", "there", "were", "was", "how", "why",
  "who", "new", "get", "got", "are", "and", "for", "you", "our", "out",
]);

/** Title substrings that disqualify a GIF for a workplace security deck:
 *  sexual/nudity, and political/hot-button subjects. Matched case-insensitively
 *  on the GIF title (Giphy's "g" rating already screens the worst, this is a
 *  belt-and-suspenders pass on the human-readable title). */
const GIF_BLOCKLIST = [
  // sexual / nudity / suggestive
  "sex", "sexy", "nude", "naked", "boob", "twerk", "strip", "lingerie", "thong",
  "bikini", "orgasm", "porn", "nsfw", "seduce", "kiss", "makeout", "grind",
  "butt", "booty", "thicc", "onlyfans", "hooters",
  // political / hot-button
  "trump", "biden", "obama", "kamala", "harris", "putin", "election", "maga",
  "democrat", "republican", "gop", "liberal", "conservative", "protest",
  "abortion", "gun ", "shooting", "nazi", "hitler", "israel", "palestine",
  "gaza", "ukraine war", "religion", "jesus", "allah", "church", "mosque",
];

function isWorkplaceSafe(title?: string): boolean {
  const t = (title || "").toLowerCase();
  return !GIF_BLOCKLIST.some((bad) => t.includes(bad));
}

/** Distinctive subject words from a GIF title (e.g. a name like "messi"), used to
 *  avoid picking two GIFs of the SAME subject in one deck even when their ids
 *  differ (two different Messi GIFs). */
function titleSubjectWords(title?: string): string[] {
  return (title || "")
    .toLowerCase()
    .replace(/gif|giphy|by\b|via\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Broad, distinct reaction terms used to re-search for a fresh GIF when a slot's
 *  content-derived pool is already fully used elsewhere in the deck — rotated by
 *  slot so the fallback pulls different GIFs rather than repeating one. */
const GIF_FALLBACK_TERMS = [
  "reaction", "surprised", "thinking face", "facepalm", "warning", "computer",
  "office reaction", "shocked", "nervous", "typing", "phone alert", "hacker",
  "celebrate", "confused",
];

/** Pull a few salient keywords from free text to shape a GIF search query. */
function keywords(text: string, max = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const cleaned = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  for (const word of cleaned.split(/\s+/)) {
    if (word.length < 4 || STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= max) break;
  }
  return out;
}

function scoreGif(gif: GiphyGif, terms: string[]): number {
  const title = (gif.title || "").toLowerCase();
  let score = 0;
  for (const t of terms) if (t.length >= 4 && title.includes(t)) score += 1;
  return score;
}

/** Ranked list of candidate GIFs for a query (best first). Used so callers can
 *  pick the top result that has not already been used elsewhere in the deck. */
export async function searchGiphyRanked(
  query: string,
  intentTerms?: string[],
): Promise<NonNullable<GifSelection>[]> {
  const apiKey = process.env.GIPHY_API_KEY?.trim() || GIPHY_FALLBACK_API_KEY;
  if (!apiKey) {
    const pick = MOCK_GIFS[Math.abs(hash(query)) % MOCK_GIFS.length];
    return [{ ...pick, query, id: `${pick.id}-${hash(query)}` }];
  }

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  // A deep pool so slots (14 in a CIAB deck) and repeat decks have room to land
  // on DISTINCT GIFs instead of everyone grabbing Giphy's single top hit.
  url.searchParams.set("limit", "50");
  // "g" only — no nudity/sexual/suggestive content for a workplace deck.
  url.searchParams.set("rating", "g");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as { data: GiphyGif[] };
  const candidates = (data.data ?? []).filter((g) => isWorkplaceSafe(g.title));
  if (!candidates.length) return [];

  // Rank by title relevance to the query intent; Giphy's own order breaks ties
  // so a zero-signal query still yields Giphy's top hit.
  const terms = (intentTerms?.length ? intentTerms : keywords(query)).map((t) =>
    t.toLowerCase(),
  );
  return candidates
    .map((gif, idx) => ({ gif, score: scoreGif(gif, terms) * 10 - idx }))
    .sort((a, b) => b.score - a.score)
    .map(({ gif }) => ({
      id: gif.id,
      title: gif.title || query,
      url: gif.images.original.url,
      previewUrl: gif.images.fixed_height.url,
      query,
    }));
}

export async function searchGiphy(
  query: string,
  intentTerms?: string[],
): Promise<NonNullable<GifSelection> | null> {
  const ranked = await searchGiphyRanked(query, intentTerms);
  return ranked[0] ?? null;
}

/** Pick the best candidate not already used, marking the choice as used. Pure —
 *  unit-tested. Falls back to the top candidate if every option is taken. */
export function pickUnusedGif(
  ranked: NonNullable<GifSelection>[],
  used: Set<string>,
): NonNullable<GifSelection> | null {
  if (!ranked.length) return null;
  const fresh = ranked.find((g) => !used.has(g.id)) ?? ranked[0];
  used.add(fresh.id);
  return fresh;
}

/**
 * Like pickUnusedGif, but spreads picks across the top relevant candidates using
 * a per-slot `seed` instead of always taking Giphy's #1 hit. This is what keeps
 * GIFs distinct BOTH within a deck (the `used` set) and ACROSS decks (a different
 * topic/slot seed rotates into a different — but still relevant — top candidate,
 * so similar queries stop resolving to the same popular GIF everywhere). Pure.
 */
export function pickVariedUnusedGif(
  ranked: NonNullable<GifSelection>[],
  used: Set<string>,
  seed: number,
  usedWords?: Set<string>,
): NonNullable<GifSelection> | null {
  if (!ranked.length) return null;
  // Rotate a window over the top candidates by the seed, then fall through to the
  // rest of the pool so in-deck uniqueness still holds when the window is taken.
  const topN = Math.min(ranked.length, 15);
  const start = (((seed % topN) + topN) % topN) | 0;
  const order: NonNullable<GifSelection>[] = [];
  for (let i = 0; i < topN; i += 1) order.push(ranked[(start + i) % topN]);
  order.push(...ranked.slice(topN));
  // Only UNUSED candidates — never repeat a GIF (returning null when exhausted
  // lets the caller fetch fresh ones).
  const unused = order.filter((g) => !used.has(g.id));
  if (!unused.length) return null;
  // Prefer one whose subject (title words) hasn't been used yet, so we don't get
  // two GIFs of the same subject in a deck (e.g. two different Messi GIFs).
  let chosen = unused[0];
  if (usedWords) {
    chosen =
      unused.find((g) => !titleSubjectWords(g.title).some((w) => usedWords.has(w))) ?? unused[0];
    for (const w of titleSubjectWords(chosen.title)) usedWords.add(w);
  }
  used.add(chosen.id);
  return chosen;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export type MiniBoxGifContent = {
  welcome?: string;
  onePager?: string;
  chat?: string;
};

/**
 * Pick GIFs for the three GIF slides. When section content is provided, the
 * query and ranking are derived from that section's actual text so the GIF
 * reflects the content; otherwise it falls back to topic-based queries. Results
 * are ranked by title relevance rather than blindly taking Giphy's first hit.
 */
export async function pickMiniBoxGifs(topic: string, content?: MiniBoxGifContent) {
  const welcomeText = content?.welcome?.trim();
  const onePagerText = content?.onePager?.trim();
  const chatText = content?.chat?.trim();

  const welcomeQuery = welcomeText
    ? `${topic} ${keywords(welcomeText, 3).join(" ")}`.trim()
    : `${topic} security awareness welcome`;
  const onePagerQuery = onePagerText
    ? `${keywords(onePagerText, 4).join(" ")} ${topic}`.trim()
    : `${topic} cybersecurity`;
  const chatQuery = chatText
    ? keywords(chatText, 5).join(" ") || `${topic} reaction`
    : `${topic} reaction`;

  const [welcomeRanked, onePagerRanked, chatRanked] = await Promise.all([
    searchGiphyRanked(welcomeQuery, keywords(`${topic} ${welcomeText || ""}`, 6)),
    searchGiphyRanked(onePagerQuery, keywords(`${topic} ${onePagerText || ""}`, 6)),
    searchGiphyRanked(chatQuery, keywords(`${chatText || topic}`, 6)),
  ]);
  // Distinct across the 3 slots (used set) and across decks (topic+slot seed) —
  // previously each slot blindly took its query's #1 hit, so boxes repeated GIFs.
  const used = new Set<string>();
  const usedWords = new Set<string>();
  return {
    welcome: pickVariedUnusedGif(welcomeRanked, used, hash(`${topic}:0`), usedWords) || MOCK_GIFS[0],
    onePager: pickVariedUnusedGif(onePagerRanked, used, hash(`${topic}:1`), usedWords) || MOCK_GIFS[1],
    chat: pickVariedUnusedGif(chatRanked, used, hash(`${topic}:2`), usedWords) || MOCK_GIFS[2],
  };
}

/**
 * Content for the Main Box (CIAB) GIF slots: welcome (1), one per blog GIF slot,
 * one per weekly email (4), one per weekly chat (4). Queries are derived from
 * each section's actual text so the GIF reflects the content.
 */
export type CiabGifContent = {
  welcome?: string;
  /** Blog GIF slots, in order (one per blog section + conclusion). */
  blog?: string[];
  /** Weekly email bodies, index 0 = week 1. */
  emails?: string[];
  /** Weekly chat messages, index 0 = week 1. */
  chats?: string[];
};

async function rankedGifsFor(
  topic: string,
  text: string | undefined,
  fallbackSuffix: string,
): Promise<NonNullable<GifSelection>[]> {
  const trimmed = text?.trim();
  const query = trimmed
    ? `${keywords(trimmed, 4).join(" ")} ${topic}`.trim()
    : `${topic} ${fallbackSuffix}`.trim();
  return searchGiphyRanked(query, keywords(`${topic} ${trimmed || ""}`, 6));
}

/**
 * Pick a GIF for every Main Box slot, guaranteeing DISTINCT GIFs across the deck
 * (the deck has 14 GIF slots and similar section queries used to return the same
 * top hit, so the same GIF appeared on multiple slides). Each slot takes the
 * best ranked candidate not already used elsewhere. A `mockPool` keeps unique
 * placeholders when no Giphy key is configured.
 */
export async function pickCiabGifs(topic: string, content: CiabGifContent) {
  const used = new Set<string>();
  const usedWords = new Set<string>();
  let mockCursor = 0;
  const mockFallback = (): NonNullable<GifSelection> => {
    const pick = MOCK_GIFS[mockCursor % MOCK_GIFS.length];
    const id = `${pick.id}-${mockCursor}`;
    mockCursor += 1;
    return { ...pick, id, query: topic };
  };
  let slot = 0;
  const pick = async (
    text: string | undefined,
    fallbackSuffix: string,
  ): Promise<NonNullable<GifSelection>> => {
    // Seed by topic + slot so the same query resolves to a DIFFERENT top
    // candidate in a different deck (cross-deck variety) and per slot (in-deck).
    const seed = hash(`${topic}:${slot}`);
    const s = slot;
    slot += 1;
    let g = pickVariedUnusedGif(await rankedGifsFor(topic, text, fallbackSuffix), used, seed, usedWords);
    if (!g) {
      // The primary pool was fully claimed by earlier slots. Broaden with a
      // slot-varied query to pull DIFFERENT real GIFs rather than repeat one.
      const alt = GIF_FALLBACK_TERMS[s % GIF_FALLBACK_TERMS.length];
      g = pickVariedUnusedGif(
        await searchGiphyRanked(`${topic} ${alt}`, keywords(`${topic} ${alt}`, 4)),
        used,
        seed,
        usedWords,
      );
    }
    return g ?? mockFallback();
  };

  // Sequential so each pick sees the ids already claimed by earlier slots.
  const welcome = await pick(content.welcome, "security awareness welcome");
  const blog: NonNullable<GifSelection>[] = [];
  for (const text of content.blog || []) blog.push(await pick(text, "cybersecurity"));
  const emails: NonNullable<GifSelection>[] = [];
  for (const text of content.emails || []) emails.push(await pick(text, "cybersecurity email"));
  const chats: NonNullable<GifSelection>[] = [];
  for (const text of content.chats || []) chats.push(await pick(text, "reaction"));

  return { welcome, blog, emails, chats };
}
