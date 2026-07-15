import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadKnowledgeIndexFromDrive,
} from "@/lib/box-studio-drive-data";
import { parseDriveFolderId } from "@/lib/google-drive";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to load the archive index." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const folderId = parseDriveFolderId(searchParams.get("folderId") || "");
    const boxType = searchParams.get("boxType") as "mini-box" | "ciab" | null;
    if (!folderId || !boxType) {
      return NextResponse.json(
        { error: "folderId and boxType are required." },
        { status: 400 },
      );
    }

    const index = await loadKnowledgeIndexFromDrive(folderId);
    if (!index || index.boxType !== boxType) {
      return NextResponse.json({ index: null });
    }
    return NextResponse.json({ index });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load stored index.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
