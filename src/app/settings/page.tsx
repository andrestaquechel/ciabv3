import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center border-b border-[var(--border)] px-6 text-sm text-[var(--text-muted)]">
          Settings
        </header>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h1 className="text-base font-medium">Google connection</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Signed in as <span className="text-[var(--text)]">{session.user?.email}</span>.
            Slides and Drive scopes are granted via OAuth — no Google API key required.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-dim)]">Access token</dt>
              <dd className="text-[var(--text-muted)]">
                {session.accessToken ? "Present" : "Missing — re-login"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-dim)]">Template ID</dt>
              <dd className="font-mono text-xs text-[var(--text-muted)]">
                {process.env.MINI_BOX_TEMPLATE_ID || "Not set in .env.local"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Optional keys</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
            <li>
              <code className="text-[var(--text)]">OPENAI_API_KEY</code> — live AI drafts
              (mock drafts work without it)
            </li>
            <li>
              <code className="text-[var(--text)]">GIPHY_API_KEY</code> — live GIF search
              (mock GIFs work without it)
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
