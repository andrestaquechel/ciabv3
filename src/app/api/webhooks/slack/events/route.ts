import { after, NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { handleSlackEventPayload } from "@/lib/slack/handlers";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    assertSlackSignature(request, rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type: string;
    challenge?: string;
    event?: { bot_id?: string; subtype?: string };
  };

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Ignore bot's own messages
  if (payload.event?.bot_id) {
    return new Response("", { status: 200 });
  }

  after(async () => {
    try {
      await handleSlackEventPayload(JSON.parse(rawBody));
    } catch (err) {
      console.error("Slack event handler error:", err);
    }
  });

  return new Response("", { status: 200 });
}
