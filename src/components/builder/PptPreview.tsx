"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";
import { SLIDE_ASPECT } from "@/lib/pptx/slide-formatting";

const SLIDE_LABELS = [
  "Cover",
  "Welcome",
  "One-Pager",
  "One-Pager · email",
  "Email / tips",
  "Chats",
  "Chat",
];

function sectionToSlideIndex(section: MiniBoxSectionId): number {
  if (section === "title") return 0;
  if (section === "welcome") return 1;
  if (section === "onePagerP1") return 3;
  if (section === "onePagerP2") return 4;
  if (section === "chat") return 6;
  if (section === "review") return 6;
  return 0;
}

function fitSlideWidth(containerWidth: number, containerHeight: number): number {
  const widthFromHeight = containerHeight * SLIDE_ASPECT;
  return Math.floor(Math.min(containerWidth, widthFromHeight));
}

export function PptPreview({
  document,
  activeSection,
  syncPreview = true,
  boxType = "mini-box",
}: {
  document: MiniBoxDocument;
  activeSection: MiniBoxSectionId;
  syncPreview?: boolean;
  boxType?: "mini-box" | "ciab";
}) {
  const [index, setIndex] = useState(0);
  const [presentation, setPresentation] = useState<import("pptx-viewer").LoadedPresentation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const slideHostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (syncPreview) {
      setIndex(sectionToSlideIndex(activeSection));
    }
  }, [activeSection, syncPreview]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pptx/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Preview failed");

        const binary = atob(data.pptxBase64 as string);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const { loadPresentation } = await import("pptx-viewer");
        const loaded = await loadPresentation(bytes.buffer);
        setPresentation((prev) => {
          prev?.cleanup();
          return loaded;
        });
      } catch (err) {
        setPresentation(null);
        setError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [document]);

  useEffect(() => {
    return () => {
      presentation?.cleanup();
    };
  }, [presentation]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!presentation || !slideHostRef.current || containerSize.width <= 0) return;

    const host = slideHostRef.current;
    host.innerHTML = "";

    void (async () => {
      const { renderSlideToElement } = await import("pptx-viewer");
      const width = fitSlideWidth(containerSize.width, containerSize.height);
      renderSlideToElement(presentation, index, host, { width });
    })();
  }, [presentation, index, containerSize]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            {boxType === "ciab" ? "CIAB" : "Shadow AI Mini Box"} preview
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Slide {index + 1} of 7 · {SLIDE_LABELS[index]}
            {loading && <Loader2 size={12} className="animate-spin" />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0 || loading}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(6, i + 1))}
            disabled={index === 6 || loading}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#ececec] p-4"
      >
        {error && (
          <p className="absolute inset-x-4 top-4 z-10 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </p>
        )}
        {loading && !presentation && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <Loader2 size={16} className="animate-spin" />
            Building preview from Shadow AI template…
          </div>
        )}
        <div
          ref={slideHostRef}
          className="flex max-h-full max-w-full items-center justify-center overflow-hidden [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-auto"
        />
      </div>

      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2 scrollbar-thin">
        {SLIDE_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] ${
              i === index
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
    </div>
  );
}
