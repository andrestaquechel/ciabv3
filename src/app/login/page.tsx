import Link from "next/link";
import { Boxes } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(167,139,250,0.22), transparent)",
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Boxes size={22} />
        </div>
        <h1 className="text-xl font-semibold">Box Studio</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No Google login needed. Build Mini Boxes as PowerPoint and download
          when ready.
        </p>
        <Link
          href="/builder/new"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-white hover:brightness-110"
        >
          Open builder
        </Link>
      </div>
    </div>
  );
}
