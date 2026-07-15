import type { GifSelection } from "@/lib/mini-box";

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

export async function searchGiphy(query: string): Promise<NonNullable<GifSelection> | null> {
  const apiKey = process.env.GIPHY_API_KEY?.trim();
  if (!apiKey) {
    const pick = MOCK_GIFS[Math.abs(hash(query)) % MOCK_GIFS.length];
    return { ...pick, query, id: `${pick.id}-${hash(query)}` };
  }

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { data: GiphyGif[] };
  const gif = data.data?.[0];
  if (!gif) return null;

  return {
    id: gif.id,
    title: gif.title || query,
    url: gif.images.original.url,
    previewUrl: gif.images.fixed_height.url,
    query,
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function pickMiniBoxGifs(topic: string) {
  const [welcome, onePager, chat] = await Promise.all([
    searchGiphy(`${topic} security welcome funny`),
    searchGiphy(`${topic} cybersecurity awareness`),
    searchGiphy(`${topic} reaction thinking meme`),
  ]);
  return {
    welcome: welcome || MOCK_GIFS[0],
    onePager: onePager || MOCK_GIFS[1],
    chat: chat || MOCK_GIFS[2],
  };
}
