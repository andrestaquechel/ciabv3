import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { SourceArticle } from "@/lib/mini-box";
import {
  generateFullMiniBox,
  generateOutline,
} from "@/lib/mini-box-generate";
import type { GenerationPromptsConfig, MiniBoxOutline } from "@/lib/mini-box-prompts";
import {
  saveGeneratedDraftToDrive,
  type GeneratedBoxDraft,
} from "@/lib/box-studio-drive-data";
import { outlineToContextText } from "@/lib/mini-box-prompts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      notes?: string;
      outline?: MiniBoxOutline | string | null;
      articles?: SourceArticle[];
      model?: string;
      prompts?: GenerationPromptsConfig;
      saveDraft?: boolean;
      createdBy?: string;
      skipOutline?: boolean;
    };

    if (!body.topic?.trim()) {
      return NextResponse.json({ error: "topic is required." }, { status: 400 });
    }

    const topic = body.topic.trim();
    let outline = body.outline ?? null;

    if (!outline && !body.skipOutline) {
      const outlineResult = await generateOutline({
        topic,
        notes: body.notes,
        articles: body.articles,
        model: body.model,
        prompts: body.prompts,
      });
      outline = outlineResult.outline;
    }

    const full = await generateFullMiniBox({
      topic,
      notes: body.notes,
      outline,
      articles: body.articles,
      model: body.model,
      prompts: body.prompts,
    });

    let draftId: string | undefined;
    if (body.saveDraft) {
      draftId = randomUUID();
      const draft: GeneratedBoxDraft = {
        id: draftId,
        topic,
        createdAt: new Date().toISOString(),
        createdBy: body.createdBy,
        source: full.source,
        outline,
        sections: full.sections,
      };
      try {
        await saveGeneratedDraftToDrive(draft);
      } catch {
        // Drive write optional — still return generated content
        draftId = undefined;
      }
    }

    return NextResponse.json({
      ...full,
      outline,
      outlineText: outlineToContextText(outline),
      draftId,
      openUrl: draftId ? `/builder/new?draft=${draftId}` : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Full box generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
