import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseDriveFolderId } from "@/lib/google-drive";
import type { IndexedDocument } from "@/lib/knowledge-cache";
import {
  anthropicConfigured,
  anthropicText,
  anthropicMissingKeyMessage,
} from "@/lib/anthropic";

type Body = {
  question: string;
  boxType: "mini-box" | "ciab";
  folderId: string;
  index?: IndexedDocument[];
};

function buildContext(docs: IndexedDocument[], maxChars = 90000) {
  const snippets: string[] = [];
  let total = 0;
  for (const doc of docs) {
    const block = `FILE: ${doc.path || doc.name}\nMODIFIED: ${doc.modifiedTime}\n${doc.text}`.trim();
    if (total + block.length > maxChars) break;
    snippets.push(block);
    total += block.length;
  }
  return snippets.join("\n\n---\n\n");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to use the Knowledge Base." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Body;
    const folderId = parseDriveFolderId(body.folderId);
    if (!folderId || !body.question?.trim()) {
      return NextResponse.json(
        { error: "folderId and question are required." },
        { status: 400 },
      );
    }

    const indexed = body.index?.filter((d) => d.text?.trim()) ?? [];
    if (indexed.length === 0) {
      return NextResponse.json(
        {
          error:
            "No archive index loaded. Click “Build archive index” first to scan nested folders and cache document content.",
        },
        { status: 400 },
      );
    }

    const context = buildContext(indexed);

    if (!anthropicConfigured()) {
      const q = body.question.toLowerCase();
      const terms = q.split(/\s+/).filter((t) => t.length > 3);
      const matches = indexed.filter((d) =>
        terms.some(
          (t) =>
            d.name.toLowerCase().includes(t) ||
            d.text.toLowerCase().includes(t) ||
            d.path.toLowerCase().includes(t),
        ),
      );
      return NextResponse.json({
        source: "mock",
        answer: `Searched ${indexed.length} indexed documents. Name/content matches: ${matches.slice(0, 8).map((m) => m.path || m.name).join(", ") || "none"}. ${anthropicMissingKeyMessage()}`,
        fileCount: indexed.length,
        matchCount: matches.length,
      });
    }

    const answer = await anthropicText({
      system: `You answer questions about Living Security ${body.boxType === "ciab" ? "Campaign in a Box (CIAB)" : "Mini Box"} content from an indexed Google Drive archive. Cite specific file names and paths when relevant. If nothing matches, say so clearly. Today is ${new Date().toISOString().slice(0, 10)}.`,
      user: `Question: ${body.question}\n\nIndexed archive (${indexed.length} documents):\n${context}`,
      temperature: 0.2,
      maxTokens: 4096,
    });

    return NextResponse.json({
      source: "anthropic",
      answer,
      fileCount: indexed.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Knowledge query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
