import { NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { runTopicResearch } from "@/lib/slack/handlers";
import {
  generateFullMiniBox,
  generateOutline,
} from "@/lib/mini-box-generate";
import { saveGeneratedDraftToDrive } from "@/lib/box-studio-drive-data";
import { randomUUID } from "crypto";

function parseSlackBody(rawBody: string, contentType: string | null) {
  if (contentType?.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://ciabv2-gilt.vercel.app";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    assertSlackSignature(request, rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  try {
    const payload = parseSlackBody(rawBody, request.headers.get("content-type"));
    const rawText = (payload.text || "").trim();
    const subcommand = rawText.split(/\s+/)[0]?.toLowerCase();
    const topic = rawText.replace(/^\/\w+\s*/i, "").replace(/^topics?\s*/i, "").trim();

    // /mini-box topics
    if (!topic || subcommand === "topics" || subcommand === "topic") {
      if (payload.response_url && payload.channel_id) {
        void runTopicResearch({
          channel: payload.channel_id,
          threadTs: payload.message_ts || "",
          userId: payload.user_id,
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Researching 6 Mini Box topic candidates… I'll post them in this channel shortly.",
      });
    }

    const requester = payload.user_name || payload.user_id || "slack";
    const outlineResult = await generateOutline({
      topic,
      notes: `Slack request from ${requester}`,
    });
    const full = await generateFullMiniBox({
      topic,
      notes: `Slack request from ${requester}`,
      outline: outlineResult.outline,
    });

    let openUrl = `${appBaseUrl()}/builder/new?topic=${encodeURIComponent(topic)}&autoGenerate=1`;
    const draftId = randomUUID();
    try {
      await saveGeneratedDraftToDrive({
        id: draftId,
        topic,
        createdAt: new Date().toISOString(),
        createdBy: requester,
        source: full.source,
        outline: outlineResult.outline,
        sections: full.sections,
      });
      openUrl = `${appBaseUrl()}/builder/new?draft=${draftId}`;
    } catch {
      // fall back
    }

    const introPreview = full.sections.welcome.intro.slice(0, 280);
    return NextResponse.json({
      response_type: "in_channel",
      text: `Generated Mini Box draft for *${topic}*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Mini Box generated:* ${topic}\n\n*Angle:* ${outlineResult.outline.angle}\n\n*Welcome preview:*\n${introPreview}${full.sections.welcome.intro.length > 280 ? "…" : ""}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${openUrl}|Open in Box Studio to review, pick GIFs, and publish>`,
          },
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack generation failed.";
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Generation failed: ${message}`,
    });
  }
}
