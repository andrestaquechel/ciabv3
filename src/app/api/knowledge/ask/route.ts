import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseDriveFolderId } from "@/lib/google-drive";
import type { IndexedDocument } from "@/lib/knowledge-cache";

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
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
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
        answer: `Searched ${indexed.length} indexed documents. Name/content matches: ${matches.slice(0, 8).map((m) => m.path || m.name).join(", ") || "none"}. Add OPENAI_API_KEY for full answers.`,
        fileCount: indexed.length,
        matchCount: matches.length,
      });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You answer questions about Living Security ${body.boxType === "ciab" ? "Campaign in a Box (CIAB)" : "Mini Box"} content from an indexed Google Drive archive. Cite specific file names and paths when relevant. If nothing matches, say so clearly. Today is ${new Date().toISOString().slice(0, 10)}.`,
          },
          {
            role: "user",
            content: `Question: ${body.question}\n\nIndexed archive (${indexed.length} documents):\n${context}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? "No answer.";

    return NextResponse.json({
      source: "openai",
      answer,
      fileCount: indexed.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Knowledge query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
