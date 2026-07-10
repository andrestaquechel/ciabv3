import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFolderEntries, parseDriveFolderId } from "@/lib/google-drive";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to browse Drive folders." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const folderId = parseDriveFolderId(searchParams.get("folderId") || "");
    if (!folderId) {
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
    }

    const entries = await listFolderEntries(folderId);
    const folders = entries.filter((e) => e.isFolder);
    const files = entries.filter((e) => !e.isFolder);
    return NextResponse.json({ folderId, folders, files, entries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Drive files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
