"use client";

import { AppShell } from "@/components/layout/AppShell";
import { DriveFolderPicker } from "@/components/knowledge/DriveFolderPicker";
import {
  loadKnowledgeSettings,
  saveKnowledgeSettings,
  parseDriveFolderId,
  type BoxType,
} from "@/lib/knowledge-store";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState(loadKnowledgeSettings());
  const [miniBoxUrl, setMiniBoxUrl] = useState(
    settings["mini-box"]?.folderUrl ?? "",
  );
  const [ciabUrl, setCiabUrl] = useState(settings.ciab?.folderUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [activePicker, setActivePicker] = useState<BoxType | null>(null);

  function save(type: BoxType, url: string, folderName?: string) {
    const folderId = parseDriveFolderId(url);
    if (!folderId) return;
    const next = { ...settings };
    next[type] = {
      folderId,
      folderUrl: url.trim(),
      folderName,
      setAt: new Date().toISOString(),
    };
    saveKnowledgeSettings(next);
    setSettings(next);
    if (type === "mini-box") setMiniBoxUrl(url.trim());
    if (type === "ciab") setCiabUrl(url.trim());
    setSaved(true);
    setActivePicker(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function saveFromPicker(
    type: BoxType,
    folder: { id: string; name: string; webViewLink?: string },
  ) {
    save(
      type,
      folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
      folder.name,
    );
  }

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center border-b border-[var(--border)] px-6 text-sm text-[var(--text-muted)]">
          Settings
        </header>
      }
    >
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-4 p-6 pb-12">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Account</h2>
          {session?.user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Signed in as{" "}
                <span className="text-[var(--text)]">{session.user.email}</span>
              </p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-[var(--text-muted)]">
                Connect Google to browse Drive folders in Knowledge Base.
              </p>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/settings" })}
                className="mt-3 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
              >
                Connect Google
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h1 className="text-base font-medium">Knowledge Base folders</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Choose Google Drive archive folders for each box type. Browse folders
            in-app or paste a link.
          </p>

          {(["mini-box", "ciab"] as BoxType[]).map((type) => {
            const label = type === "mini-box" ? "Mini Box folder" : "CIAB folder";
            const url = type === "mini-box" ? miniBoxUrl : ciabUrl;
            const setUrl = type === "mini-box" ? setMiniBoxUrl : setCiabUrl;
            const configured = settings[type];

            return (
              <div key={type} className="mt-5 border-t border-[var(--border)] pt-5 first:mt-4 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-dim)]">
                    {label}
                  </span>
                  {configured?.folderName && (
                    <span className="truncate text-xs text-[var(--accent)]">
                      {configured.folderName}
                    </span>
                  )}
                </div>

                {session?.accessToken && activePicker === type ? (
                  <div className="mt-3">
                    <DriveFolderPicker
                      onSelect={(folder) => saveFromPicker(type, folder)}
                    />
                    <button
                      type="button"
                      onClick={() => setActivePicker(null)}
                      className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel browse
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/…"
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => save(type, url, configured?.folderName)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                      >
                        Save {type === "mini-box" ? "Mini Box" : "CIAB"} folder
                      </button>
                      {session?.accessToken && (
                        <button
                          type="button"
                          onClick={() => setActivePicker(type)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--accent)]"
                        >
                          Browse Drive…
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {saved && (
            <p className="mt-3 text-xs text-[var(--accent)]">Saved.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Export</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Mini Boxes use the Shadow AI master template
            (`mini-box-master.pptx`) for preview and download. New boxes start
            with that example content pre-filled for editing.
          </p>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
