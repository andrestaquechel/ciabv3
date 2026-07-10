import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  indexArchiveRecursive,
  listFolderEntries,
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
      error instanceof Error ? error.message : "Failed to list Drive folder.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to index the archive." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      folderId?: string;
      boxType?: "mini-box" | "ciab";
    };
    const folderId = parseDriveFolderId(body.folderId || "");
    if (!folderId) {
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
    }

    const documents = await indexArchiveRecursive(folderId);
    return NextResponse.json({
      folderId,
      boxType: body.boxType || "mini-box",
      indexedAt: new Date().toISOString(),
      count: documents.length,
      documents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to index archive.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
