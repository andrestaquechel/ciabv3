import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  backfillTopicMemory,
  loadTopicMemory,
} from "@/lib/minibox-topic-memory";

/** Current topic-memory status (record count + newest/oldest window). */
export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to read the topic memory." },
      { status: 401 },
    );
  }
  try {
    const memory = await loadTopicMemory();
    const dated = memory.records.filter((r) => r.dateKey);
    return NextResponse.json({
      count: memory.records.length,
      updatedAt: memory.updatedAt,
      newest: dated[0]?.dateKey,
      oldest: dated[dated.length - 1]?.dateKey,
      records: memory.records.map((r) => ({
        title: r.title,
        dateKey: r.dateKey,
        topicSummary: r.topicSummary,
        keyExamples: r.keyExamples,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load topic memory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Backfill / refresh the topic memory from the existing full-text archive index
 * (no Drive re-scrape). Idempotent and batched: distills up to `maxPerRun` boxes
 * per call and reports how many remain — call again to finish a large archive.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to build the topic memory." },
      { status: 401 },
    );
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      maxPerRun?: number;
      model?: string;
    };
    const result = await backfillTopicMemory({
      maxPerRun: body.maxPerRun ?? 10,
      model: body.model,
    });
    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "No Mini Box archive folder configured, or it hasn't been indexed yet. Set the archive in Settings → Knowledge and click Build archive index first.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build topic memory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
