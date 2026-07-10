"use client";

import { useMemo } from "react";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  MiniBoxDocument,
  MiniBoxSectionId,
  SectionStatus,
} from "@/lib/mini-box";
import { SECTION_ORDER, deriveSectionStatus } from "@/lib/mini-box";

const statusIcon = (status: SectionStatus) => {
  switch (status) {
    case "ready":
      return <CheckCircle2 size={14} className="text-[var(--success)]" />;
    case "draft":
      return <CircleDot size={14} className="text-[var(--warning)]" />;
    case "error":
      return <AlertCircle size={14} className="text-[var(--danger)]" />;
    default:
      return <Circle size={14} className="text-[var(--text-dim)]" />;
  }
};

export function SectionNav({
  document,
  activeId,
  onSelect,
}: {
  document: MiniBoxDocument;
  activeId: MiniBoxSectionId;
  onSelect: (id: MiniBoxSectionId) => void;
}) {
  const items = useMemo(
    () =>
      SECTION_ORDER.map((id) => {
        const section = document.sections[id];
        const status = deriveSectionStatus(document, id);
        return { id, label: section.label, status };
      }),
    [document],
  );

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          Sections
        </div>
        <div className="mt-1 truncate text-sm font-medium">
          {document.title || "Untitled Mini Box"}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
              }`}
            >
              {statusIcon(item.status)}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkflowTabs({
  active = "build",
}: {
  active?: "topic" | "build" | "review" | "publish";
}) {
  const tabs = [
    { id: "topic", label: "Topic", sub: "Ideate" },
    { id: "build", label: "Build", sub: "Create" },
    { id: "review", label: "Review", sub: "Review" },
    { id: "publish", label: "Publish", sub: "Publish" },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            className={`rounded-full border px-3.5 py-1.5 text-xs ${
              isActive
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            <span className="font-medium">{tab.label}</span>
            <span className="ml-1.5 uppercase tracking-wide opacity-70">
              {tab.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatusPill({ status }: { status: SectionStatus | string }) {
  const map: Record<string, string> = {
    empty: "border-[var(--border)] text-[var(--text-dim)]",
    draft: "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]",
    ready: "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]",
    error: "border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] || map.empty}`}
    >
      {status}
    </span>
  );
}
