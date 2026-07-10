import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { copyMiniBoxTemplate } from "@/lib/google";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to create a Slides deck." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim() || "Untitled Mini Box";
    const presentationId = await copyMiniBoxTemplate(title);

    return NextResponse.json({
      presentationId,
      previewUrl: `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`,
      editUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create presentation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
