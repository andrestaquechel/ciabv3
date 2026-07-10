"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  Presentation,
  Users,
} from "lucide-react";

type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

type DrivePreviewItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  isFolder: boolean;
};

type LocationTab = "my-drive" | "shared-with-me" | "shared-drive";

type Breadcrumb = {
  id: string;
  name: string;
  tab: LocationTab;
  driveId?: string;
};

type SharedDrive = { id: string; name: string };

const TAB_LABELS: Record<LocationTab, string> = {
  "my-drive": "My Drive",
  "shared-with-me": "Shared with me",
  "shared-drive": "Shared drives",
};

function rootBreadcrumb(tab: LocationTab): Breadcrumb {
  if (tab === "shared-with-me") {
    return { id: "shared-root", name: "Shared with me", tab };
  }
  if (tab === "shared-drive") {
    return { id: "drives-list", name: "Shared drives", tab };
  }
  return { id: "root", name: "My Drive", tab: "my-drive" };
}

function foldersUrl(crumbs: Breadcrumb[]): string | null {
  const current = crumbs[crumbs.length - 1];
  if (!current) return null;

  if (current.tab === "shared-drive" && current.id === "drives-list") {
    return "/api/drive/folders?sharedDrives=1";
  }

  if (current.tab === "my-drive") {
    return `/api/drive/folders?scope=my-drive&parentId=${encodeURIComponent(current.id)}`;
  }

  if (current.tab === "shared-with-me") {
    if (current.id === "shared-root") {
      return "/api/drive/folders?scope=shared-with-me";
    }
    return `/api/drive/folders?scope=shared-with-me&parentId=${encodeURIComponent(current.id)}`;
  }

  if (current.tab === "shared-drive" && current.driveId) {
    const parentId = current.id === "drive-root" ? "root" : current.id;
    return `/api/drive/folders?scope=shared-drive&driveId=${encodeURIComponent(current.driveId)}&parentId=${encodeURIComponent(parentId)}`;
  }

  return null;
}

function previewIcon(item: DrivePreviewItem) {
  if (item.isFolder) return Folder;
  if (item.mimeType.includes("presentation") || item.mimeType.includes("powerpoint")) {
    return Presentation;
  }
  if (item.mimeType.includes("document") || item.mimeType.includes("text")) {
    return FileText;
  }
  return File;
}

export function DriveFolderPicker({
  onSelect,
  disabled,
}: {
  onSelect: (folder: DriveFolder) => void;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const previewId = useId();
  const [tab, setTab] = useState<LocationTab>("my-drive");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    rootBreadcrumb("my-drive"),
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    items: DrivePreviewItem[];
    hasMore: boolean;
    folderCount: number;
    fileCount: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = breadcrumbs[breadcrumbs.length - 1];
  const showingDriveList =
    current?.tab === "shared-drive" && current.id === "drives-list";
  const canSelectCurrent =
    current &&
    current.id !== "root" &&
    current.id !== "shared-root" &&
    current.id !== "drives-list" &&
    current.id !== "drive-root";

  const loadListing = useCallback(async (crumbs: Breadcrumb[]) => {
    const url = foldersUrl(crumbs);
    if (!url) return;

    setLoading(true);
    setError(null);
    setHighlightedId(null);
    setPreview(null);

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load folders");

      if (url.includes("sharedDrives=1")) {
        setSharedDrives(data.drives || []);
        setFolders([]);
      } else {
        setFolders(data.folders || []);
        setSharedDrives([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
      setFolders([]);
      setSharedDrives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListing(breadcrumbs);
  }, [breadcrumbs, loadListing]);

  const loadPreview = useCallback((folderId: string) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(
          `/api/drive/folders?folderId=${encodeURIComponent(folderId)}&preview=1&limit=30`,
        );
        const data = await res.json();
        if (res.ok) {
          setPreview({
            items: data.items || [],
            hasMore: !!data.hasMore,
            folderCount: data.folderCount ?? 0,
            fileCount: data.fileCount ?? 0,
          });
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    if (highlightedId) return;
    if (canSelectCurrent && current) {
      loadPreview(current.id);
    }
  }, [canSelectCurrent, current, highlightedId, loadPreview]);

  function switchTab(next: LocationTab) {
    setTab(next);
    setBreadcrumbs([rootBreadcrumb(next)]);
  }

  function highlightFolder(folder: DriveFolder) {
    setHighlightedId(folder.id);
    loadPreview(folder.id);
  }

  function openFolder(folder: DriveFolder) {
    setBreadcrumbs((prev) => [
      ...prev,
      { id: folder.id, name: folder.name, tab, driveId: current?.driveId },
    ]);
  }

  function openSharedDrive(drive: SharedDrive) {
    setBreadcrumbs([
      rootBreadcrumb("shared-drive"),
      {
        id: "drive-root",
        name: drive.name,
        tab: "shared-drive",
        driveId: drive.id,
      },
    ]);
  }

  function goToCrumb(index: number) {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }

  function selectFolder(folder: DriveFolder) {
    onSelect({
      ...folder,
      webViewLink:
        folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
    });
  }

  function selectHighlighted() {
    const folder = folders.find((f) => f.id === highlightedId);
    if (folder) selectFolder(folder);
  }

  function selectCurrentLocation() {
    if (!current || !canSelectCurrent) return;
    selectFolder({
      id: current.id,
      name: current.name,
      webViewLink: `https://drive.google.com/drive/folders/${current.id}`,
    });
  }

  function onFolderKeyDown(
    e: React.KeyboardEvent,
    folder: DriveFolder,
    index: number,
  ) {
    const rows = folders;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = rows[Math.min(index + 1, rows.length - 1)];
      if (next) highlightFolder(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = rows[Math.max(index - 1, 0)];
      if (prev) highlightFolder(prev);
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      selectFolder(folder);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openFolder(folder);
    }
  }

  const highlightedFolder = folders.find((f) => f.id === highlightedId);

  return (
    <div className="space-y-3" role="region" aria-label="Google Drive folder picker">
      <div
        role="tablist"
        aria-label="Drive location"
        className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-1"
      >
        {(["my-drive", "shared-with-me", "shared-drive"] as LocationTab[]).map(
          (key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              disabled={disabled}
              onClick={() => switchTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                tab === key
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {key === "my-drive" && <HardDrive size={12} />}
              {key === "shared-with-me" && <Users size={12} />}
              {key === "shared-drive" && <FolderOpen size={12} />}
              {TAB_LABELS[key]}
            </button>
          ),
        )}
      </div>

      <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.id}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="opacity-50" aria-hidden />}
            <button
              type="button"
              onClick={() => goToCrumb(i)}
              className="rounded px-1 hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="grid min-h-[280px] grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex min-h-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
            {showingDriveList
              ? "Select a shared drive to browse"
              : "Folders — click to preview, double-click or Enter to open"}
          </div>

          <div
            className="max-h-64 flex-1 overflow-auto scrollbar-thin"
            role="listbox"
            id={listboxId}
            aria-label="Folders"
            aria-activedescendant={
              highlightedId ? `${listboxId}-${highlightedId}` : undefined
            }
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--text-dim)]">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Loading…
              </div>
            ) : showingDriveList ? (
              sharedDrives.length === 0 ? (
                <p className="p-4 text-sm text-[var(--text-dim)]">
                  No shared drives found.
                </p>
              ) : (
                <ul>
                  {sharedDrives.map((drive) => (
                    <li key={drive.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => openSharedDrive(drive)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-soft)] focus:bg-[var(--bg-soft)] focus:outline-none"
                      >
                        <FolderOpen size={14} className="shrink-0 text-[var(--accent)]" aria-hidden />
                        <span className="truncate">{drive.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : folders.length === 0 ? (
              <p className="p-4 text-sm text-[var(--text-dim)]">
                No folders here. You can still select this location if it is the
                archive folder you want.
              </p>
            ) : (
              <ul>
                {folders.map((folder, index) => {
                  const selected = highlightedId === folder.id;
                  return (
                    <li key={folder.id}>
                      <button
                        type="button"
                        id={`${listboxId}-${folder.id}`}
                        role="option"
                        aria-selected={selected}
                        disabled={disabled}
                        onClick={() => highlightFolder(folder)}
                        onDoubleClick={() => openFolder(folder)}
                        onKeyDown={(e) => onFolderKeyDown(e, folder, index)}
                        onFocus={() => highlightFolder(folder)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm focus:outline-none ${
                          selected
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "hover:bg-[var(--bg-soft)]"
                        }`}
                      >
                        <Folder size={14} className="shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                        <ChevronRight size={12} className="shrink-0 opacity-40" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          id={previewId}
          aria-live="polite"
          aria-label="Folder contents preview"
          className="flex min-h-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]"
        >
          <div className="border-b border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
            {highlightedFolder
              ? `Preview: ${highlightedFolder.name}`
              : canSelectCurrent
                ? `Preview: ${current?.name}`
                : "Select a folder to preview contents"}
          </div>

          <div className="max-h-64 flex-1 overflow-auto p-2 scrollbar-thin">
            {previewLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-[var(--text-dim)]">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Loading preview…
              </div>
            ) : preview && preview.items.length > 0 ? (
              <>
                <p className="mb-2 px-1 text-[10px] text-[var(--text-dim)]">
                  {preview.folderCount} subfolder{preview.folderCount !== 1 ? "s" : ""},{" "}
                  {preview.fileCount} file{preview.fileCount !== 1 ? "s" : ""} shown
                  {preview.hasMore ? " (more inside)" : ""}
                </p>
                <ul className="space-y-1">
                  {preview.items.map((item) => {
                    const Icon = previewIcon(item);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--text-muted)]"
                      >
                        <Icon size={12} className="shrink-0 text-[var(--accent)]" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {item.modifiedTime && (
                          <span className="shrink-0 text-[10px] text-[var(--text-dim)]">
                            {new Date(item.modifiedTime).toLocaleDateString()}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : highlightedId || canSelectCurrent ? (
              <p className="p-4 text-sm text-[var(--text-dim)]">
                This folder appears empty or contains no listable items.
              </p>
            ) : (
              <p className="p-4 text-sm text-[var(--text-dim)]">
                Highlight a folder on the left to see files and subfolders before
                selecting it.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {highlightedFolder && (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => openFolder(highlightedFolder)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
            >
              Open &ldquo;{highlightedFolder.name}&rdquo;
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={selectHighlighted}
              className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
            >
              Use &ldquo;{highlightedFolder.name}&rdquo;
            </button>
          </>
        )}
        {canSelectCurrent && !highlightedFolder && (
          <button
            type="button"
            disabled={disabled}
            onClick={selectCurrentLocation}
            className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
          >
            Use &ldquo;{current?.name}&rdquo; as archive folder
          </button>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-dim)]">
        Tip: Enter opens a folder · Shift+Enter selects · Arrow keys move highlight
      </p>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
