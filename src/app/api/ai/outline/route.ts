import { NextResponse } from "next/server";
import type { SourceArticle } from "@/lib/mini-box";
import { generateOutline } from "@/lib/mini-box-generate";
import type { GenerationPromptsConfig } from "@/lib/mini-box-prompts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      notes?: string;
      articles?: SourceArticle[];
      model?: string;
      prompts?: GenerationPromptsConfig;
    };
    if (!body.topic?.trim()) {
      return NextResponse.json({ error: "topic is required." }, { status: 400 });
    }

    const result = await generateOutline({
      topic: body.topic.trim(),
      notes: body.notes,
      articles: body.articles,
      model: body.model,
      prompts: body.prompts,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Outline generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
