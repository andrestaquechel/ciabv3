"use client";

import { useCallback, useEffect, useRef } from "react";

const MIN_PREVIEW_PCT = 28;
const MAX_PREVIEW_PCT = 62;
const DEFAULT_PREVIEW_PCT = 46;

type BuilderSplitPaneProps = {
  editor: React.ReactNode;
  preview: React.ReactNode;
  previewPercent?: number;
  onPreviewPercentChange?: (percent: number) => void;
};

export function BuilderSplitPane({
  editor,
  preview,
  previewPercent = DEFAULT_PREVIEW_PCT,
  onPreviewPercentChange,
}: BuilderSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const clamp = useCallback((value: number) => {
    return Math.min(MAX_PREVIEW_PCT, Math.max(MIN_PREVIEW_PCT, value));
  }, []);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const previewWidth = rect.right - clientX;
      const pct = (previewWidth / rect.width) * 100;
      onPreviewPercentChange?.(clamp(pct));
    },
    [clamp, onPreviewPercentChange],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      e.preventDefault();
      updateFromClientX(e.clientX);
    }

    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [updateFromClientX]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const editorPct = 100 - previewPercent;

  return (
    <div ref={containerRef} className="flex min-w-0 flex-1">
      <div
        className="flex min-w-0 flex-col"
        style={{ width: `${editorPct}%` }}
      >
        {editor}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(previewPercent)}
        aria-label="Resize editor and preview panels"
        onMouseDown={startDrag}
        className="group relative z-10 hidden w-0 shrink-0 cursor-col-resize xl:block"
      >
        <div className="absolute inset-y-0 -left-1.5 w-3" />
        <div className="absolute inset-y-0 left-0 w-px bg-[var(--border)] transition-colors group-hover:bg-[var(--accent)] group-active:bg-[var(--accent)]" />
        <div className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--border)] opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
      </div>

      <div
        className="hidden min-w-[300px] p-4 xl:block"
        style={{ width: `${previewPercent}%` }}
      >
        {preview}
      </div>
    </div>
  );
}

export { DEFAULT_PREVIEW_PCT, MIN_PREVIEW_PCT, MAX_PREVIEW_PCT };
