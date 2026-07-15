"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import type { AnnualCalendarYear, AnnualCalendarsPayload } from "@/lib/box-studio-drive-data";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

const MAX_IMAGE_BYTES = 8_000_000;
const LOCAL_CACHE_KEY = "box-studio:annual-calendars";

function readLocalCache(): AnnualCalendarsPayload {
  if (typeof window === "undefined") return { calendars: {} };
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AnnualCalendarsPayload) : { calendars: {} };
  } catch {
    return { calendars: {} };
  }
}

function writeLocalCache(payload: AnnualCalendarsPayload) {
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(payload));
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      reject(new Error("Use an image or PDF file for the calendar."));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("File is too large (max ~8 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function yearRange(current: number, stored: number[]) {
  const years = new Set<number>();
  for (let y = current + 1; y >= current - 8; y -= 1) years.add(y);
  for (const y of stored) years.add(y);
  return Array.from(years).sort((a, b) => b - a);
}

export function AnnualTopicCalendarPanel() {
  const { status } = useSession();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [store, setStore] = useState<AnnualCalendarsPayload>({ calendars: {} });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const local = readLocalCache();
    setStore(local);
    try {
      const res = await fetch("/api/knowledge/annual-calendar", { cache: "no-store" });
      if (res.ok) {
        const remote = (await res.json()) as AnnualCalendarsPayload;
        setStore(remote);
        writeLocalCache(remote);
      }
    } catch {
      // keep local cache
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void refresh();
    else setLoading(false);
  }, [status, refresh]);

  const years = useMemo(
    () =>
      yearRange(
        currentYear,
        Object.values(store.calendars).map((c) => c.year),
      ),
    [currentYear, store.calendars],
  );

  const entry: AnnualCalendarYear | undefined = store.calendars[String(selectedYear)];

  useEffect(() => {
    setNotes(entry?.notes ?? "");
  }, [selectedYear, entry?.notes]);

  async function saveYear(
    patch: Partial<{
      imageDataUrl: string | null;
      notes: string;
      sourceFileName: string;
      clearImage: boolean;
    }>,
  ) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/annual-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedYear,
          notes: patch.notes ?? notes,
          imageDataUrl: patch.imageDataUrl,
          sourceFileName: patch.sourceFileName,
          clearImage: patch.clearImage,
        }),
      });
      const data = (await res.json()) as AnnualCalendarsPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save calendar.");
      setStore(data);
      writeLocalCache(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save calendar.");
    } finally {
      setSaving(false);
    }
  }

  async function attachFile(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      await saveYear({ imageDataUrl: dataUrl, sourceFileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach file.");
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(
      (i) => i.type.startsWith("image/") || i.type === "application/pdf",
    );
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) void attachFile(file);
  }

  if (status !== "authenticated") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-[var(--text-muted)]">
          Connect Google to view and save the team annual topic calendar.
        </p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/knowledge" })}
          className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
        >
          Connect Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-[120px] shrink-0 flex-col gap-1 border-r border-[var(--border)] p-3">
        <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          Year
        </div>
        {years.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => setSelectedYear(year)}
            className={`rounded-xl px-3 py-2 text-left text-sm ${
              selectedYear === year
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
            }`}
          >
            {year}
            {store.calendars[String(year)]?.imageDataUrl ? (
              <span className="ml-1 text-[10px] text-[var(--accent)]">●</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-medium">
              {selectedYear} Annual Topic Calendar
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-soft)]"
              title="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-soft)]"
              title="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-6 lg:grid-cols-[1fr_280px] scrollbar-thin"
          onPaste={handlePaste}
        >
          <div className="flex min-h-[320px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[var(--text-dim)]" />
              </div>
            ) : entry?.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.imageDataUrl}
                alt={`${selectedYear} annual topic calendar`}
                className="mx-auto max-h-[70vh] w-full object-contain"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-[var(--text-dim)]">
                <Calendar size={32} className="opacity-40" />
                <p>No calendar uploaded for {selectedYear} yet.</p>
                <p className="text-xs">Attach a file or paste a screenshot below.</p>
              </div>
            )}
            {entry?.sourceFileName && (
              <p className="mt-3 text-center text-[10px] text-[var(--text-dim)]">
                {entry.sourceFileName}
                {entry.updatedAt
                  ? ` · updated ${new Date(entry.updatedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Upload the yearly topic calendar (image or PDF). Saved to shared
              Google Drive so the whole team sees the same plan.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => void attachFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
            >
              <ImagePlus size={14} />
              Attach file
            </button>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
              <ClipboardPaste size={12} />
              Or paste image/PDF anywhere on this page
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Optional notes about this year's topics…"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveYear({ notes })}
              className="w-full rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save notes"}
            </button>
            {entry?.imageDataUrl && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveYear({ clearImage: true })}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--danger)] disabled:opacity-50"
              >
                <Trash2 size={14} />
                Remove calendar image
              </button>
            )}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
