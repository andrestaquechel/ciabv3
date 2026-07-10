"use client";

import type { MiniBoxDocument } from "@/lib/mini-box";
import {
  BUILD_SECTION_ORDER,
  deriveSectionStatus,
} from "@/lib/mini-box";
import { StatusPill } from "@/components/builder/SectionNav";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";

export function ReviewPanel({
  document,
  onJump,
  onPublish,
}: {
  document: MiniBoxDocument;
  onJump: (id: "inputs" | "title" | "welcome" | "onePager" | "chat") => void;
  onPublish: () => void;
}) {
  const status = deriveSectionStatus(document, "review");
  const rows = BUILD_SECTION_ORDER.map((id) => ({
    id,
    label: document.sections[id].label,
    status: deriveSectionStatus(document, id),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Review</h2>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Check each section before publishing to Google Slides.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-5 scrollbar-thin">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Topic
          </div>
          <div className="mt-1 text-sm">
            {document.topic || (
              <span className="text-[var(--text-dim)]">No topic selected</span>
            )}
          </div>
          {document.articles.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
              {document.articles.map((a) => (
                <li key={a.id}>• {a.title || a.url || "Untitled article"}</li>
              ))}
            </ul>
          )}
        </div>

        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onJump(row.id as "inputs")}
            className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-left hover:border-[var(--accent)]/40"
          >
            <div className="flex items-center gap-2.5 text-sm">
              {row.status === "ready" ? (
                <CheckCircle2 size={14} className="text-[var(--success)]" />
              ) : row.status === "draft" ? (
                <CircleDot size={14} className="text-[var(--warning)]" />
              ) : (
                <Circle size={14} className="text-[var(--text-dim)]" />
              )}
              {row.label}
            </div>
            <StatusPill status={row.status} />
          </button>
        ))}

        <button
          type="button"
          onClick={onPublish}
          className="mt-2 w-full rounded-full bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-white hover:brightness-110"
        >
          Publish
        </button>
      </div>
    </div>
  );
}
