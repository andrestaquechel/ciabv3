"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { MiniBoxDocument } from "@/lib/mini-box";
import { deriveSectionStatus } from "@/lib/mini-box";
import { StatusPill } from "@/components/builder/SectionNav";

export function IdeatePanel({
  document,
  onChange,
}: {
  document: MiniBoxDocument;
  onChange: (next: MiniBoxDocument) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const status = deriveSectionStatus(document, "title");

  function setNotes(notes: string) {
    onChange({
      ...document,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        ideate: {
          ...document.sections.ideate,
          notes,
        },
      },
    });
  }

  function setTitleName(titleName: string) {
    onChange({
      ...document,
      topic: titleName,
      title: titleName || document.title,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        title: {
          ...document.sections.title,
          topicTitle: titleName,
        },
        inputs: {
          ...document.sections.inputs,
          status: titleName.trim() ? "draft" : document.sections.inputs.status,
        },
      },
    });
  }

  function pickTopic(topic: string) {
    onChange({
      ...document,
      topic,
      title: topic || "Untitled Mini Box",
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        ideate: {
          ...document.sections.ideate,
          notes: document.sections.ideate.notes || `Selected: ${topic}`,
        },
        title: {
          ...document.sections.title,
          topicTitle: topic,
        },
      },
    });
  }

  async function suggestTopics() {
    setSuggesting(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "topics",
          topic: document.topic,
          articles: document.articles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestion failed");
      setTopics(data.topics || []);
      if (data.note) setNote(data.note);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Topic / Title</h2>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Set the cover title and brainstorm the angle for this box.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-5 scrollbar-thin">
        <label className="block">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Title name
          </div>
          <input
            type="text"
            value={document.sections.title.topicTitle || ""}
            onChange={(e) => setTitleName(e.target.value)}
            placeholder="Appears on the cover slide under “The Mini Box”"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
            This title is shown on the cover slide preview and exported PPTX.
          </p>
        </label>

        <label className="block">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Ideation notes
          </div>
          <textarea
            value={document.sections.ideate?.notes || ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="What risk is timely? Who is the audience? Any headlines or angles to explore…"
            className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[var(--accent)]"
          />
        </label>

        <button
          type="button"
          disabled={suggesting}
          onClick={() => void suggestTopics()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
        >
          {suggesting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Suggest topics
        </button>

        {note && <p className="text-[11px] text-[var(--text-dim)]">{note}</p>}

        {topics.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              Topic ideas
            </div>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => pickTopic(topic)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    document.topic === topic
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {document.topic && (
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
            Selected topic: <span className="font-medium">{document.topic}</span>
          </div>
        )}

      </div>
    </div>
  );
}
