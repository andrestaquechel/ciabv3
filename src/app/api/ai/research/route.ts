import { NextResponse } from "next/server";
import type { SourceArticle } from "@/lib/mini-box";

type Body = {
  kind: "topics" | "articles";
  topic?: string;
  articles?: SourceArticle[];
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (body.kind === "topics") {
        return NextResponse.json({
          source: "mock",
          topics: MOCK_TOPICS,
          note: "Mock topic ideas. Add OPENAI_API_KEY for live research suggestions.",
        });
      }
      return NextResponse.json({
        source: "mock",
        articles: mockArticles(body.topic || ""),
        note: "Mock article ideas. Add OPENAI_API_KEY for live research suggestions.",
      });
    }

    const prompt =
      body.kind === "topics"
        ? `Suggest 6 timely security-awareness Mini Box topics for employees. Return JSON: { "topics": string[] }`
        : `Topic: ${body.topic}
Existing articles: ${JSON.stringify(body.articles || [])}
Suggest 5 relevant source articles/angles for a security Mini Box. Prefer real-sounding titles and plausible URLs or leave url empty if unsure. Return JSON: { "articles": [{ "title": string, "url": string, "notes": string }] }`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You help Living Security writers research Mini Box topics and source articles. Be practical and timely. JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI error: ${res.status}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const parsed = JSON.parse(data.choices[0]?.message?.content || "{}") as {
      topics?: string[];
      articles?: Array<{ title: string; url: string; notes: string }>;
    };

    return NextResponse.json({ source: "openai", ...parsed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research suggestion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
