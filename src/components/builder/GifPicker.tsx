"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { GifSelection } from "@/lib/mini-box";

type GifResult = NonNullable<GifSelection>;

export function GifPicker({
  defaultQuery,
  selected,
  onSelect,
}: {
  defaultQuery: string;
  selected: GifSelection;
  onSelect: (gif: GifSelection) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function search(q: string) {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch(`/api/giphy?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.results || []);
      if (data.note) setNote(data.note);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search(defaultQuery || "cybersecurity");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          GIF picker · pick 1 of 15
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            Clear
          </button>
        )}
      </div>

      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Giphy…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Search
        </button>
      </form>

      {note && (
        <p className="mb-3 text-[11px] text-[var(--text-dim)]">{note}</p>
      )}

      {loading ? (
        <div className="flex h-28 items-center justify-center text-[var(--text-dim)]">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {results.map((gif) => {
            const isSelected = selected?.id === gif.id;
            return (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif)}
                className={`overflow-hidden rounded-xl border-2 transition ${
                  isSelected
                    ? "border-[var(--accent)]"
                    : "border-transparent hover:border-[var(--border-strong)]"
                }`}
                title={gif.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="aspect-square h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
