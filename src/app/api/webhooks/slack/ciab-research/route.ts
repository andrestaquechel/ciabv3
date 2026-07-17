import { after } from "next/server";
import type { CiabJob } from "@/lib/slack/ciab-job";
import {
  handleCiabStart,
  handleCiabConceptSelection,
  handleCiabOutlineRegenerate,
  handleCiabOutlineApproval,
} from "@/lib/slack/ciab-handlers";

export const runtime = "nodejs";
// CIAB research runs Claude Opus + server-side web search, which regularly takes
// longer than a minute. 300s (5m, Vercel Pro max) gives it room the 60s
// interactions route does not have.
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runCiabJob(job: CiabJob): Promise<void> {
  switch (job.step) {
    case "concept":
      await handleCiabStart({
        workflowId: job.workflowId,
        channel: job.channel,
        threadTs: job.threadTs,
      });
      return;
    case "concept-select":
      await handleCiabConceptSelection({
        workflowId: job.workflowId,
        conceptId: job.conceptId,
        channel: job.channel,
        threadTs: job.threadTs,
      });
      return;
    case "outline-regenerate":
      await handleCiabOutlineRegenerate({
        workflowId: job.workflowId,
        channel: job.channel,
        threadTs: job.threadTs,
      });
      return;
    case "outline-approve":
      await handleCiabOutlineApproval({
        workflowId: job.workflowId,
        channel: job.channel,
        threadTs: job.threadTs,
        userId: job.userId,
      });
      return;
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let job: CiabJob;
  try {
    job = (await request.json()) as CiabJob;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!job.step || !job.workflowId || !job.channel) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  after(async () => {
    try {
      await runCiabJob(job);
    } catch (err) {
      console.error("Background CIAB job failed:", err);
    }
  });

  return new Response(JSON.stringify({ ok: true, queued: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}
