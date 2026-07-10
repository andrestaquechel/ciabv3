"use client";

import { useEffect, useState } from "react";
import type { AiSectionId } from "@/lib/claude-models";
import { CLAUDE_MODEL_OPTIONS } from "@/lib/claude-models";
import {
  loadSectionModelPreference,
  saveSectionModelPreference,
} from "@/lib/box-store";

export function ClaudeModelSelect({ sectionId }: { sectionId: AiSectionId }) {
  const [model, setModel] = useState(() =>
    loadSectionModelPreference(sectionId),
  );

  useEffect(() => {
    setModel(loadSectionModelPreference(sectionId));
  }, [sectionId]);

  return (
    <label className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] text-[var(--text-dim)]">Model</span>
      <select
        value={model}
        onChange={(e) => {
          saveSectionModelPreference(sectionId, e.target.value);
          setModel(e.target.value);
        }}
        className="max-w-[180px] truncate rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
      >
        {CLAUDE_MODEL_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
