import { after, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { assertSlackSignature } from "@/lib/slack/verify";
import { runNewboxWizardAndPost } from "@/lib/slack/newbox-handlers";
import { newboxTypeBlocks } from "@/lib/slack/newbox-blocks";

export const runtime = "nodejs";
// Slack cuts a slash command off at 3s. The wizard's Drive/DB work runs in the
// background via after(); this handler never does I/O before responding, so it
// acks well within the deadline even on a cold start.
export const maxDuration = 60;

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

  const payload = parseSlackBody(rawBody, request.headers.get("content-type"));
  if (!payload.channel_id) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Missing channel context.",
    });
  }

  const rawText = (payload.text || "").trim();
  const parts = rawText.split(/\s+/).filter(Boolean);
  const sub = parts[0]?.toLowerCase();

  let boxType: "mini-box" | "ciab" | undefined;
  if (sub === "mini-box" || sub === "minibox" || sub === "mini") {
    boxType = "mini-box";
  } else if (sub === "ciab") {
    boxType = "ciab";
  }

  // Bare `/newbox` (or `/newbox help`) → return the static Mini Box / CIAB
  // picker instantly with ZERO I/O. The workflow record is created lazily by
  // the type-select button handler (loadOrStubWorkflow), so nothing needs to be
  // read or persisted here — this is what keeps the command under Slack's 3s
  // deadline even when the function is cold.
  if (!boxType) {
    return NextResponse.json({
      response_type: "in_channel",
      text: "New box wizard — choose Mini Box or CIAB",
      blocks: newboxTypeBlocks(randomUUID()),
    });
  }

  // A box type (and maybe a month) were provided inline. Ack instantly, then
  // build the wizard (calendar reads, workflow persist, research dispatch) in
  // the background and post the result to the channel.
  const monthArg = parts.slice(1).join(" ") || undefined;
  const channel = payload.channel_id;
  const userId = payload.user_id;
  after(() =>
    runNewboxWizardAndPost({ channel, userId, parsed: { boxType, month: monthArg } }),
  );

  return NextResponse.json({
    response_type: "ephemeral",
    text: `Setting up your ${boxType === "ciab" ? "CIAB" : "Mini Box"}${monthArg ? ` for ${monthArg}` : ""}…`,
  });
}
