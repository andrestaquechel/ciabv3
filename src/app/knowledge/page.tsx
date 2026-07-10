"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import {
  getFolderConfig,
  setFolderConfig,
  parseDriveFolderId,
  type BoxType,
} from "@/lib/knowledge-store";
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
};

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const [boxType, setBoxType] = useState<BoxType>("mini-box");
  const [folderInput, setFolderInput] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const folderConfig = useMemo(
    () => getFolderConfig(boxType),
    [boxType, refreshKey],
  );

  useEffect(() => {
    if (folderConfig?.folderId && session?.accessToken) {
      void loadFiles(folderConfig.folderId);
    } else {
      setFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxType, session?.accessToken, folderConfig?.folderId]);

  async function loadFiles(folderId: string) {
    setLoadingFiles(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drive/files?folderId=${encodeURIComponent(folderId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  }

  function saveFolder() {
    const folderId = parseDriveFolderId(folderInput);
    if (!folderId) {
      setError("Paste a valid Google Drive folder link or ID.");
      return;
    }
    setFolderConfig(boxType, {
      folderId,
      folderUrl: folderInput.trim(),
      setAt: new Date().toISOString(),
    });
    setFolderInput("");
    setError(null);
    setRefreshKey((k) => k + 1);
    if (session?.accessToken) void loadFiles(folderId);
  }

  async function ask() {
    if (!folderConfig?.folderId || !question.trim()) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          boxType,
          folderId: folderConfig.folderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setAsking(false);
    }
  }

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center border-b border-[var(--border)] px-6">
          <span className="text-sm text-[var(--text-muted)]">Knowledge Base</span>
        </header>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-[var(--border)] p-3">
          {(["mini-box", "ciab"] as BoxType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBoxType(type)}
              className={`rounded-xl px-3 py-2.5 text-left text-sm ${
                boxType === type
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              {type === "mini-box" ? "Mini Box" : "CIAB"}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {status !== "authenticated" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
              <p className="text-sm text-[var(--text-muted)]">
                Connect Google to browse Drive folders and ask questions.
              </p>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/knowledge" })}
                className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
              >
                Connect Google
              </button>
            </div>
          ) : !folderConfig ? (
            <div className="mx-auto max-w-lg flex-1 p-8">
              <h2 className="text-lg font-medium">
                Set {boxType === "mini-box" ? "Mini Box" : "CIAB"} folder
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Paste a Google Drive folder link. This becomes the default for
                this box type (change later in Settings).
              </p>
              <input
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
              />
              {error && (
                <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
              )}
              <button
                type="button"
                onClick={saveFolder}
                className="mt-4 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
              >
                Save folder
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--border)] px-6 py-3 text-sm text-[var(--text-muted)]">
                Connected folder · {files.length} files · edit path in Settings
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                <div className="overflow-auto border-r border-[var(--border)] p-4 scrollbar-thin">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium">Folder contents</h3>
                    {loadingFiles && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                  </div>
                  <div className="space-y-2">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2"
                      >
                        <div className="truncate text-sm">{f.name}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                          {new Date(f.modifiedTime).toLocaleDateString()}
                        </div>
                        {f.webViewLink && (
                          <a
                            href={f.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--accent)]"
                          >
                            Open <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    ))}
                    {!loadingFiles && files.length === 0 && (
                      <p className="text-sm text-[var(--text-dim)]">
                        No files found in this folder.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    Ask the archive
                  </h3>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    e.g. &quot;Have we written a CIAB on API keys in the last 2
                    years?&quot;
                  </p>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    className="resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                    placeholder="Your question…"
                  />
                  <button
                    type="button"
                    disabled={asking || !question.trim()}
                    onClick={() => void ask()}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {asking ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Ask
                  </button>
                  {error && (
                    <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
                  )}
                  {answer && (
                    <div className="mt-4 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-sm leading-relaxed text-[var(--text-muted)] scrollbar-thin">
                      {answer}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
