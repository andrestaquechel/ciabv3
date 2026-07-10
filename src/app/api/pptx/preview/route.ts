import { NextResponse } from "next/server";
import type { MiniBoxDocument } from "@/lib/mini-box";
import { extractTemplateSlideTexts } from "@/lib/pptx/template-export";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { document?: MiniBoxDocument };
    if (!body.document) {
      return NextResponse.json({ error: "document required" }, { status: 400 });
    }
    const slides = await extractTemplateSlideTexts(body.document);
    const gifs = {
      welcome: body.document.sections.welcome.gif?.previewUrl ?? null,
      onePager: body.document.sections.onePager.gif?.previewUrl ?? null,
      chat: body.document.sections.chat.gif?.previewUrl ?? null,
    };
    return NextResponse.json({ slides, gifs, template: "mini-box-master" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
