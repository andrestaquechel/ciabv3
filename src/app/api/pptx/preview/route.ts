import { NextResponse } from "next/server";
import type { MiniBoxDocument } from "@/lib/mini-box";
import { buildMiniBoxFromTemplate } from "@/lib/pptx/template-export";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { document?: MiniBoxDocument };
    if (!body.document) {
      return NextResponse.json({ error: "document required" }, { status: 400 });
    }
    const buffer = await buildMiniBoxFromTemplate(body.document);
    return NextResponse.json({
      pptxBase64: buffer.toString("base64"),
      slideCount: 7,
      template: "shadow-ai-mini-box",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
