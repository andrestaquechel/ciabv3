"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Link2, Plus } from "lucide-react";
import type { MiniBoxDocument } from "@/lib/mini-box";
import {
  boxKindLabel,
  listBoxes,
  type BoxKind,
} from "@/lib/box-store";

export function BuilderTopBar({
  document,
  syncPreview,
  onSyncPreviewChange,
  onRename,
  onSwitchBox,
  onNewBox,
}: {
  document: MiniBoxDocument;
  syncPreview: boolean;
  onSyncPreviewChange: (enabled: boolean) => void;
  onRename: (title: string) => void;
  onSwitchBox: (id: string) => void;
  onNewBox: (kind: BoxKind) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(document.title);
  const [boxMenuOpen, setBoxMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [boxes, setBoxes] = useState<MiniBoxDocument[]>([]);
  const boxMenuRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleDraft(document.title);
  }, [document.title]);

  useEffect(() => {
    setBoxes(listBoxes());
  }, [document.id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxMenuRef.current && !boxMenuRef.current.contains(e.target as Node)) {
        setBoxMenuOpen(false);
      }
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    window.document.addEventListener("mousedown", onClickOutside);
    return () => window.document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function commitTitle() {
    const trimmed = titleDraft.trim() || `Untitled ${boxKindLabel(document.type)}`;
    onRename(trimmed);
    setEditingTitle(false);
  }

  const kindLabel = boxKindLabel(document.type);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <div className="relative" ref={boxMenuRef}>
          <button
            type="button"
            onClick={() => setBoxMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
            aria-expanded={boxMenuOpen}
            aria-haspopup="listbox"
          >
            Switch box
            <ChevronDown size={12} />
          </button>
          {boxMenuOpen && (
            <div
              role="listbox"
              className="absolute left-0 top-full z-50 mt-1 max-h-64 w-72 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-lg scrollbar-thin"
            >
              {boxes.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--text-dim)]">
                  No saved boxes yet.
                </p>
              ) : (
                boxes.map((box) => (
                  <button
                    key={box.id}
                    type="button"
                    role="option"
                    aria-selected={box.id === document.id}
                    onClick={() => {
                      onSwitchBox(box.id);
                      setBoxMenuOpen(false);
                    }}
                    className={`flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-[var(--bg-soft)] ${
                      box.id === document.id
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    <span className="font-medium">{box.title}</span>
                    <span className="text-[10px] opacity-70">
                      {boxKindLabel(box.type)} ·{" "}
                      {new Date(box.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={newMenuRef}>
          <button
            type="button"
            onClick={() => setNewMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <Plus size={12} />
            New
          </button>
          {newMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onNewBox("mini-box");
                  setNewMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-soft)]"
              >
                New Mini Box
              </button>
              <button
                type="button"
                onClick={() => {
                  onNewBox("ciab");
                  setNewMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-soft)]"
              >
                New CIAB
              </button>
            </div>
          )}
        </div>

        <span className="text-[var(--text-dim)]">/</span>
        <span className="shrink-0 text-[var(--text-muted)]">{kindLabel}</span>
        <span className="text-[var(--text-dim)]">/</span>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(document.title);
                setEditingTitle(false);
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-[var(--bg-elevated)] px-2 py-1 text-sm font-medium outline-none"
            aria-label="Box title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="min-w-0 truncate rounded-lg px-1 py-0.5 text-left font-medium hover:bg-[var(--bg-soft)]"
            title="Click to rename"
          >
            {document.title || `Untitled ${kindLabel}`}
          </button>
        )}
      </div>

      <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">
        <Link2 size={12} className={syncPreview ? "text-[var(--accent)]" : ""} />
        <span>Sync preview</span>
        <input
          type="checkbox"
          checked={syncPreview}
          onChange={(e) => onSyncPreviewChange(e.target.checked)}
          className="accent-[var(--accent)]"
          aria-label="Sync preview to selected section"
        />
      </label>
    </header>
  );
}
