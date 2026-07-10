"use client";

import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";

export function LocalRenderPreview({
  document,
  activeSection,
}: {
  document: MiniBoxDocument;
  activeSection: MiniBoxSectionId;
}) {
  const s = document.sections;
  const topic = s.title.topicTitle || document.topic || "Untitled Mini Box";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          Local render
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Live Mini Box preview · mirrors template structure
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4 scrollbar-thin">
        <SlideCard
          active={
            activeSection === "title" ||
            activeSection === "inputs" ||
            activeSection === "ideate"
          }
          label="Slide 1 · Cover"
        >
          <h3 className="text-xl font-semibold tracking-tight">{topic}</h3>
          <div className="mt-4 space-y-1 text-xs text-[var(--text-muted)]">
            <div>Welcome Message for Program Owners</div>
            <div>One-Pager</div>
            <div>Chat</div>
          </div>
          {document.articles.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-dim)]">
              Sources: {document.articles.map((a) => a.title || a.url).filter(Boolean).join(" · ") || "—"}
            </div>
          )}
        </SlideCard>

        <SlideCard active={activeSection === "welcome"} label="Slide 2 · Welcome">
          <div className="mb-2 text-xs font-medium text-[var(--accent)]">
            Welcome Message for Program Owners
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {s.welcome.intro || "Intro will appear here…"}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {s.welcome.contents || "Contents list will appear here…"}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-xs text-[var(--text-dim)]">
            {s.welcome.closing}
          </p>
          {s.welcome.gif && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.welcome.gif.previewUrl}
              alt={s.welcome.gif.title}
              className="mt-3 max-h-28 rounded-xl object-cover"
            />
          )}
        </SlideCard>

        <SlideCard active={activeSection === "onePager"} label="Slides 4–5 · One-Pager / Email">
          <div className="text-xs text-[var(--text-dim)]">{s.onePager.greeting}</div>
          <div className="mt-2 text-base font-medium">
            {s.onePager.subjectLine || "Subject line…"}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {s.onePager.bodyPart1 || "Body part 1…"}
          </p>
          {s.onePager.gif && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.onePager.gif.previewUrl}
              alt={s.onePager.gif.title}
              className="mt-3 max-h-28 rounded-xl object-cover"
            />
          )}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {s.onePager.bodyPart2 || "Body part 2 / tips…"}
          </p>
          <p className="mt-3 text-xs text-[var(--text-dim)]">{document.signature}</p>
        </SlideCard>

        <SlideCard active={activeSection === "chat"} label="Slide 7 · Chat">
          <div className="mb-2 text-xs font-medium text-[var(--accent)]">Chat Message</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {s.chat.message || "Chat scenario will appear here…"}
          </p>
          {s.chat.gif && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.chat.gif.previewUrl}
              alt={s.chat.gif.title}
              className="mt-3 max-h-28 rounded-xl object-cover"
            />
          )}
        </SlideCard>
      </div>
    </div>
  );
}

function SlideCard({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]/30"
          : "border-[var(--border)] bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      {children}
    </div>
  );
}
