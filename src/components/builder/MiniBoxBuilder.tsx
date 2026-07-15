"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";
import { AppShell } from "@/components/layout/AppShell";
import { SectionNav } from "@/components/builder/SectionNav";
import { SectionEditor } from "@/components/builder/SectionEditor";
import { IdeatePanel } from "@/components/builder/IdeatePanel";
import { ReviewPanel } from "@/components/builder/ReviewPanel";
import { PptPreview } from "@/components/builder/PptPreview";
import { BuilderTopBar } from "@/components/builder/BuilderTopBar";
import { BuilderSplitPane } from "@/components/builder/BuilderSplitPane";
import {
  createBox,
  loadBox,
  loadPreviewSplitPreference,
  loadSyncPreviewPreference,
  saveBox,
  savePreviewSplitPreference,
  saveSyncPreviewPreference,
  type BoxKind,
} from "@/lib/box-store";
import { applyGeneratedMiniBoxToDocument } from "@/lib/mini-box";

async function downloadPptx(doc: MiniBoxDocument) {
  const res = await fetch("/api/pptx/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: doc }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || "Failed to export PowerPoint.",
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || "Mini-Box.pptx";

  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return filename;
}

export function MiniBoxBuilder({ initialId }: { initialId: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-[var(--text-muted)]">
          <Loader2 className="animate-spin" size={20} />
        </div>
      }
    >
      <MiniBoxBuilderInner initialId={initialId} />
    </Suspense>
  );
}

function MiniBoxBuilderInner({ initialId }: { initialId: string }) {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const topicParam = searchParams.get("topic");
  const autoGenerate = searchParams.get("autoGenerate") === "1";
  const [document, setDocument] = useState<MiniBoxDocument | null>(null);
  const [activeSection, setActiveSection] =
    useState<MiniBoxSectionId>("title");
  const [syncPreview, setSyncPreview] = useState(true);
  const [previewSplit, setPreviewSplit] = useState(46);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSyncPreview(loadSyncPreviewPreference());
    setPreviewSplit(loadPreviewSplitPreference());
  }, []);

  useEffect(() => {
    if (initialId !== "new") {
      const existing = loadBox(initialId);
      setDocument(existing || createBox("mini-box"));
      return;
    }

    async function initNewBox() {
      if (draftId) {
        try {
          const res = await fetch(`/api/boxes/draft/${encodeURIComponent(draftId)}`);
          const data = await res.json();
          if (res.ok && data.draft) {
            const doc = createBox("mini-box", data.draft.topic);
            const merged = applyGeneratedMiniBoxToDocument(
              doc,
              data.draft.topic,
              data.draft.outline,
              data.draft.sections,
              data.draft.gifs,
            );
            setDocument(merged);
            saveBox(merged);
            window.history.replaceState(null, "", `/builder/${merged.id}`);
            return;
          }
        } catch {
          // fall through to empty box
        }
      }

      const doc = createBox("mini-box", topicParam || "");
      if (topicParam) {
        doc.sections.title.topicTitle = topicParam;
      }
      setDocument(doc);
      saveBox(doc);
      window.history.replaceState(null, "", `/builder/${doc.id}`);
    }

    void initNewBox();
  }, [initialId, draftId, topicParam]);

  const updateDoc = useCallback((next: MiniBoxDocument) => {
    setDocument(next);
    saveBox(next);
  }, []);

  function handlePreviewSplitChange(percent: number) {
    setPreviewSplit(percent);
    savePreviewSplitPreference(percent);
  }

  function handleSyncPreviewChange(enabled: boolean) {
    setSyncPreview(enabled);
    saveSyncPreviewPreference(enabled);
  }

  function handleRename(title: string) {
    if (!document) return;
    updateDoc({
      ...document,
      title,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSwitchBox(id: string) {
    window.location.href = `/builder/${id}`;
  }

  function handleNewBox(kind: BoxKind) {
    const doc = createBox(kind);
    saveBox(doc);
    window.location.href = `/builder/${doc.id}`;
  }

  async function publish() {
    if (!document) return;
    setPublishing(true);
    setError(null);
    setMessage(null);
    setActiveSection("review");

    try {
      const filename = await downloadPptx(document);
      updateDoc({
        ...document,
        status: "published",
        updatedAt: new Date().toISOString(),
      });
      setMessage(
        `Downloaded ${filename}. Upload it to Google Drive → Open with Google Slides when you're ready.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (!document) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <AppShell
      topBar={
        <BuilderTopBar
          document={document}
          syncPreview={syncPreview}
          onSyncPreviewChange={handleSyncPreviewChange}
          onRename={handleRename}
          onSwitchBox={handleSwitchBox}
          onNewBox={handleNewBox}
        />
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

        <BuilderSplitPane
          previewPercent={previewSplit}
          onPreviewPercentChange={handlePreviewSplitChange}
          editor={
            <>
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
              {activeSection === "title" ? (
                <IdeatePanel
                  document={document}
                  onChange={updateDoc}
                  autoGenerate={autoGenerate}
                />
              ) : activeSection === "review" ? (
                <ReviewPanel
                  document={document}
                  onJump={(id) => setActiveSection(id)}
                  onPublish={() => void publish()}
                />
              ) : (
                <SectionEditor
                  document={document}
                  sectionId={
                    activeSection as "welcome" | "onePagerP1" | "onePagerP2" | "chat"
                  }
                  onChange={updateDoc}
                />
              )}
            </>
          }
          preview={
            <PptPreview
              document={document}
              activeSection={activeSection}
              syncPreview={syncPreview}
              boxType={document.type}
            />
          }
        />
      </div>
    </AppShell>
  );
}
