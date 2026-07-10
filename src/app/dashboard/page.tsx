import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Download, Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center justify-between border-b border-[var(--border)] px-6">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="text-[var(--text)]">Workspace</span>
            <span className="mx-2 text-[var(--text-dim)]">/</span>
            Dashboard
          </div>
          <Link
            href="/builder/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            <Plus size={16} />
            New Box
          </Link>
        </header>
      }
    >
      <div className="h-full overflow-auto p-6 scrollbar-thin">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Box Studio</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Build Mini Boxes natively as PowerPoint. Download the PPTX when
            ready, then upload to Google Drive and open as Google Slides.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/builder/new"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 transition hover:border-[var(--accent)]/50"
          >
            <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">
              Mini Box
            </div>
            <h2 className="text-base font-medium group-hover:text-[var(--accent)]">
              Create Mini Box
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Ideate → Topics & Articles → sections → Review → download PPTX.
            </p>
          </Link>

          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-5 opacity-60">
            <div className="mb-3 inline-flex rounded-full bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-dim)]">
              Coming soon
            </div>
            <h2 className="text-base font-medium">Campaign in a Box</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Full CIAB workflow after Mini Box is solid.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              <Download size={12} />
              Export
            </div>
            <h2 className="text-base font-medium">PowerPoint → Drive</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Publish downloads a 7-slide Mini Box PPTX. Upload to Drive and
              open with Google Slides for distribution.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
