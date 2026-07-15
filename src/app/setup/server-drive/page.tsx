"use client";

import { AppShell } from "@/components/layout/AppShell";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SetupServerDrivePage() {
  const { data: session, status } = useSession();
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<{
    envConfigured?: { refreshToken: boolean; dataFolderId: boolean };
    sessionDrive?: {
      hasRefreshToken: boolean;
      refreshToken?: string;
      dataFolderId?: string;
    };
  } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetch("/api/setup/server-drive")
      .then((r) => r.json())
      .then(setDriveStatus)
      .catch(() => setDriveStatus(null));
  }, [status]);

  async function installToVercel() {
    setInstalling(true);
    setInstallError(null);
    setInstallResult(null);
    try {
      const res = await fetch("/api/setup/server-drive/install", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Install failed.");
      setInstallResult(data.message || "Installed on Vercel.");
      const refreshed = await fetch("/api/setup/server-drive").then((r) => r.json());
      setDriveStatus(refreshed);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Server Drive setup</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Slack button workflows need a Google refresh token on Vercel (no browser
            session in webhooks). One-time setup — takes about 30 seconds.
          </p>
        </div>

        {status === "loading" && (
          <p className="text-sm text-[var(--text-muted)]">Checking sign-in…</p>
        )}

        {status === "unauthenticated" && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
            <p className="text-sm">Sign in with your Living Security Google account.</p>
            <button
              type="button"
              onClick={() => void signIn("google", { callbackUrl: "/setup/server-drive" })}
              className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {status === "authenticated" && (
          <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
            <p className="text-sm">
              Signed in as <strong>{session?.user?.email}</strong>
            </p>

            <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
              <li>
                Vercel refresh token:{" "}
                {driveStatus?.envConfigured?.refreshToken ? (
                  <span className="text-green-600">already configured</span>
                ) : (
                  <span className="text-amber-600">missing</span>
                )}
              </li>
              <li>
                Session refresh token:{" "}
                {driveStatus?.sessionDrive?.hasRefreshToken ? (
                  <span className="text-green-600">ready</span>
                ) : (
                  <span className="text-amber-600">missing — re-auth below</span>
                )}
              </li>
            </ul>

            {!driveStatus?.sessionDrive?.hasRefreshToken && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                <p className="font-medium">Re-authorize Google (required once)</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  Google only sends a refresh token after a fresh consent. Sign out,
                  then sign in again.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/setup/server-drive" })}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                  >
                    Sign out
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void signIn("google", { callbackUrl: "/setup/server-drive" })
                    }
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Sign in with Google (consent)
                  </button>
                </div>
              </div>
            )}

            {driveStatus?.sessionDrive?.refreshToken && (
              <textarea
                readOnly
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 font-mono text-[11px]"
                value={driveStatus.sessionDrive.refreshToken}
              />
            )}

            {driveStatus?.sessionDrive?.dataFolderId && (
              <p className="text-xs text-[var(--text-muted)]">
                Box Studio Data folder:{" "}
                <code className="text-[var(--accent)]">
                  {driveStatus.sessionDrive.dataFolderId}
                </code>
              </p>
            )}

            <button
              type="button"
              disabled={installing || !driveStatus?.sessionDrive?.hasRefreshToken}
              onClick={() => void installToVercel()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {installing ? "Installing…" : "Install to Vercel"}
            </button>

            {installResult && (
              <p className="text-sm text-green-600">{installResult}</p>
            )}
            {installError && (
              <p className="text-sm text-red-500">{installError}</p>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)]">
          <Link href="/settings" className="underline">
            Back to Settings
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
