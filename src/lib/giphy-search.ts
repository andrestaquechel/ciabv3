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

export async function searchGiphy(
  query: string,
  intentTerms?: string[],
): Promise<NonNullable<GifSelection> | null> {
  const apiKey = process.env.GIPHY_API_KEY?.trim() || GIPHY_FALLBACK_API_KEY;
  if (!apiKey) {
    const pick = MOCK_GIFS[Math.abs(hash(query)) % MOCK_GIFS.length];
    return { ...pick, query, id: `${pick.id}-${hash(query)}` };
  }

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { data: GiphyGif[] };
  const candidates = data.data ?? [];
  if (!candidates.length) return null;

  // Rank by title relevance to the query intent; Giphy's own order breaks ties
  // so a zero-signal query still yields Giphy's top hit.
  const terms = (intentTerms?.length ? intentTerms : keywords(query)).map((t) =>
    t.toLowerCase(),
  );
  let best = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((gif, idx) => {
    const score = scoreGif(gif, terms) * 10 - idx;
    if (score > bestScore) {
      bestScore = score;
      best = gif;
    }
  });

  return {
    id: best.id,
    title: best.title || query,
    url: best.images.original.url,
    previewUrl: best.images.fixed_height.url,
    query,
  };
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

  const [welcome, onePager, chat] = await Promise.all([
    searchGiphy(welcomeQuery, keywords(`${topic} ${welcomeText || ""}`, 6)),
    searchGiphy(onePagerQuery, keywords(`${topic} ${onePagerText || ""}`, 6)),
    searchGiphy(chatQuery, keywords(`${chatText || topic}`, 6)),
  ]);
  return {
    welcome: welcome || MOCK_GIFS[0],
    onePager: onePager || MOCK_GIFS[1],
    chat: chat || MOCK_GIFS[2],
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

async function gifFor(
  topic: string,
  text: string | undefined,
  fallbackSuffix: string,
  mockIndex: number,
): Promise<NonNullable<GifSelection>> {
  const trimmed = text?.trim();
  const query = trimmed
    ? `${keywords(trimmed, 4).join(" ")} ${topic}`.trim()
    : `${topic} ${fallbackSuffix}`.trim();
  const gif = await searchGiphy(query, keywords(`${topic} ${trimmed || ""}`, 6));
  return gif || MOCK_GIFS[mockIndex % MOCK_GIFS.length];
}

export async function pickCiabGifs(topic: string, content: CiabGifContent) {
  const welcome = await gifFor(topic, content.welcome, "security awareness welcome", 0);

  const blog = await Promise.all(
    (content.blog || []).map((text, i) => gifFor(topic, text, "cybersecurity", i + 1)),
  );
  const emails = await Promise.all(
    (content.emails || []).map((text, i) => gifFor(topic, text, "cybersecurity email", i)),
  );
  const chats = await Promise.all(
    (content.chats || []).map((text, i) => gifFor(topic, text, "reaction", i + 2)),
  );

  return { welcome, blog, emails, chats };
}
