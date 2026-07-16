import { runTopicResearchForMonth } from "@/lib/slack/handlers";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://ciabv2-gilt.vercel.app";
}

/** Queue topic research in a separate serverless invocation (avoids interaction timeout). */
export async function dispatchTopicResearchJob(
  args: Parameters<typeof runTopicResearchForMonth>[0],
): Promise<void> {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("SLACK_SIGNING_SECRET is not configured.");
  }

  const res = await fetch(`${appBaseUrl()}/api/webhooks/slack/topic-research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to queue topic research (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
}
