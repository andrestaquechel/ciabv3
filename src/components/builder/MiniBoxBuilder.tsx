"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";
import { AppShell } from "@/components/layout/AppShell";
import { SectionNav } from "@/components/builder/SectionNav";
import { SectionEditor } from "@/components/builder/SectionEditor";
import { TopicArticlesEditor } from "@/components/builder/TopicArticlesEditor";
import { IdeatePanel } from "@/components/builder/IdeatePanel";
import { ReviewPanel } from "@/components/builder/ReviewPanel";
import { PptPreview } from "@/components/builder/PptPreview";
import { BuilderTopBar } from "@/components/builder/BuilderTopBar";
import {
  createBox,
  loadBox,
  loadSyncPreviewPreference,
  saveBox,
  saveSyncPreviewPreference,
  type BoxKind,
} from "@/lib/box-store";

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
  const [document, setDocument] = useState<MiniBoxDocument | null>(null);
  const [activeSection, setActiveSection] =
    useState<MiniBoxSectionId>("ideate");
  const [syncPreview, setSyncPreview] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSyncPreview(loadSyncPreviewPreference());
  }, []);

  useEffect(() => {
    if (initialId === "new") {
      const doc = createBox("mini-box");
      setDocument(doc);
      saveBox(doc);
      window.history.replaceState(null, "", `/builder/${doc.id}`);
      return;
    }
    const existing = loadBox(initialId);
    setDocument(existing || createBox("mini-box"));
  }, [initialId]);

  const updateDoc = useCallback((next: MiniBoxDocument) => {
    setDocument(next);
    saveBox(next);
  }, []);

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
                sectionId={activeSection as "title" | "welcome" | "onePager" | "chat"}
                onChange={updateDoc}
              />
            )}
          </div>

          <div className="hidden w-[46%] min-w-[360px] p-4 xl:block">
            <PptPreview
              document={document}
              activeSection={activeSection}
              syncPreview={syncPreview}
              boxType={document.type}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
