import { assertSlackSignature } from "@/lib/slack/verify";
import { handleBlockActions } from "@/lib/slack/handlers";

export const runtime = "nodejs";

function parseInteractionBody(rawBody: string, contentType: string | null) {
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");
    if (!payloadStr) throw new Error("Missing payload field.");
    return JSON.parse(payloadStr) as Parameters<typeof handleBlockActions>[0];
  }
  return JSON.parse(rawBody) as Parameters<typeof handleBlockActions>[0];
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    assertSlackSignature(request, rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid Slack signature." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = parseInteractionBody(
      rawBody,
      request.headers.get("content-type"),
    );
    await handleBlockActions(payload);
  } catch (err) {
    console.error("Slack interaction error:", err);
  }

  return new Response("", { status: 200 });
}
