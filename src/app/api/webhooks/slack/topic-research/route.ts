import { after } from "next/server";
import { runTopicResearchForMonth } from "@/lib/slack/handlers";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Parameters<typeof runTopicResearchForMonth>[0];
  try {
    body = (await request.json()) as Parameters<typeof runTopicResearchForMonth>[0];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.channel || !body.monthNumber || !body.monthLabel) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  after(async () => {
    try {
      await runTopicResearchForMonth(body);
    } catch (err) {
      console.error("Background topic research failed:", err);
    }
  });

  return new Response(JSON.stringify({ ok: true, queued: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}
