import { NextResponse } from "next/server";
import type { MiniBoxSectionId, SourceArticle } from "@/lib/mini-box";

type GenerateBody = {
  sectionId: MiniBoxSectionId;
  topic: string;
  articles?: SourceArticle[];
  context?: string;
  action?: "generate" | "shorten" | "warmer" | "sharper" | "concrete";
  currentText?: string;
};

function articleContext(articles?: SourceArticle[]) {
  if (!articles?.length) return "";
  return articles
    .map(
      (a, i) =>
        `${i + 1}. ${a.title || "Untitled"}${a.url ? ` (${a.url})` : ""}${a.notes ? ` — ${a.notes}` : ""}`,
    )
    .join("\n");
}

function mockGenerate(body: GenerateBody) {
  const topic = body.topic || "this security topic";
  const action = body.action || "generate";
  const sources = articleContext(body.articles);

  if (action !== "generate" && body.currentText) {
    const prefixes: Record<string, string> = {
      shorten: "[Shortened] ",
      warmer: "[Warmer tone] ",
      sharper: "[Sharper] ",
      concrete: "[More concrete] ",
    };
    return {
      text: `${prefixes[action] || ""}${body.currentText}`,
      fields: null,
    };
  }

  switch (body.sectionId) {
    case "title":
      return { text: topic, fields: { topicTitle: topic } };
    case "welcome":
      return {
        text: "",
        fields: {
          intro: `Welcome to your Mini Box: ${topic}. As this topic shows up more in everyday work, helping employees recognize the risk and build one clear habit is a high-impact awareness moment.${sources ? " This draft draws on the source articles you provided." : ""}`,
          contents: `In this topical mini box, you'll find:\nA one-pager that walks employees through what ${topic} is, why it matters right now, and what they can do about it today. We have provided a subject line for email distribution, but feel free to share via intranet, blog, or whatever channel works best for your organization.\nA chat message using a quick interactive scenario to reinforce one simple habit. Depending on your messaging client, you may need to save the provided GIFs to your computer and attach them to your chat messages.`,
        },
      };
    case "onePager":
      return {
        text: "",
        fields: {
          greeting: "Hey, Team!",
          subjectLine: `🔒 A quick note on ${topic}`,
          bodyPart1: `Not long ago, ${topic.toLowerCase()} made headlines — and it's a useful reminder for all of us.${sources ? `\n\nDrawing from recent reporting:\n${sources}` : ""}\n\nHere's the short version of what happened and why it matters for how we work day to day.`,
          bodyPart2: `A few simple habits make a real difference:\n🔍 Stay alert to unusual requests or outputs.\n📄 Think before you share sensitive data with tools or people you don't fully trust.\n⚠️ When something feels off, pause and ask.\n✅ Stick to company-approved tools and processes.\n🙋 When in doubt, reach out to your security team.\n\nUntil next time,\n{{ SIGNATURE }}`,
        },
      };
    case "chat":
      return {
        text: "",
        fields: {
          message: `💡 Quick scenario on ${topic}\n\nYou're mid-task when something unexpected pops up related to this topic. What's your move?\nA. Ignore it and keep going\nB. Handle it yourself without checking\nC. Pause and follow the safer path / ask security\n\nReply in this thread with your answer! 👇\nHint: C is usually the right move.`,
        },
      };
    default:
      return { text: "", fields: null };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    if (!body.sectionId || body.sectionId === "inputs") {
      return NextResponse.json(
        { error: "Pick a content section to generate." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const mock = mockGenerate(body);
      return NextResponse.json({
        source: "mock",
        ...mock,
        note: "Add OPENAI_API_KEY for live AI generation. Using Mini Box–style mock drafts for now.",
      });
    }

    const system = `You write Living Security Mini Box content: conversational, security-awareness focused, emoji-friendly, practical habits. Use provided source articles when available. Keep tone warm and clear. Return JSON only. Leave {{ SIGNATURE }} unchanged in email closings.`;

    const userPrompt = `Topic: ${body.topic}
Section: ${body.sectionId}
Action: ${body.action || "generate"}
Source articles:\n${articleContext(body.articles) || "(none)"}
Current text (if rewriting): ${body.currentText || "(none)"}
Context: ${body.context || "(none)"}

Return a JSON object with keys matching the section fields:
- title: { "topicTitle": string }
- welcome: { "intro": string, "contents": string }
- onePager: { "greeting": string, "subjectLine": string, "bodyPart1": string, "bodyPart2": string }
- chat: { "message": string }`;

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
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const fields = JSON.parse(
      data.choices[0]?.message?.content || "{}",
    ) as Record<string, string>;

    return NextResponse.json({ source: "openai", fields, text: "" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
