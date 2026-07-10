import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFolderFiles, parseDriveFolderId } from "@/lib/google-drive";

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

    const files = await listFolderFiles(folderId);
    return NextResponse.json({ files });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Drive files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
