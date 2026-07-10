import { NextResponse } from "next/server";
import type { SourceArticle } from "@/lib/mini-box";
import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
} from "@/lib/anthropic";

type Body = {
  kind: "topics" | "articles";
  topic?: string;
  articles?: SourceArticle[];
  model?: string;
};

const MOCK_TOPICS = [
  "When AI Follows the Wrong Instructions",
  "Shadow AI at Work",
  "Invisible Threats on Your Mobile",
  "Update Before You Browse",
  "Lessons from Recent AI Security Leaks",
  "Internet of Things (IoT) Awareness",
];

function mockArticles(topic: string) {
  const t = topic || "cybersecurity awareness";
  return [
    {
      title: `Why ${t} matters for every employee`,
      url: "https://example.com/awareness",
      notes: "High-level overview suitable for the one-pager hook.",
    },
    {
      title: `Recent incidents related to ${t}`,
      url: "https://example.com/incidents",
      notes: "Use for concrete examples and stats in body part 1.",
    },
    {
      title: `Practical habits to reduce risk around ${t}`,
      url: "https://example.com/habits",
      notes: "Good source for the tip list and chat scenario.",
    },
  ];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.kind) {
      return NextResponse.json({ error: "kind is required" }, { status: 400 });
    }

    if (!anthropicConfigured()) {
      if (body.kind === "topics") {
        return NextResponse.json({
          source: "mock",
          topics: MOCK_TOPICS,
          note: `Mock topic ideas. ${anthropicMissingKeyMessage()}`,
        });
      }
      return NextResponse.json({
        source: "mock",
        articles: mockArticles(body.topic || ""),
        note: `Mock article ideas. ${anthropicMissingKeyMessage()}`,
      });
    }

    const prompt =
      body.kind === "topics"
        ? `Suggest 6 timely security-awareness Mini Box topics for employees. Return JSON: { "topics": string[] }`
        : `Topic: ${body.topic}
Existing articles: ${JSON.stringify(body.articles || [])}
Suggest 5 relevant source articles/angles for a security Mini Box. Prefer real-sounding titles and plausible URLs or leave url empty if unsure. Return JSON: { "articles": [{ "title": string, "url": string, "notes": string }] }`;

    const parsed = await anthropicJson<{
      topics?: string[];
      articles?: Array<{ title: string; url: string; notes: string }>;
    }>({
      system:
        "You help Living Security writers research Mini Box topics and source articles. Be practical and timely. JSON only.",
      user: prompt,
      temperature: 0.7,
      model: body.model,
    });

    return NextResponse.json({ source: "anthropic", model: body.model, ...parsed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research suggestion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
