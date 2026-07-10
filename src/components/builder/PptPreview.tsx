"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";

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
  if (section === "ideate" || section === "inputs" || section === "title")
    return 0;
  if (section === "welcome") return 1;
  if (section === "onePager") return 3;
  if (section === "chat") return 6;
  return 0;
}

type PreviewData = {
  slides: string[][];
  gifs: { welcome: string | null; onePager: string | null; chat: string | null };
};

function TemplateSlide({
  slideIndex,
  blocks,
  gifUrl,
}: {
  slideIndex: number;
  blocks: string[];
  gifUrl?: string | null;
}) {
  const isDivider = slideIndex === 2 || slideIndex === 5;
  const isCover = slideIndex === 0;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-white text-[#1a1a1a] shadow-inner">
      {/* Living Security template chrome */}
      <div className="absolute left-0 top-0 h-full w-1 bg-[#6B2D5C]" />
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#6B2D5C] via-[#8B3A72] to-[#C4A574]" />

      {isDivider ? (
        <div className="flex h-full items-center justify-center px-8">
          <h3 className="text-3xl font-semibold tracking-tight text-[#2d2d2d]">
            {blocks[0] || SLIDE_LABELS[slideIndex]}
          </h3>
        </div>
      ) : isCover ? (
        <div className="flex h-full flex-col justify-center px-10 py-8">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6B2D5C]">
            Mini Box
          </div>
          <h3 className="mt-4 text-2xl font-bold leading-tight text-[#1a1a1a]">
            {blocks[0] || "Topic title"}
          </h3>
          <div className="mt-8 space-y-1 text-sm text-[#555]">
            {(blocks[1] || "Welcome Message for Program Owners\nOne-Pager\nChat")
              .split("\n")
              .map((line) => (
                <div key={line}>{line}</div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full gap-4 px-8 py-6">
          <div className="min-w-0 flex-1 overflow-auto scrollbar-thin">
            {blocks.map((block, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap leading-relaxed ${
                  i === 0 && slideIndex !== 7
                    ? "mb-3 text-sm font-semibold text-[#6B2D5C]"
                    : "mb-2 text-[13px] text-[#333]"
                }`}
              >
                {block}
              </p>
            ))}
          </div>
          {gifUrl && (
            <div className="w-[28%] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gifUrl}
                alt=""
                className="h-full max-h-40 w-full rounded object-cover"
              />
              <div className="mt-1 text-center text-[10px] text-[#888]">
                Via Giphy
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PptPreview({
  document,
  activeSection,
}: {
  document: MiniBoxDocument;
  activeSection: MiniBoxSectionId;
}) {
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIndex(sectionToSlideIndex(activeSection));
  }, [activeSection]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pptx/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document }),
        });
        const data = await res.json();
        if (res.ok) setPreview(data);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [document]);

  const gifForSlide = useMemo(() => {
    if (!preview) return null;
    if (index === 1) return preview.gifs.welcome;
    if (index === 3) return preview.gifs.onePager;
    if (index === 6) return preview.gifs.chat;
    return null;
  }, [preview, index]);

  const blocks = preview?.slides[index] ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Mini Box template preview
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
            disabled={index === 0}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(6, i + 1))}
            disabled={index === 6}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#ececec] p-4">
        <TemplateSlide
          slideIndex={index}
          blocks={blocks}
          gifUrl={gifForSlide}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2 scrollbar-thin">
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
