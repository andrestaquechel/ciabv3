import { NextResponse } from "next/server";
import { generateTopicCandidates } from "@/lib/mini-box-topic-research";
import type { TopicResearchPromptsConfig } from "@/lib/mini-box-topic-prompts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      monthlyCiabTopic?: string;
      prompts?: TopicResearchPromptsConfig;
      model?: string;
    };

    const result = await generateTopicCandidates({
      monthlyCiabTopic: body.monthlyCiabTopic,
      prompts: body.prompts,
      model: body.model,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Topic research failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
