import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSlidesClient } from "@/lib/google";
import type { MiniBoxDocument } from "@/lib/mini-box";

/**
 * Sync Mini Box text fields into the Google Slides presentation.
 * Uses find/replace against known placeholder patterns and section labels.
 * Once you share the master template, we can map exact object IDs for precision.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to sync slides." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      presentationId: string;
      document: MiniBoxDocument;
    };

    if (!body.presentationId || !body.document) {
      return NextResponse.json(
        { error: "presentationId and document are required." },
        { status: 400 },
      );
    }

    const slides = await getSlidesClient();
    const { document } = body;
    const s = document.sections;

    const replacements: Array<{ find: string; replace: string }> = [
      { find: "{{TOPIC_TITLE}}", replace: s.title.topicTitle },
      { find: "{{WELCOME_INTRO}}", replace: s.welcome.intro },
      { find: "{{WELCOME_CONTENTS}}", replace: s.welcome.contents },
      { find: "{{WELCOME_CLOSING}}", replace: s.welcome.closing },
      { find: "{{SUBJECT_LINE}}", replace: s.onePager.subjectLine },
      { find: "{{ONE_PAGER_GREETING}}", replace: s.onePager.greeting },
      { find: "{{ONE_PAGER_BODY_1}}", replace: s.onePager.bodyPart1 },
      { find: "{{ONE_PAGER_BODY_2}}", replace: s.onePager.bodyPart2 },
      { find: "{{CHAT_MESSAGE}}", replace: s.chat.message },
      { find: "{{SIGNATURE}}", replace: document.signature },
    ];

    const requests = replacements
      .filter((r) => r.replace.trim().length > 0)
      .map((r) => ({
        replaceAllText: {
          containsText: { text: r.find, matchCase: true },
          replaceText: r.replace,
        },
      }));

    if (requests.length === 0) {
      return NextResponse.json({
        ok: true,
        synced: 0,
        note: "No filled fields to sync yet.",
      });
    }

    await slides.presentations.batchUpdate({
      presentationId: body.presentationId,
      requestBody: { requests },
    });

    return NextResponse.json({ ok: true, synced: requests.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync slides.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
