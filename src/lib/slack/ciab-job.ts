function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://ciabv2-gilt.vercel.app";
}

/** Every CIAB step that runs Claude web-search research. Each maps to a handler
 *  in ciab-handlers.ts. Running these inside the 60s interactions route times
 *  out (Opus + web search regularly exceeds a minute), so they are dispatched to
 *  a dedicated endpoint with maxDuration=300 instead. */
export type CiabJob =
  | { step: "concept"; workflowId: string; channel: string; threadTs?: string }
  | {
      step: "concept-select";
      workflowId: string;
      conceptId: string;
      channel: string;
      threadTs?: string;
    }
  // Second half of concept-select: build the outline from already-researched
  // sources. Split into its own invocation so neither half runs long enough to
  // be killed as a post-response background task.
  | { step: "outline"; workflowId: string; channel: string; threadTs?: string }
  | { step: "outline-regenerate"; workflowId: string; channel: string; threadTs?: string }
  | {
      step: "outline-approve";
      workflowId: string;
      channel: string;
      threadTs?: string;
      userId?: string;
    };

/** Queue a CIAB research step in a separate serverless invocation so the heavy
 *  Claude + web-search work runs under maxDuration=300 instead of the 60s
 *  interaction-handler limit. Mirrors dispatchTopicResearchJob. */
export async function dispatchCiabJob(job: CiabJob): Promise<void> {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("SLACK_SIGNING_SECRET is not configured.");
  }

  const res = await fetch(`${appBaseUrl()}/api/webhooks/slack/ciab-research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to queue CIAB job (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
}
