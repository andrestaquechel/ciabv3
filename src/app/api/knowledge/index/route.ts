import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  countArchiveFiles,
  indexArchiveRecursive,
  listFolderEntries,
  parseDriveFolderId,
} from "@/lib/google-drive";
import { saveKnowledgeIndexToDrive } from "@/lib/box-studio-drive-data";
import type { KnowledgeIndex } from "@/lib/knowledge-cache";

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
      stream?: boolean;
    };
    const folderId = parseDriveFolderId(body.folderId || "");
    if (!folderId) {
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
    }
    const boxType = body.boxType || "mini-box";

    if (!body.stream) {
      const documents = await indexArchiveRecursive(folderId);
      const index: KnowledgeIndex = {
        folderId,
        boxType,
        indexedAt: new Date().toISOString(),
        documents,
      };
      await saveKnowledgeIndexToDrive(index);
      return NextResponse.json({
        folderId,
        boxType,
        indexedAt: index.indexedAt,
        count: documents.length,
        documents,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          send({ type: "scanning", message: "Counting files in archive…" });
          const total = await countArchiveFiles(folderId);
          send({ type: "total", total });

          const documents = await indexArchiveRecursive(
            folderId,
            "",
            250,
            (event) => {
              if (event.type !== "progress") return;
              send({
                type: "progress",
                current: event.current,
                total: event.total,
                fileName: event.fileName,
                path: event.path,
              });
            },
            total,
          );

          const indexedAt = new Date().toISOString();
          const index: KnowledgeIndex = {
            folderId,
            boxType,
            indexedAt,
            documents,
          };
          await saveKnowledgeIndexToDrive(index);

          send({
            type: "complete",
            folderId,
            boxType,
            indexedAt,
            count: documents.length,
            documents,
          });
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to index archive.";
          send({ type: "error", error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to index archive.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
