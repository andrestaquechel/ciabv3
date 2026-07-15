"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  createFeatureRequest,
  DEFAULT_FEATURE_AUTHOR,
  deleteFeatureRequest,
  listFeatureRequests,
  saveFeatureRequest,
  type FeatureRequest,
} from "@/lib/features-needed-store";
import { ClipboardPaste, ImagePlus, Loader2, Trash2 } from "lucide-react";

const MAX_IMAGE_BYTES = 2_500_000;

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Image is too large (max ~2.5 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export default function FeaturesNeededPage() {
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState(DEFAULT_FEATURE_AUTHOR);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setItems(listFeatureRequests());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function attachImage(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readImageFile(file);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach image.");
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) void attachImage(file);
  }

  function submit() {
    if (!body.trim()) {
      setError("Write what you want changed or added.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = createFeatureRequest(body, author, imageDataUrl);
      saveFeatureRequest(item);
      setBody("");
      setAuthor(DEFAULT_FEATURE_AUTHOR);
      setImageDataUrl(undefined);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string) {
    deleteFeatureRequest(id);
    refresh();
  }

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center border-b border-[var(--border)] px-6">
          <span className="text-sm text-[var(--text-muted)]">Features NEEDED</span>
        </header>
      }
    >
      <div className="h-full overflow-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-semibold tracking-tight">Features NEEDED</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Drop ideas, bugs, or screenshots for changes you want in Box Studio.
            Saved in this browser so the team can review them.
          </p>

          <div
            ref={pasteZoneRef}
            onPaste={handlePaste}
            className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5"
          >
            <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]">
              New request
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Describe the change you want… (paste a screenshot with Cmd/Ctrl+V)"
              className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
            />

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[140px] flex-1">
                <label className="text-[11px] text-[var(--text-dim)]">Your name</label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder={DEFAULT_FEATURE_AUTHOR}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void attachImage(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--accent)]/40"
              >
                <ImagePlus size={14} />
                Attach image
              </button>
              <button
                type="button"
                disabled={saving || !body.trim()}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Add feature
              </button>
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
              <ClipboardPaste size={12} />
              Tip: paste a screenshot directly into the text box
            </p>

            {imageDataUrl && (
              <div className="relative mt-3 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="Attached preview"
                  className="max-h-48 rounded-lg border border-[var(--border)]"
                />
                <button
                  type="button"
                  onClick={() => setImageDataUrl(undefined)}
                  className="absolute -right-2 -top-2 rounded-full bg-[var(--bg-elevated)] p-1 text-[var(--text-dim)] shadow hover:text-[var(--danger)]"
                  title="Remove image"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
            )}
          </div>

          <div className="mt-8 space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No requests yet.</p>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4"
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                    {item.body}
                  </p>
                  {item.imageDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageDataUrl}
                      alt="Feature attachment"
                      className="mt-3 max-h-64 rounded-lg border border-[var(--border)]"
                    />
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-dim)]">
                      {item.author}
                      {" · "}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-soft)] hover:text-[var(--danger)]"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
