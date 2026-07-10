import { AppShell } from "@/components/layout/AppShell";

export default function SettingsPage() {
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
          <h1 className="text-base font-medium">Export</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Mini Boxes export as native PowerPoint (PPTX). Upload the file to
            Google Drive and open with Google Slides when you want a Slides
            version — no Google OAuth required in the app.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Optional keys</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
            <li>
              <code className="text-[var(--text)]">OPENAI_API_KEY</code> — live AI
              drafts (mock drafts work without it)
            </li>
            <li>
              <code className="text-[var(--text)]">GIPHY_API_KEY</code> — live GIF
              search (already set on Vercel)
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
