"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function connectGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Could not start Google sign-in. Check OAuth credentials.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(167,139,250,0.22), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.08), transparent)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Boxes size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Box Studio</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Build Mini Box and CIAB content with live Google Slides preview.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <h2 className="text-lg font-medium">Connect Google</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Sign in with Google to authorize Slides and Drive access. You won&apos;t
            paste an API key — your login grants the app permission to copy
            templates and sync content into your decks.
          </p>

          <ul className="mt-5 space-y-3 text-sm text-[var(--text-muted)]">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent)]" size={16} />
              OAuth login — Slides + Drive scopes only
            </li>
            <li className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 shrink-0 text-[var(--accent)]" size={16} />
              Copy Mini Box templates into your Drive
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 shrink-0 text-[var(--accent)]" size={16} />
              Live preview while you edit sections
            </li>
          </ul>

          {error && (
            <div className="mt-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={connectGoogle}
            disabled={loading || status === "loading"}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Opening Google…" : "Continue with Google"}
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--text-dim)]">
            One-time setup: create an OAuth client in Google Cloud and put{" "}
            <code className="text-[var(--text-muted)]">AUTH_GOOGLE_ID</code> /{" "}
            <code className="text-[var(--text-muted)]">AUTH_GOOGLE_SECRET</code> in{" "}
            <code className="text-[var(--text-muted)]">.env.local</code>. See README.
          </p>
        </div>
      </div>
    </div>
  );
}
