import { NextResponse } from "next/server";
import { assertSlackSignature } from "@/lib/slack/verify";
import { startNewboxWizard } from "@/lib/slack/newbox-handlers";
import { parseMonthInput } from "@/lib/annual-calendar-types";

export const runtime = "nodejs";

function parseSlackBody(rawBody: string, contentType: string | null) {
  if (contentType?.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
}

const HELP_TEXT = `*New box wizard* (\`/newbox\`)
1. Choose *Mini Box* or *CIAB*
2. Pick a month (dropdown or type month name)
3. Mini Box → 6 topics in a table → select → outline → full box → CSM review

*Shortcuts:*
• \`/newbox\` — step-by-step wizard
• \`/newbox mini-box july\` — skip to July topic research
• \`/newbox ciab march\` — show March CIAB calendar topic
• \`/newbox help\` — this message`;

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

    if (!rawText || sub === "help") {
      return NextResponse.json({
        response_type: "ephemeral",
        text: HELP_TEXT,
      });
    }

    let boxType: "mini-box" | "ciab" | undefined;
    if (sub === "mini-box" || sub === "minibox" || sub === "mini") {
      boxType = "mini-box";
    } else if (sub === "ciab") {
      boxType = "ciab";
    }

    const monthArg = boxType ? parts.slice(1).join(" ") : parts.join(" ");
    const month = monthArg ? parseMonthInput(monthArg) : null;

    if (payload.channel_id) {
      void startNewboxWizard({
        channel: payload.channel_id,
        threadTs: payload.message_ts || undefined,
        userId: payload.user_id,
        parsed: {
          boxType,
          month: month ? String(month.monthNumber) : monthArg || undefined,
        },
      });
    }

    if (boxType && month) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Starting ${boxType === "ciab" ? "CIAB" : "Mini Box"} for *${month.monthLabel}*…`,
      });
    }

    if (boxType) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `${boxType === "ciab" ? "CIAB" : "Mini Box"} selected — pick a month in the channel.`,
      });
    }

    return NextResponse.json({
      response_type: "ephemeral",
      text: "Starting new box wizard — choose Mini Box or CIAB in the channel.",
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
