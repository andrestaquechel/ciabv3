import { after, NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { handleSlackEventPayload } from "@/lib/slack/handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let payload: {
    type: string;
    challenge?: string;
    event?: { bot_id?: string; subtype?: string };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Slack URL verification — respond before signature check so setup works
  // even when SLACK_SIGNING_SECRET is not yet in Vercel.
  if (payload.type === "url_verification" && payload.challenge) {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    assertSlackSignature(request, rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  if (payload.event?.bot_id) {
    return new Response("", { status: 200 });
  }

  after(async () => {
    try {
      await handleSlackEventPayload(payload);
    } catch (err) {
      console.error("Slack event handler error:", err);
    }
  });

  return new Response("", { status: 200 });
}
