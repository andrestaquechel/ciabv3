import { NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { buildNewboxWizardResponse } from "@/lib/slack/newbox-handlers";
import { parseMonthInput } from "@/lib/annual-calendar-types";
import { registerSlackWorkflowThread, loadSlackWorkflowFromDrive } from "@/lib/box-studio-drive-data";
import { registerCalendarWait } from "@/lib/db/slack-threads";
import { slackPostMessage } from "@/lib/slack/api";

export const runtime = "nodejs";

function parseSlackBody(rawBody: string, contentType: string | null) {
  if (contentType?.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
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
    const parts = rawText.split(/\s+/).filter(Boolean);
    const sub = parts[0]?.toLowerCase();

    let boxType: "mini-box" | "ciab" | undefined;
    if (sub === "mini-box" || sub === "minibox" || sub === "mini") {
      boxType = "mini-box";
    } else if (sub === "ciab") {
      boxType = "ciab";
    }

    const monthArg =
      sub === "help" || !rawText
        ? undefined
        : boxType
          ? parts.slice(1).join(" ")
          : parts.join(" ");
    const month = monthArg ? parseMonthInput(monthArg) : null;

    if (!payload.channel_id) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Missing channel context.",
      });
    }

    // /newbox, /newbox help, and shortcuts all launch the interactive wizard
    const wizard = await buildNewboxWizardResponse({
      channel: payload.channel_id,
      userId: payload.user_id,
      parsed: {
        boxType: sub === "help" || !rawText ? undefined : boxType,
        month: month ? String(month.monthNumber) : monthArg || undefined,
      },
    });

    // Post in-channel so we get a message ts for thread registration (calendar upload)
    if (wizard.text === "Annual topic calendar needed") {
      const posted = await slackPostMessage({
        channel: payload.channel_id,
        text: wizard.text,
        blocks: wizard.blocks,
      });
      if (posted.ts) {
        await registerSlackWorkflowThread(
          payload.channel_id,
          posted.ts,
          wizard.workflowId,
        );
        const workflow = await loadSlackWorkflowFromDrive(wizard.workflowId);
        if (workflow) {
          await registerCalendarWait(
            wizard.workflowId,
            payload.channel_id,
            posted.ts,
            workflow.boxType,
          );
        }
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Posted calendar upload prompt in channel — reply in that thread with a photo or pasted list.",
      });
    }

    return NextResponse.json({
      response_type: "in_channel",
      text: wizard.text,
      blocks: wizard.blocks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "New box wizard failed.";
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Error: ${message}`,
    });
  }
}
