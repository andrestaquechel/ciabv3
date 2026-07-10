import { NextResponse } from "next/server";
import type { SourceArticle } from "@/lib/mini-box";
import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
} from "@/lib/anthropic";

type GenerateSectionId =
  | "title"
  | "welcome"
  | "onePager"
  | "chat"
  | "review";

type GenerateBody = {
  sectionId: GenerateSectionId;
  topic: string;
  articles?: SourceArticle[];
  context?: string;
  action?: "generate" | "shorten" | "warmer" | "sharper" | "concrete";
  currentText?: string;
  model?: string;
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
          subjectLine: `Subject:  👤 When AI casts a shadow…`,
          bodyPart1: `There's no question that AI has changed the world…but it's yet to be seen precisely how. Organizations across the world have raced to adopt all kinds of AI tools in order to boost productivity and stay on the cutting edge of the way we work.${sources ? `\n\nDrawing from recent reporting:\n${sources}` : ""}`,
          callout: `${topic} is the use of unapproved tools or practices that bypass IT oversight. These create pockets of sensitive data that cannot be reviewed, logged, or deleted by security teams.`,
          bodyPart2: `This is both a security issue and a legal issue, so it's very important to prevent the practice of ${topic} within our organization. Never use any tool or feature that has not been pre-approved by IT. If you're not sure, ask.\nIf you aren't sure whether what you've been using is approved, please let the security team know immediately so we can help you correct the issue. We're here to help, not get anyone in trouble!\n\nAll the best,\n{{ SIGNATURE }}`,
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
    if (!body.sectionId || body.sectionId === "review") {
      return NextResponse.json(
        { error: "Pick a content section to generate." },
        { status: 400 },
      );
    }

    if (!anthropicConfigured()) {
      const mock = mockGenerate(body);
      return NextResponse.json({
        source: "mock",
        ...mock,
        note: `${anthropicMissingKeyMessage()} Using Mini Box–style mock drafts for now.`,
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
- onePager: { "greeting": string, "subjectLine": string, "bodyPart1": string, "callout": string, "bodyPart2": string }
- chat: { "message": string }`;

    const fields = await anthropicJson<Record<string, string>>({
      system,
      user: userPrompt,
      temperature: 0.7,
      model: body.model,
    });

    return NextResponse.json({
      source: "anthropic",
      model: body.model,
      fields,
      text: "",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
