"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  Minimize2,
  Heart,
  Zap,
  Target,
  Loader2,
} from "lucide-react";
import type {
  GifSelection,
  MiniBoxDocument,
} from "@/lib/mini-box";
import { deriveSectionStatus } from "@/lib/mini-box";
import { GifPicker } from "@/components/builder/GifPicker";
import { StatusPill } from "@/components/builder/SectionNav";

type ContentSectionId = "title" | "welcome" | "onePager" | "chat";
type AiAction = "generate" | "shorten" | "warmer" | "sharper" | "concrete";

function Field({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

export function SectionEditor({
  document,
  sectionId,
  onChange,
}: {
  document: MiniBoxDocument;
  sectionId: ContentSectionId;
  onChange: (next: MiniBoxDocument) => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const section = document.sections[sectionId];
  const status = deriveSectionStatus(document, sectionId);

  const gifQuery = useMemo(() => {
    if (sectionId === "welcome") return `${document.topic} welcome security`;
    if (sectionId === "onePager") return `${document.topic} cybersecurity`;
    if (sectionId === "chat") return `${document.topic} chat reaction`;
    return document.topic || "cybersecurity";
  }, [document.topic, sectionId]);

  function patchSection(partial: Record<string, unknown>) {
    const next = {
      ...document,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        [sectionId]: {
          ...document.sections[sectionId],
          ...partial,
        },
      },
    } as MiniBoxDocument;

    if (sectionId === "title" && typeof partial.topicTitle === "string") {
      next.topic = partial.topicTitle;
      next.title = partial.topicTitle || "Untitled Mini Box";
    }

    onChange(next);
  }

  function setGif(gif: GifSelection) {
    if (sectionId === "welcome" || sectionId === "onePager" || sectionId === "chat") {
      patchSection({ gif });
    }
  }

  async function runAi(action: AiAction) {
    setAiLoading(true);
    setAiNote(null);
    try {
      const currentText =
        sectionId === "title"
          ? document.sections.title.topicTitle
          : sectionId === "welcome"
            ? document.sections.welcome.intro
            : sectionId === "onePager"
              ? document.sections.onePager.bodyPart1
              : document.sections.chat.message;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          topic: document.topic || document.sections.title.topicTitle,
          articles: document.articles,
          action,
          currentText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");

      if (data.fields) {
        patchSection(data.fields);
      } else if (data.text && action !== "generate") {
        if (sectionId === "welcome") patchSection({ intro: data.text });
        if (sectionId === "onePager") patchSection({ bodyPart1: data.text });
        if (sectionId === "chat") patchSection({ message: data.text });
        if (sectionId === "title") patchSection({ topicTitle: data.text });
      }
      if (data.note) setAiNote(data.note);
    } catch (err) {
      setAiNote(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiLoading(false);
    }
  }

  const aiButtons: Array<{ action: AiAction; label: string; icon: React.ReactNode }> = [
    { action: "generate", label: "Generate", icon: <Sparkles size={13} /> },
    { action: "shorten", label: "Shorten", icon: <Minimize2 size={13} /> },
    { action: "warmer", label: "Warmer", icon: <Heart size={13} /> },
    { action: "sharper", label: "Sharper", icon: <Zap size={13} /> },
    { action: "concrete", label: "Concrete", icon: <Target size={13} /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">{section.label}</h2>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Edit this section — the PowerPoint preview on the right updates live.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5 scrollbar-thin">
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              AI draft
            </div>
            {aiLoading && (
              <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {aiButtons.map((btn) => (
              <button
                key={btn.action}
                type="button"
                disabled={aiLoading}
                onClick={() => void runAi(btn.action)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:opacity-50"
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
          {aiNote && (
            <p className="mt-3 text-[11px] text-[var(--text-dim)]">{aiNote}</p>
          )}
        </div>

        <div className="space-y-4">
          {sectionId === "title" && (
            <Field
              label="Topic title"
              rows={2}
              value={document.sections.title.topicTitle}
              onChange={(topicTitle) => patchSection({ topicTitle })}
              placeholder="e.g. Shadow AI"
            />
          )}

          {sectionId === "welcome" && (
            <>
              <Field
                label="Intro"
                rows={5}
                value={document.sections.welcome.intro}
                onChange={(intro) => patchSection({ intro })}
                placeholder="Welcome to your Mini Box…"
              />
              <Field
                label="What's inside"
                rows={6}
                value={document.sections.welcome.contents}
                onChange={(contents) => patchSection({ contents })}
              />
              <Field
                label="Closing"
                rows={4}
                value={document.sections.welcome.closing}
                onChange={(closing) => patchSection({ closing })}
              />
              <GifPicker
                defaultQuery={gifQuery}
                selected={document.sections.welcome.gif}
                onSelect={setGif}
              />
            </>
          )}

          {sectionId === "onePager" && (
            <>
              <Field
                label="Greeting"
                rows={1}
                value={document.sections.onePager.greeting}
                onChange={(greeting) => patchSection({ greeting })}
              />
              <Field
                label="Subject line"
                rows={2}
                value={document.sections.onePager.subjectLine}
                onChange={(subjectLine) => patchSection({ subjectLine })}
                placeholder="🔒 …"
              />
              <Field
                label="Body · part 1 (slide 4)"
                rows={7}
                value={document.sections.onePager.bodyPart1}
                onChange={(bodyPart1) => patchSection({ bodyPart1 })}
              />
              <Field
                label="Body · part 2 / tips (slide 5)"
                rows={8}
                value={document.sections.onePager.bodyPart2}
                onChange={(bodyPart2) => patchSection({ bodyPart2 })}
              />
              <GifPicker
                defaultQuery={gifQuery}
                selected={document.sections.onePager.gif}
                onSelect={setGif}
              />
            </>
          )}

          {sectionId === "chat" && (
            <>
              <Field
                label="Chat message"
                rows={12}
                value={document.sections.chat.message}
                onChange={(message) => patchSection({ message })}
                placeholder="Quick scenario…"
              />
              <GifPicker
                defaultQuery={gifQuery}
                selected={document.sections.chat.gif}
                onSelect={setGif}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
