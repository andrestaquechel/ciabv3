"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { DriveFolderPicker } from "@/components/knowledge/DriveFolderPicker";
import { AnnualTopicCalendarPanel } from "@/components/knowledge/AnnualTopicCalendarPanel";
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
import { fetchAppSettings, saveAppSettings } from "@/lib/app-settings-client";
import {
  loadKnowledgeSettings,
  saveKnowledgeSettings,
} from "@/lib/knowledge-store";
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
type KnowledgeTab = "annual-calendar" | BoxType;

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("annual-calendar");
  const [folderInput, setFolderInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [folders, setFolders] = useState<DriveEntry[]>([]);
  const [files, setFiles] = useState<DriveEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BrowseCrumb[]>([]);
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [archiveIndex, setArchiveIndex] = useState<KnowledgeIndex | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    phase: "scanning" | "indexing";
  } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const folderConfig = useMemo(
    () =>
      activeTab === "annual-calendar"
        ? null
        : getFolderConfig(activeTab),
    [activeTab, refreshKey],
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
    if (status !== "authenticated") return;
    void (async () => {
      const remote = await fetchAppSettings();
      if (remote?.knowledgeFolders) {
        const merged = {
          ...loadKnowledgeSettings(),
          ...remote.knowledgeFolders,
        };
        saveKnowledgeSettings(merged);
        setRefreshKey((k) => k + 1);
      }
    })();
  }, [status]);

  useEffect(() => {
    if (activeTab === "annual-calendar" || !folderConfig?.folderId || status !== "authenticated") {
      if (activeTab !== "annual-calendar" && !folderConfig?.folderId) {
        setArchiveIndex(null);
      }
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

    void (async () => {
      const local = loadKnowledgeIndex(activeTab, folderConfig.folderId);
      if (local) setArchiveIndex(local);

      try {
        const res = await fetch(
          `/api/knowledge/index/stored?folderId=${encodeURIComponent(folderConfig.folderId)}&boxType=${encodeURIComponent(activeTab)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { index?: KnowledgeIndex | null };
        if (data.index?.documents?.length) {
          setArchiveIndex(data.index);
          saveKnowledgeIndex(data.index);
        }
      } catch {
        // keep local cache if Drive fetch fails
      }
    })();
  }, [activeTab, status, folderConfig?.folderId, folderConfig?.folderName, loadBrowse]);

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
    if (activeTab === "annual-calendar") return;
    const config = {
      folderId: folder.id,
      folderUrl:
        folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
      folderName: folder.name,
      setAt: new Date().toISOString(),
    };
    setFolderConfig(activeTab, config);
    const merged = { ...loadKnowledgeSettings(), [activeTab]: config };
    saveKnowledgeSettings(merged);
    void saveAppSettings({ knowledgeFolders: merged }).catch(() => {});
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
    if (!folderConfig?.folderId || activeTab === "annual-calendar") return;
    const indexingBoxType: BoxType = activeTab;
    setIndexing(true);
    setIndexProgress({ current: 0, total: 0, fileName: "", phase: "scanning" });
    setError(null);
    try {
      const res = await fetch("/api/knowledge/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: folderConfig.folderId,
          boxType: indexingBoxType,
          stream: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Indexing failed");
      }
      if (!res.body) throw new Error("Indexing failed — no response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completePayload: {
        folderId: string;
        boxType: BoxType;
        indexedAt: string;
        documents: KnowledgeIndex["documents"];
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            total?: number;
            current?: number;
            fileName?: string;
            path?: string;
            error?: string;
            folderId?: string;
            boxType?: BoxType;
            indexedAt?: string;
            documents?: KnowledgeIndex["documents"];
          };

          if (event.type === "scanning") {
            setIndexProgress({
              current: 0,
              total: 0,
              fileName: "",
              phase: "scanning",
            });
          } else if (event.type === "total" && event.total != null) {
            setIndexProgress({
              current: 0,
              total: event.total,
              fileName: "",
              phase: "indexing",
            });
          } else if (
            event.type === "progress" &&
            event.current != null &&
            event.total != null
          ) {
            setIndexProgress({
              current: event.current,
              total: event.total,
              fileName: event.fileName || event.path || "",
              phase: "indexing",
            });
          } else if (event.type === "error") {
            throw new Error(event.error || "Indexing failed");
          } else if (event.type === "complete" && event.documents) {
            completePayload = {
              folderId: event.folderId || folderConfig.folderId,
              boxType: event.boxType || indexingBoxType,
              indexedAt: event.indexedAt || new Date().toISOString(),
              documents: event.documents,
            };
          }
        }
      }

      if (!completePayload) throw new Error("Indexing finished without results.");
      const index: KnowledgeIndex = {
        folderId: completePayload.folderId,
        boxType: completePayload.boxType,
        indexedAt: completePayload.indexedAt,
        documents: completePayload.documents,
      };
      saveKnowledgeIndex(index);
      setArchiveIndex(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexing(false);
      setIndexProgress(null);
    }
  }

  async function ask() {
    if (!folderConfig?.folderId || !question.trim() || activeTab === "annual-calendar") {
      return;
    }
    const queryBoxType: BoxType = activeTab;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          boxType: queryBoxType,
          folderId: folderConfig.folderId,
          index: archiveIndex?.documents,
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
        <div className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-[var(--border)] p-3">
          {(
            [
              { id: "annual-calendar" as const, label: "Annual Topic Calendar" },
              { id: "mini-box" as const, label: "Mini Box" },
              { id: "ciab" as const, label: "CIAB" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2.5 text-left text-sm leading-snug ${
                activeTab === tab.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeTab === "annual-calendar" ? (
            <AnnualTopicCalendarPanel />
          ) : status !== "authenticated" ? (
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
                {activeTab === "mini-box" ? "Mini Box" : "CIAB"} archive folder
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
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[var(--text-muted)]">
                    {folderLabel}
                    {archiveIndex
                      ? ` · ${archiveIndex.documents.length} docs indexed`
                      : " · not indexed yet"}
                  </span>
                  {indexProgress && (
                    <div className="mt-2 max-w-xl">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[var(--text-dim)]">
                        <span>
                          {indexProgress.phase === "scanning"
                            ? "Scanning folders to count files…"
                            : indexProgress.total > 0
                              ? `Document ${indexProgress.current} of ${indexProgress.total}`
                              : "Indexing…"}
                        </span>
                        {indexProgress.phase === "indexing" &&
                          indexProgress.total > 0 && (
                            <span>
                              {Math.round(
                                (indexProgress.current / indexProgress.total) *
                                  100,
                              )}
                              %
                            </span>
                          )}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                          style={{
                            width:
                              indexProgress.phase === "scanning"
                                ? "15%"
                                : indexProgress.total > 0
                                  ? `${Math.max(
                                      4,
                                      (indexProgress.current /
                                        indexProgress.total) *
                                        100,
                                    )}%`
                                  : "4%",
                          }}
                        />
                      </div>
                      {indexProgress.fileName && (
                        <p className="mt-1 truncate text-[10px] text-[var(--text-dim)]">
                          {indexProgress.fileName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                    The index is saved to Google Drive (shared for everyone).
                    Questions search that cached archive instantly.
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
