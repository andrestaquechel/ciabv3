import { NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { handleBlockActions } from "@/lib/slack/handlers";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    assertSlackSignature(request, rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Parameters<typeof handleBlockActions>[0];

  try {
    await handleBlockActions(payload);
  } catch (err) {
    console.error("Slack interaction error:", err);
  }

  return new Response("", { status: 200 });
}
