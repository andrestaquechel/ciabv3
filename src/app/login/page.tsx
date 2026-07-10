"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Boxes } from "lucide-react";

export default function LoginPage() {
  const { data: session, status } = useSession();

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Signed in as {session.user?.email}
          </p>
          <Link
            href="/builder/new"
            className="mt-4 inline-flex rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
          >
            Open builder
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Boxes size={22} />
        </div>
        <h1 className="text-xl font-semibold">Box Studio</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Build Mini Boxes as PowerPoint. Connect Google for Knowledge Base
          (Drive archive search).
        </p>
        <Link
          href="/builder/new"
          className="mt-4 inline-flex w-full justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        >
          Continue without Google
        </Link>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/knowledge" })}
          className="mt-3 inline-flex w-full justify-center rounded-xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-white"
        >
          Connect Google (Drive)
        </button>
      </div>
    </div>
  );
}
