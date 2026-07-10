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
  MiniBoxSectionId,
} from "@/lib/mini-box";
import { NAV_SECTION_LABELS, deriveSectionStatus } from "@/lib/mini-box";
import { GifPicker } from "@/components/builder/GifPicker";
import { StatusPill } from "@/components/builder/SectionNav";
import { ClaudeModelSelect } from "@/components/builder/ClaudeModelSelect";
import { loadSectionModelPreference } from "@/lib/box-store";
import { claudeModelLabel } from "@/lib/claude-models";

type EditorSectionId = "welcome" | "onePagerP1" | "onePagerP2" | "chat";
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
  sectionId: EditorSectionId;
  onChange: (next: MiniBoxDocument) => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const status = deriveSectionStatus(document, sectionId);
  const label = NAV_SECTION_LABELS[sectionId];

  const gifQuery = useMemo(() => {
    if (sectionId === "welcome") return `${document.topic} welcome security`;
    if (sectionId === "onePagerP1" || sectionId === "onePagerP2")
      return `${document.topic} cybersecurity`;
    if (sectionId === "chat") return `${document.topic} chat reaction`;
    return document.topic || "cybersecurity";
  }, [document.topic, sectionId]);

  function patchOnePager(partial: Record<string, unknown>) {
    onChange({
      ...document,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        onePager: {
          ...document.sections.onePager,
          ...partial,
        },
      },
    });
  }

  function patchWelcome(partial: Record<string, unknown>) {
    onChange({
      ...document,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        welcome: {
          ...document.sections.welcome,
          ...partial,
        },
      },
    });
  }

  function patchChat(partial: Record<string, unknown>) {
    onChange({
      ...document,
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        chat: {
          ...document.sections.chat,
          ...partial,
        },
      },
    });
  }

  function setGif(gif: GifSelection) {
    if (sectionId === "welcome") patchWelcome({ gif });
    if (sectionId === "onePagerP1") patchOnePager({ gif });
    if (sectionId === "chat") patchChat({ gif });
  }

  async function runAi(action: AiAction) {
    setAiLoading(true);
    setAiNote(null);
    try {
      const aiSectionId =
        sectionId === "onePagerP1" || sectionId === "onePagerP2"
          ? "onePager"
          : sectionId;

      const currentText =
        sectionId === "welcome"
          ? document.sections.welcome.intro
          : sectionId === "onePagerP1"
            ? document.sections.onePager.bodyPart1
            : sectionId === "onePagerP2"
              ? document.sections.onePager.bodyPart2
              : document.sections.chat.message;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: aiSectionId,
          topic: document.topic || document.sections.title.topicTitle,
          articles: document.articles,
          action,
          currentText,
          model: loadSectionModelPreference(sectionId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");

      if (data.fields) {
        if (sectionId === "welcome") patchWelcome(data.fields);
        else if (sectionId === "onePagerP1") {
          patchOnePager({
            greeting: data.fields.greeting,
            subjectLine: data.fields.subjectLine,
            bodyPart1: data.fields.bodyPart1,
            callout: data.fields.callout,
          });
        } else if (sectionId === "onePagerP2") {
          patchOnePager({ bodyPart2: data.fields.bodyPart2 });
        } else if (sectionId === "chat") patchChat(data.fields);
      } else if (data.text && action !== "generate") {
        if (sectionId === "welcome") patchWelcome({ intro: data.text });
        if (sectionId === "onePagerP1") patchOnePager({ bodyPart1: data.text });
        if (sectionId === "onePagerP2") patchOnePager({ bodyPart2: data.text });
        if (sectionId === "chat") patchChat({ message: data.text });
      }
      if (data.note) setAiNote(data.note);
      else if (data.source === "anthropic" && data.model) {
        setAiNote(`Generated with ${claudeModelLabel(data.model)}.`);
      }
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
          <h2 className="text-base font-medium">{label}</h2>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Edit this section — the PowerPoint preview on the right updates live.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5 scrollbar-thin">
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              AI draft
            </div>
            <div className="flex items-center gap-2">
              <ClaudeModelSelect sectionId={sectionId} />
              {aiLoading && (
                <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
              )}
            </div>
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
          {sectionId === "welcome" && (
            <>
              <Field
                label="Intro"
                rows={5}
                value={document.sections.welcome.intro}
                onChange={(intro) => patchWelcome({ intro })}
                placeholder="Welcome to your Mini Box…"
              />
              <Field
                label="What's inside"
                rows={6}
                value={document.sections.welcome.contents}
                onChange={(contents) => patchWelcome({ contents })}
              />
              <Field
                label="Closing"
                rows={4}
                value={document.sections.welcome.closing}
                onChange={(closing) => patchWelcome({ closing })}
              />
              <GifPicker
                defaultQuery={gifQuery}
                selected={document.sections.welcome.gif}
                onSelect={setGif}
              />
            </>
          )}

          {sectionId === "onePagerP1" && (
            <>
              <Field
                label="Greeting"
                rows={1}
                value={document.sections.onePager.greeting}
                onChange={(greeting) => patchOnePager({ greeting })}
              />
              <Field
                label="Subject line"
                rows={2}
                value={document.sections.onePager.subjectLine}
                onChange={(subjectLine) => patchOnePager({ subjectLine })}
                placeholder="🔒 …"
              />
              <Field
                label="Body · part 1"
                rows={7}
                value={document.sections.onePager.bodyPart1}
                onChange={(bodyPart1) => patchOnePager({ bodyPart1 })}
              />
              <Field
                label="Callout sidebar"
                rows={4}
                value={document.sections.onePager.callout}
                onChange={(callout) => patchOnePager({ callout })}
                placeholder="Short definition or highlight…"
              />
              <GifPicker
                defaultQuery={gifQuery}
                selected={document.sections.onePager.gif}
                onSelect={setGif}
              />
            </>
          )}

          {sectionId === "onePagerP2" && (
            <Field
              label="Body · part 2 / tips"
              rows={10}
              value={document.sections.onePager.bodyPart2}
              onChange={(bodyPart2) => patchOnePager({ bodyPart2 })}
            />
          )}

          {sectionId === "chat" && (
            <>
              <Field
                label="Chat message"
                rows={12}
                value={document.sections.chat.message}
                onChange={(message) => patchChat({ message })}
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
