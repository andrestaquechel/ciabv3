"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CloudUpload, Loader2, Plus } from "lucide-react";
import {
  createEmptyMiniBox,
  type MiniBoxDocument,
  type MiniBoxSectionId,
} from "@/lib/mini-box";
import { AppShell } from "@/components/layout/AppShell";
import { SectionNav } from "@/components/builder/SectionNav";
import { SectionEditor } from "@/components/builder/SectionEditor";
import { TopicArticlesEditor } from "@/components/builder/TopicArticlesEditor";
import { IdeatePanel } from "@/components/builder/IdeatePanel";
import { ReviewPanel } from "@/components/builder/ReviewPanel";
import { SlidesPreview } from "@/components/builder/SlidesPreview";
import { LocalRenderPreview } from "@/components/builder/LocalRenderPreview";

const STORAGE_KEY = "box-studio:mini-boxes";

function migrateDoc(raw: MiniBoxDocument): MiniBoxDocument {
  const base = createEmptyMiniBox(raw.topic || raw.title || "");
  return {
    ...base,
    ...raw,
    articles: raw.articles || [],
    signature: raw.signature || "{{ SIGNATURE }}",
    sections: {
      ...base.sections,
      ...raw.sections,
      ideate: raw.sections?.ideate || base.sections.ideate,
      inputs: raw.sections?.inputs || base.sections.inputs,
      review: raw.sections?.review || base.sections.review,
    },
  };
}

function loadDoc(id: string): MiniBoxDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as MiniBoxDocument[];
    const found = all.find((d) => d.id === id);
    return found ? migrateDoc(found) : null;
  } catch {
    return null;
  }
}

function saveDoc(doc: MiniBoxDocument) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const all: MiniBoxDocument[] = raw ? JSON.parse(raw) : [];
  const idx = all.findIndex((d) => d.id === doc.id);
  if (idx >= 0) all[idx] = doc;
  else all.unshift(doc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function MiniBoxBuilder({ initialId }: { initialId: string }) {
  const { data: session, status } = useSession();
  const [document, setDocument] = useState<MiniBoxDocument | null>(null);
  const [activeSection, setActiveSection] =
    useState<MiniBoxSectionId>("ideate");
  const [previewMode, setPreviewMode] = useState<"local" | "slides">("local");
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialId === "new") {
      const doc = createEmptyMiniBox();
      setDocument(doc);
      saveDoc(doc);
      window.history.replaceState(null, "", `/builder/${doc.id}`);
      return;
    }
    const existing = loadDoc(initialId);
    setDocument(existing || createEmptyMiniBox());
  }, [initialId]);

  const updateDoc = useCallback((next: MiniBoxDocument) => {
    setDocument(next);
    saveDoc(next);
  }, []);

  async function createSlidesDeck() {
    if (!document) return;
    if (!session?.accessToken) {
      setError("Connect Google first to create a Slides deck.");
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/slides/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Mini Box — ${document.title || "Untitled"}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create deck");
      const next = {
        ...document,
        slidesPresentationId: data.presentationId as string,
        updatedAt: new Date().toISOString(),
      };
      updateDoc(next);
      setPreviewMode("slides");
      setMessage("Google Slides deck created from your template.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deck");
    } finally {
      setCreating(false);
    }
  }

  async function syncToSlides() {
    if (!document?.slidesPresentationId) {
      setError("Create a Slides deck first.");
      return;
    }
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/slides/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId: document.slidesPresentationId,
          document,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage(
        data.note ||
          `Synced ${data.synced} field(s) to Google Slides. Refresh preview if needed.`,
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function publish() {
    if (!document) return;
    setPublishing(true);
    setError(null);
    setMessage(null);
    setActiveSection("review");

    try {
      if (!session?.accessToken) {
        setError("Connect Google to publish to Slides. You can still review content locally.");
        updateDoc({
          ...document,
          status: "review",
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      let presentationId = document.slidesPresentationId;
      if (!presentationId) {
        const res = await fetch("/api/slides/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Mini Box — ${document.title || "Untitled"}`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create deck");
        presentationId = data.presentationId as string;
      }

      const nextDoc = {
        ...document,
        slidesPresentationId: presentationId,
        status: "published" as const,
        updatedAt: new Date().toISOString(),
      };

      const syncRes = await fetch("/api/slides/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId,
          document: nextDoc,
        }),
      });
      const syncData = await syncRes.json();
      if (!syncRes.ok) throw new Error(syncData.error || "Sync failed");

      updateDoc(nextDoc);
      setPreviewMode("slides");
      setRefreshKey((k) => k + 1);
      setMessage("Published — content synced to Google Slides.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (status === "loading" || !document) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--border)] px-5">
          <div className="min-w-0">
            <div className="truncate text-sm">
              <span className="text-[var(--text-muted)]">Mini Box</span>
              <span className="mx-2 text-[var(--text-dim)]">/</span>
              <span className="font-medium">
                {document.title || "Untitled"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status !== "authenticated" && (
              <Link
                href="/login"
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Connect Google
              </Link>
            )}
            {!document.slidesPresentationId ? (
              <button
                type="button"
                onClick={() => void createSlidesDeck()}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create Slides deck
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void syncToSlides()}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CloudUpload size={14} />
                )}
                Sync to Slides
              </button>
            )}
          </div>
        </header>
      }
    >
      <div className="flex h-full min-h-0">
        <SectionNav
          document={document}
          activeId={activeSection}
          onSelect={setActiveSection}
          onPublish={() => void publish()}
          publishing={publishing}
        />

        <div className="flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)]">
            {(error || message) && (
              <div
                className={`mx-5 mt-4 rounded-xl border px-3 py-2 text-sm ${
                  error
                    ? "border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
                }`}
              >
                {error || message}
              </div>
            )}
            {activeSection === "ideate" ? (
              <IdeatePanel
                document={document}
                onChange={updateDoc}
                onContinue={() => setActiveSection("inputs")}
              />
            ) : activeSection === "inputs" ? (
              <TopicArticlesEditor document={document} onChange={updateDoc} />
            ) : activeSection === "review" ? (
              <ReviewPanel
                document={document}
                onJump={(id) => setActiveSection(id)}
                onPublish={() => void publish()}
              />
            ) : (
              <SectionEditor
                document={document}
                sectionId={activeSection}
                onChange={updateDoc}
              />
            )}
          </div>

          <div className="hidden w-[46%] min-w-[360px] flex-col gap-3 p-4 xl:flex">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode("local")}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  previewMode === "local"
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                Local render
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("slides")}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  previewMode === "slides"
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                Google Slides
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {previewMode === "local" ? (
                <LocalRenderPreview
                  document={document}
                  activeSection={activeSection}
                />
              ) : (
                <SlidesPreview
                  presentationId={document.slidesPresentationId}
                  refreshKey={refreshKey}
                  onRefresh={() => setRefreshKey((k) => k + 1)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
