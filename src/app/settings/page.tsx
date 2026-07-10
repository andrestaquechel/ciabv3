"use client";

import { AppShell } from "@/components/layout/AppShell";
import {
  loadKnowledgeSettings,
  saveKnowledgeSettings,
  parseDriveFolderId,
  type BoxType,
} from "@/lib/knowledge-store";
import { useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadKnowledgeSettings());
  const [miniBoxUrl, setMiniBoxUrl] = useState(
    settings["mini-box"]?.folderUrl ?? "",
  );
  const [ciabUrl, setCiabUrl] = useState(settings.ciab?.folderUrl ?? "");
  const [saved, setSaved] = useState(false);

  function save(type: BoxType, url: string) {
    const folderId = parseDriveFolderId(url);
    if (!folderId) return;
    const next = { ...settings };
    next[type] = {
      folderId,
      folderUrl: url.trim(),
      setAt: new Date().toISOString(),
    };
    saveKnowledgeSettings(next);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
          <h1 className="text-base font-medium">Knowledge Base folders</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Edit Google Drive folder links for each box type. Once set, the
            Knowledge Base hides the folder picker.
          </p>

          <label className="mt-4 block">
            <span className="text-xs text-[var(--text-dim)]">Mini Box folder</span>
            <input
              value={miniBoxUrl}
              onChange={(e) => setMiniBoxUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => save("mini-box", miniBoxUrl)}
              className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
            >
              Save Mini Box folder
            </button>
          </label>

          <label className="mt-4 block">
            <span className="text-xs text-[var(--text-dim)]">CIAB folder</span>
            <input
              value={ciabUrl}
              onChange={(e) => setCiabUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => save("ciab", ciabUrl)}
              className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
            >
              Save CIAB folder
            </button>
          </label>

          {saved && (
            <p className="mt-3 text-xs text-[var(--accent)]">Saved.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Export</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Mini Boxes use the master template (`mini-box-master.pptx`) for
            preview and download. Upload the PPTX to Drive → Open with Google
            Slides when ready.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
