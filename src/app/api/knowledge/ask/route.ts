import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exportFileText,
  listFolderFiles,
  parseDriveFolderId,
} from "@/lib/google-drive";

type Body = {
  question: string;
  boxType: "mini-box" | "ciab";
  folderId: string;
};

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

    const files = await listFolderFiles(folderId);
    const relevant = files.slice(0, 40);

    const snippets: string[] = [];
    for (const file of relevant.slice(0, 15)) {
      if (!file.id || !file.mimeType || !file.name) continue;
      const text = await exportFileText(file.id, file.mimeType);
      snippets.push(
        `FILE: ${file.name}\nTYPE: ${file.mimeType}\nMODIFIED: ${file.modifiedTime}\n${text}`.trim(),
      );
    }

    const context = snippets.join("\n\n---\n\n");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const matches = relevant.filter((f) =>
        f.name?.toLowerCase().includes(body.question.toLowerCase().split(" ")[0]),
      );
      return NextResponse.json({
        source: "mock",
        answer: `Found ${relevant.length} files in this ${body.boxType} folder. Without OPENAI_API_KEY, here are recent matches by name: ${matches.map((f) => f.name).join(", ") || "none"}. Add OPENAI_API_KEY for full content-aware answers.`,
        fileCount: relevant.length,
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
            content: `You answer questions about Living Security ${body.boxType === "ciab" ? "Campaign in a Box (CIAB)" : "Mini Box"} content archived in Google Drive. Use file names, modified dates, and extracted text. If unsure, say what's missing. Today is ${new Date().toISOString().slice(0, 10)}.`,
          },
          {
            role: "user",
            content: `Question: ${body.question}\n\nDrive folder files and excerpts:\n${context}`,
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
      fileCount: relevant.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Knowledge query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
