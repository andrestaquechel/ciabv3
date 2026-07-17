import { NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { runTopicResearch } from "@/lib/slack/handlers";
import {
  generateFullMiniBox,
  generateOutline,
} from "@/lib/mini-box-generate";
import { saveGeneratedDraftToDrive } from "@/lib/box-studio-drive-data";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function parseSlackBody(rawBody: string, contentType: string | null) {
  if (contentType?.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
}

const HELP_TEXT = `*Mini Box slash commands*
• \`/mini-box topics\` — research 6 topic candidates (same as @CIAB_Slack_App topics)
• \`/mini-box help\` — show this message
• \`/mini-box Shadow AI\` — quick-generate a full box for a topic (skips topic picker)

*Recommended flow in a channel thread:*
1. \`/mini-box topics\` or @mention *topics*
2. Select a topic → review outline → Approve
3. CSMs review PPTX in thread → Morgan clicks *Apply CSM feedback*`;

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

    if (subcommand === "help" || rawText === "help") {
      return NextResponse.json({
        response_type: "ephemeral",
        text: HELP_TEXT,
      });
    }

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
      notes: `Slack slash command from ${requester}`,
    });
    const full = await generateFullMiniBox({
      topic,
      notes: `Slack slash command from ${requester}`,
      outline: outlineResult.outline,
    });

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
    } catch {
      // best-effort record; the draft content is still returned below
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
