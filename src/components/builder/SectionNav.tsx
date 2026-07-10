"use client";

import { useMemo } from "react";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  AlertCircle,
  Rocket,
  PanelLeftClose,
} from "lucide-react";
import type {
  MiniBoxDocument,
  MiniBoxSectionId,
  SectionStatus,
} from "@/lib/mini-box";
import {
  BUILD_SECTION_ORDER,
  deriveSectionStatus,
} from "@/lib/mini-box";
import { useShell } from "@/components/layout/ShellContext";

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

function SectionItem({
  label,
  sublabel,
  status,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  status: SectionStatus;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
      }`}
    >
      {statusIcon(status)}
      <span className="min-w-0 truncate">
        {label}
        {sublabel && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-60">
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}

export function SectionNav({
  document,
  activeId,
  onSelect,
  onPublish,
  publishing,
}: {
  document: MiniBoxDocument;
  activeId: MiniBoxSectionId;
  onSelect: (id: MiniBoxSectionId) => void;
  onPublish: () => void;
  publishing?: boolean;
}) {
  const { sectionsHidden, toggleSections } = useShell();

  const ideateStatus = deriveSectionStatus(document, "ideate");
  const reviewStatus = deriveSectionStatus(document, "review");

  const buildItems = useMemo(
    () =>
      BUILD_SECTION_ORDER.map((id) => {
        const section = document.sections[id];
        const status = deriveSectionStatus(document, id);
        return { id, label: section.label, status };
      }),
    [document],
  );

  if (sectionsHidden) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--bg-elevated)] py-3">
        <button
          type="button"
          onClick={toggleSections}
          className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
          title="Show sections"
        >
          <PanelLeftClose size={16} className="rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Sections
          </div>
          <div className="mt-1 truncate text-sm font-medium">
            {document.title || "Untitled Mini Box"}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSections}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
          title="Hide sections"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 scrollbar-thin">
        <SectionItem
          label="Topic"
          sublabel="Ideate"
          status={ideateStatus}
          active={activeId === "ideate"}
          onClick={() => onSelect("ideate")}
        />

        <div className="mb-2 mt-3 px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          Build
        </div>

        {buildItems.map((item) => (
          <SectionItem
            key={item.id}
            label={item.label}
            status={item.status}
            active={item.id === activeId}
            onClick={() => onSelect(item.id)}
          />
        ))}

        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <SectionItem
            label="Review"
            sublabel="Review"
            status={reviewStatus}
            active={activeId === "review"}
            onClick={() => onSelect("review")}
          />

          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-strong)] px-3.5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Rocket size={14} />
            {publishing ? "Downloading…" : "Publish · PPTX"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: SectionStatus | string }) {
  const map: Record<string, string> = {
    empty: "border-[var(--border)] text-[var(--text-dim)]",
    draft:
      "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]",
    ready:
      "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]",
    error:
      "border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] || map.empty}`}
    >
      {status}
    </span>
  );
}
