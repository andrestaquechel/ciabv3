import { NextResponse } from "next/server";

type GiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string };
    original: { url: string };
    downsized: { url: string };
  };
};

const MOCK_GIFS = [
  {
    id: "mock-1",
    title: "Security awareness",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif",
  },
  {
    id: "mock-2",
    title: "Thinking emoji",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif",
  },
  {
    id: "mock-3",
    title: "Alert",
    url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif",
  },
  {
    id: "mock-4",
    title: "Typing",
    url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/200.gif",
  },
  {
    id: "mock-5",
    title: "Success",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/200.gif",
  },
  {
    id: "mock-6",
    title: "Shield",
    url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/200.gif",
  },
  {
    id: "mock-7",
    title: "Lock",
    url: "https://media.giphy.com/media/Is1O1TWV0LEJi/giphy.gif",
    previewUrl: "https://media.giphy.com/media/Is1O1TWV0LEJi/200.gif",
  },
  {
    id: "mock-8",
    title: "Warning",
    url: "https://media.giphy.com/media/3o6Zt481isNVuBI1U4/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o6Zt481isNVuBI1U4/200.gif",
  },
  {
    id: "mock-9",
    title: "Research",
    url: "https://media.giphy.com/media/l0HlBO7eyXgtkmJsc/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0HlBO7eyXgtkmJsc/200.gif",
  },
  {
    id: "mock-10",
    title: "Email",
    url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVy/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVy/200.gif",
  },
  {
    id: "mock-11",
    title: "Team",
    url: "https://media.giphy.com/media/3o7abldet0l7XEJT3O/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7abldet0l7XEJT3O/200.gif",
  },
  {
    id: "mock-12",
    title: "Celebrate",
    url: "https://media.giphy.com/media/5GoVLqeAi99PG/giphy.gif",
    previewUrl: "https://media.giphy.com/media/5GoVLqeAi99PG/200.gif",
  },
  {
    id: "mock-13",
    title: "Focus",
    url: "https://media.giphy.com/media/l0MYGb1LuPD3LenPy/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0MYGb1LuPD3LenPy/200.gif",
  },
  {
    id: "mock-14",
    title: "Question",
    url: "https://media.giphy.com/media/13CoXDiaFdCoyE/giphy.gif",
    previewUrl: "https://media.giphy.com/media/13CoXDiaFdCoyE/200.gif",
  },
  {
    id: "mock-15",
    title: "Done",
    url: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26u4cqiYI30juCOGY/200.gif",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "cybersecurity";
  const apiKey = process.env.GIPHY_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "mock",
      query: q,
      results: MOCK_GIFS.map((g) => ({ ...g, query: q })),
      note: "Add GIPHY_API_KEY to .env.local for live search.",
    });
  }

  try {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "15");
    url.searchParams.set("rating", "pg-13");
    url.searchParams.set("lang", "en");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Giphy error: ${res.status}`);
    }

    const data = (await res.json()) as { data: GiphyGif[] };
    const results = data.data.map((gif) => ({
      id: gif.id,
      title: gif.title || "GIF",
      url: gif.images.original.url,
      previewUrl: gif.images.fixed_height.url,
      query: q,
    }));

    return NextResponse.json({ source: "giphy", query: q, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Giphy search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
