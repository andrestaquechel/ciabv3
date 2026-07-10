"use client";

import { ExternalLink, RefreshCw } from "lucide-react";

export function SlidesPreview({
  presentationId,
  refreshKey,
  onRefresh,
}: {
  presentationId: string | null;
  refreshKey: number;
  onRefresh: () => void;
}) {
  if (!presentationId) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Google Slides preview
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Create a deck from the Mini Box template to see a live preview here.
          </p>
          <p className="text-xs text-[var(--text-dim)]">
            Requires Google login + <code>MINI_BOX_TEMPLATE_ID</code> in env.
          </p>
        </div>
      </div>
    );
  }

  const embedUrl = `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=60000&rm=minimal`;
  const editUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Google Slides preview
          </div>
          <div className="text-xs text-[var(--text-muted)]">Live deck · sync after edits</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <a
            href={editUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ExternalLink size={12} />
            Open
          </a>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-[#0a0a0c]">
        <iframe
          key={`${presentationId}-${refreshKey}`}
          title="Google Slides preview"
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
