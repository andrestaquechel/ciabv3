import Link from "next/link";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

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
          <h1 className="text-xl font-semibold tracking-tight">
            Welcome
            {session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Build Mini Boxes with topic + article inputs, AI drafts, Giphy, and
            live preview. Connect Google when you&apos;re ready to sync Slides.
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
              Topic + articles → Welcome, One-Pager, Chat + GIF slots. Local
              render updates as you edit.
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
            <div className="mb-3 inline-flex rounded-full bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              Connection
            </div>
            <h2 className="text-base font-medium">Google Slides</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {session?.user?.email ? (
                <>
                  Signed in as{" "}
                  <span className="text-[var(--text)]">{session.user.email}</span>.
                </>
              ) : (
                <>
                  Not connected yet.{" "}
                  <Link href="/login" className="text-[var(--accent)]">
                    Connect Google
                  </Link>{" "}
                  to copy templates into Drive.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
