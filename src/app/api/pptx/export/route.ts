import { NextResponse } from "next/server";
import type { MiniBoxDocument } from "@/lib/mini-box";
import {
  buildMiniBoxFromTemplate,
  pptxFilename,
} from "@/lib/pptx/template-export";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { document?: MiniBoxDocument };
    if (!body.document) {
      return NextResponse.json(
        { error: "document is required." },
        { status: 400 },
      );
    }

    const output = await buildMiniBoxFromTemplate(body.document);
    const filename = pptxFilename(body.document);

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build PowerPoint.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
