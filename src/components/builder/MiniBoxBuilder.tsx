"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { PptPreview } from "@/components/builder/PptPreview";

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
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <header className="flex h-14 items-center border-b border-[var(--border)] px-5">
          <div className="truncate text-sm">
            <span className="text-[var(--text-muted)]">Mini Box</span>
            <span className="mx-2 text-[var(--text-dim)]">/</span>
            <span className="font-medium">
              {document.title || "Untitled"}
            </span>
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
                sectionId={activeSection as "title" | "welcome" | "onePager" | "chat"}
                onChange={updateDoc}
              />
            )}
          </div>

          <div className="hidden w-[46%] min-w-[360px] p-4 xl:block">
            <PptPreview document={document} activeSection={activeSection} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
