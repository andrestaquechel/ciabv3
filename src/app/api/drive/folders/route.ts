import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFolderInfo,
  listDriveFolders,
  listSharedDrives,
  parseDriveFolderId,
  previewFolderContents,
  type DriveBrowseScope,
} from "@/lib/google-drive";

function parseScope(searchParams: URLSearchParams): DriveBrowseScope {
  const scope = searchParams.get("scope") || "my-drive";
  const parentId = parseDriveFolderId(searchParams.get("parentId") || "") ?? "root";
  const driveId = parseDriveFolderId(searchParams.get("driveId") || "");

  if (scope === "shared-with-me") {
    const nestedParent = searchParams.get("parentId");
    return {
      kind: "shared-with-me",
      parentId: nestedParent ? (parseDriveFolderId(nestedParent) ?? undefined) : undefined,
    };
  }

  if (scope === "shared-drive" && driveId) {
    return { kind: "shared-drive", driveId, parentId };
  }

  return { kind: "my-drive", parentId };
}

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

    if (infoId && searchParams.get("preview") === "1") {
      const limit = Math.min(
        Number(searchParams.get("limit") || "30"),
        50,
      );
      const preview = await previewFolderContents(infoId, limit);
      return NextResponse.json({ folderId: infoId, ...preview });
    }

    if (searchParams.get("sharedDrives") === "1") {
      const drives = await listSharedDrives();
      return NextResponse.json({ drives });
    }

    const browseScope = parseScope(searchParams);
    const folders = await listDriveFolders(browseScope);
    return NextResponse.json({ scope: browseScope, folders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Drive folders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
