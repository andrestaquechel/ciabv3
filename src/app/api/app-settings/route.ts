import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadAppSettingsFromDrive,
  saveAppSettingsToDrive,
  type AppSettingsPayload,
} from "@/lib/box-studio-drive-data";
import { isValidClaudeModel, resolveClaudeModel } from "@/lib/claude-models";
import { resolveSlackReview } from "@/lib/slack/review-settings";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to load app settings." },
      { status: 401 },
    );
  }

  try {
    const settings = (await loadAppSettingsFromDrive()) ?? {};
    const claudeModel = resolveClaudeModel(
      settings.claudeModel,
      process.env.ANTHROPIC_MODEL,
    );
    const slackReview = resolveSlackReview(settings.slackReview);
    return NextResponse.json({ ...settings, claudeModel, slackReview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load app settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to save app settings." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as AppSettingsPayload;
    if (body.claudeModel && !isValidClaudeModel(body.claudeModel)) {
      return NextResponse.json({ error: "Invalid Claude model." }, { status: 400 });
    }

    const existing = (await loadAppSettingsFromDrive()) ?? {};
    const merged: AppSettingsPayload = {
      ...existing,
      ...body,
      knowledgeFolders: {
        ...existing.knowledgeFolders,
        ...body.knowledgeFolders,
      },
      generationPrompts: {
        ...existing.generationPrompts,
        ...body.generationPrompts,
      },
      topicResearchPrompts: {
        ...existing.topicResearchPrompts,
        ...body.topicResearchPrompts,
      },
      annualCalendars: {
        ...existing.annualCalendars,
        ...body.annualCalendars,
      },
      slackReview: {
        ...existing.slackReview,
        ...body.slackReview,
      },
      slackActiveThreads: {
        ...existing.slackActiveThreads,
        ...body.slackActiveThreads,
      },
    };

    const saved = await saveAppSettingsToDrive(
      merged,
      session.user?.email ?? undefined,
    );
    return NextResponse.json({
      ...saved,
      claudeModel: resolveClaudeModel(
        saved.claudeModel,
        process.env.ANTHROPIC_MODEL,
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save app settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
