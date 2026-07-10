import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFolderInfo,
  listDriveFolders,
  parseDriveFolderId,
} from "@/lib/google-drive";

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
    const infoId = parseDriveFolderId(searchParams.get("folderId") || "");
    if (infoId && searchParams.get("info") === "1") {
      const folder = await getFolderInfo(infoId);
      return NextResponse.json({ folder });
    }

    const parentId = parseDriveFolderId(searchParams.get("parentId") || "") ?? "root";
    const folders = await listDriveFolders(parentId);
    return NextResponse.json({ parentId, folders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Drive folders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
