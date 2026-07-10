"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Folder, Loader2 } from "lucide-react";

type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

type Breadcrumb = { id: string; name: string };

export function DriveFolderPicker({
  onSelect,
  disabled,
}: {
  onSelect: (folder: DriveFolder) => void;
  disabled?: boolean;
}) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentParent = breadcrumbs[breadcrumbs.length - 1]?.id ?? "root";

  const loadFolders = useCallback(async (parentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drive/folders?parentId=${encodeURIComponent(parentId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load folders");
      setFolders(data.folders || []);
      setSelectedId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders(currentParent);
  }, [currentParent, loadFolders]);

  function openFolder(folder: DriveFolder) {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function goToCrumb(index: number) {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }

  async function selectCurrentFolder() {
    const parent = breadcrumbs[breadcrumbs.length - 1];
    if (!parent || parent.id === "root") {
      setError("Open a folder first, then select it.");
      return;
    }
    onSelect({
      id: parent.id,
      name: parent.name,
      webViewLink: `https://drive.google.com/drive/folders/${parent.id}`,
    });
  }

  async function selectFromDropdown() {
    const folder = folders.find((f) => f.id === selectedId);
    if (!folder) return;
    onSelect(folder);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="opacity-50" />}
            <button
              type="button"
              onClick={() => goToCrumb(i)}
              className="rounded px-1 hover:text-[var(--accent)]"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={disabled || loading || folders.length === 0}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
        >
          <option value="">
            {loading
              ? "Loading folders…"
              : folders.length
                ? "Select a subfolder…"
                : "No subfolders here"}
          </option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !selectedId}
          onClick={() => void selectFromDropdown()}
          className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"
        >
          Use folder
        </button>
      </div>

      <div className="max-h-48 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--text-dim)]">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : folders.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-dim)]">
            No subfolders in this location.
          </p>
        ) : (
          <ul>
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openFolder(folder)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-soft)]"
                >
                  <Folder size={14} className="shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {currentParent !== "root" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void selectCurrentFolder()}
          className="w-full rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Use &ldquo;{breadcrumbs[breadcrumbs.length - 1]?.name}&rdquo; as archive folder
        </button>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
