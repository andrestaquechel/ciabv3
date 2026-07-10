"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { DriveFolderPicker } from "@/components/knowledge/DriveFolderPicker";
import {
  getFolderConfig,
  setFolderConfig,
  parseDriveFolderId,
  type BoxType,
} from "@/lib/knowledge-store";
import {
  loadKnowledgeIndex,
  saveKnowledgeIndex,
  type KnowledgeIndex,
} from "@/lib/knowledge-cache";
import {
  ChevronRight,
  Database,
  ExternalLink,
  Folder,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  isFolder?: boolean;
};

type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

type BrowseCrumb = { id: string; name: string };

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const [boxType, setBoxType] = useState<BoxType>("mini-box");
  const [folderInput, setFolderInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [folders, setFolders] = useState<DriveEntry[]>([]);
  const [files, setFiles] = useState<DriveEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BrowseCrumb[]>([]);
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [archiveIndex, setArchiveIndex] = useState<KnowledgeIndex | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const folderConfig = useMemo(
    () => getFolderConfig(boxType),
    [boxType, refreshKey],
  );

  const loadBrowse = useCallback(async (folderId: string) => {
    setLoadingFiles(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drive/files?folderId=${encodeURIComponent(folderId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load folder");
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder");
      setFolders([]);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!folderConfig?.folderId || !session?.accessToken) {
      setFolders([]);
      setFiles([]);
      setBrowseFolderId(null);
      setBreadcrumbs([]);
      setArchiveIndex(null);
      return;
    }
    setBrowseFolderId(folderConfig.folderId);
    setBreadcrumbs([
      {
        id: folderConfig.folderId,
        name: folderConfig.folderName || "Archive root",
      },
    ]);
    void loadBrowse(folderConfig.folderId);
    setArchiveIndex(loadKnowledgeIndex(boxType, folderConfig.folderId));
  }, [boxType, session?.accessToken, folderConfig?.folderId, folderConfig?.folderName, loadBrowse]);

  function openSubfolder(folder: DriveEntry) {
    setBrowseFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadBrowse(folder.id);
  }

  function goToCrumb(index: number) {
    const crumb = breadcrumbs[index];
    if (!crumb) return;
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setBrowseFolderId(crumb.id);
    void loadBrowse(crumb.id);
  }

  function applyFolder(folder: DriveFolder) {
    setFolderConfig(boxType, {
      folderId: folder.id,
      folderUrl:
        folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
      folderName: folder.name,
      setAt: new Date().toISOString(),
    });
    setFolderInput("");
    setShowPicker(false);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  function saveFolderFromUrl() {
    const folderId = parseDriveFolderId(folderInput);
    if (!folderId) {
      setError("Paste a valid Google Drive folder link or ID.");
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/drive/folders?folderId=${encodeURIComponent(folderId)}&info=1`,
        );
        const data = await res.json();
        if (res.ok && data.folder) {
          applyFolder(data.folder);
          return;
        }
      } catch {
        // fall through
      }
      applyFolder({
        id: folderId,
        name: "Drive folder",
        webViewLink: folderInput.trim(),
      });
    })();
  }

  async function buildArchiveIndex() {
    if (!folderConfig?.folderId) return;
    setIndexing(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: folderConfig.folderId,
          boxType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Indexing failed");
      const index: KnowledgeIndex = {
        folderId: folderConfig.folderId,
        boxType,
        indexedAt: data.indexedAt,
        documents: data.documents,
      };
      saveKnowledgeIndex(index);
      setArchiveIndex(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexing(false);
    }
  }

  async function ask() {
    if (!folderConfig?.folderId || !question.trim()) return;
    if (!archiveIndex?.documents.length) {
      setError("Build the archive index first to scan nested folders and document content.");
      return;
    }
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
          index: archiveIndex.documents,
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

  const folderLabel = folderConfig?.folderName || "Archive folder";

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
          ) : !folderConfig || showPicker ? (
            <div className="mx-auto max-w-lg flex-1 overflow-auto p-8 scrollbar-thin">
              <h2 className="text-lg font-medium">
                {folderConfig ? "Change" : "Set"}{" "}
                {boxType === "mini-box" ? "Mini Box" : "CIAB"} archive folder
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Browse your Google Drive folders or paste a folder link.
              </p>
              <div className="mt-5">
                <DriveFolderPicker onSelect={applyFolder} />
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-dim)]">
                <div className="h-px flex-1 bg-[var(--border)]" />
                or paste a link
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <input
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
              />
              {error && (
                <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={saveFolderFromUrl}
                  className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
                >
                  Save folder
                </button>
                {folderConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPicker(false);
                      setError(null);
                    }}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3 text-sm">
                <span className="truncate text-[var(--text-muted)]">
                  {folderLabel}
                  {archiveIndex
                    ? ` · ${archiveIndex.documents.length} docs indexed`
                    : " · not indexed yet"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={indexing}
                    onClick={() => void buildArchiveIndex()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--accent)] disabled:opacity-50"
                  >
                    {indexing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Database size={12} />
                    )}
                    {indexing ? "Indexing…" : "Build archive index"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Change folder
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                <div className="flex min-h-0 flex-col overflow-hidden border-r border-[var(--border)]">
                  <div className="border-b border-[var(--border)] px-4 py-2">
                    <nav className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
                      {breadcrumbs.map((crumb, i) => (
                        <span key={crumb.id} className="inline-flex items-center gap-1">
                          {i > 0 && (
                            <ChevronRight size={12} className="opacity-50" />
                          )}
                          <button
                            type="button"
                            onClick={() => goToCrumb(i)}
                            className="rounded hover:text-[var(--accent)]"
                          >
                            {crumb.name}
                          </button>
                        </span>
                      ))}
                    </nav>
                  </div>
                  <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium">Browse archive</h3>
                      {loadingFiles && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => openSubfolder(f)}
                          className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-left hover:border-[var(--accent)]/40"
                        >
                          <Folder size={14} className="shrink-0 text-[var(--accent)]" />
                          <span className="truncate text-sm">{f.name}</span>
                        </button>
                      ))}
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
                      {!loadingFiles && folders.length === 0 && files.length === 0 && (
                        <p className="text-sm text-[var(--text-dim)]">
                          This folder is empty.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    Ask the archive
                  </h3>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Index once to scan all nested folders and document content.
                    Questions then search the cached archive instantly.
                  </p>
                  {archiveIndex && (
                    <p className="mb-3 text-[10px] text-[var(--text-dim)]">
                      Last indexed{" "}
                      {new Date(archiveIndex.indexedAt).toLocaleString()} ·{" "}
                      {archiveIndex.documents.length} documents
                    </p>
                  )}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    className="resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                    placeholder="e.g. Have we written about shadow AI before?"
                  />
                  <button
                    type="button"
                    disabled={asking || !question.trim() || indexing}
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
