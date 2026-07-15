import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadGeneratedDraftFromDrive } from "@/lib/box-studio-drive-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to load generated drafts." },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Draft id required." }, { status: 400 });
    }

    const draft = await loadGeneratedDraftFromDrive(id.trim());
    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
