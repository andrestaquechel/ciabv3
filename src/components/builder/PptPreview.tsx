"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MiniBoxDocument, MiniBoxSectionId } from "@/lib/mini-box";

type SlideDef = {
  id: string;
  label: string;
  section: MiniBoxSectionId | MiniBoxSectionId[];
};

const SLIDES: SlideDef[] = [
  { id: "1", label: "Cover", section: ["ideate", "inputs", "title"] },
  { id: "2", label: "Welcome", section: "welcome" },
  { id: "3", label: "One-Pager divider", section: "onePager" },
  { id: "4", label: "One-Pager · part 1", section: "onePager" },
  { id: "5", label: "Email / tips", section: "onePager" },
  { id: "6", label: "Chats divider", section: "chat" },
  { id: "7", label: "Chat Message", section: "chat" },
];

function sectionToSlideIndex(section: MiniBoxSectionId): number {
  if (section === "ideate" || section === "inputs" || section === "title")
    return 0;
  if (section === "welcome") return 1;
  if (section === "onePager") return 3;
  if (section === "chat") return 6;
  if (section === "review") return 0;
  return 0;
}

export function PptPreview({
  document,
  activeSection,
}: {
  document: MiniBoxDocument;
  activeSection: MiniBoxSectionId;
}) {
  const [index, setIndex] = useState(0);
  const s = document.sections;
  const topic = s.title.topicTitle || document.topic || "Untitled Mini Box";

  useEffect(() => {
    setIndex(sectionToSlideIndex(activeSection));
  }, [activeSection]);

  const slide = SLIDES[index];

  const body = useMemo(() => {
    switch (slide.id) {
      case "1":
        return (
          <>
            <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--accent)]">
              MINI BOX
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              {topic}
            </h3>
            <div className="mt-6 space-y-1.5 text-sm text-[var(--text-muted)]">
              <div>Welcome Message for Program Owners</div>
              <div>One-Pager</div>
              <div>Chat</div>
            </div>
          </>
        );
      case "2":
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div>
              <div className="mb-2 text-sm font-medium text-[var(--accent)]">
                Welcome Message for Program Owners
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                {s.welcome.intro || "Intro…"}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                {s.welcome.contents || "Contents…"}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-xs text-[var(--text-dim)]">
                {s.welcome.closing}
              </p>
            </div>
            {s.welcome.gif && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.welcome.gif.previewUrl}
                alt=""
                className="h-32 w-full rounded-xl object-cover"
              />
            )}
          </div>
        );
      case "3":
        return (
          <div className="flex h-full items-center justify-center">
            <h3 className="text-3xl font-semibold">One-Pager</h3>
          </div>
        );
      case "4":
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div>
              <div className="text-[11px] text-[var(--text-dim)]">
                Email or One-Pager
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {s.onePager.greeting}
              </div>
              <div className="mt-2 text-lg font-medium">
                {s.onePager.subjectLine || "Subject line…"}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                {s.onePager.bodyPart1 || "Body part 1…"}
              </p>
            </div>
            {s.onePager.gif && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.onePager.gif.previewUrl}
                alt=""
                className="h-32 w-full rounded-xl object-cover"
              />
            )}
          </div>
        );
      case "5":
        return (
          <>
            <div className="text-[11px] text-[var(--text-dim)]">Email Message</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
              {s.onePager.bodyPart2 || "Body part 2 / tips…"}
            </p>
            <p className="mt-4 text-xs text-[var(--text-dim)]">
              {document.signature}
            </p>
          </>
        );
      case "6":
        return (
          <div className="flex h-full items-center justify-center">
            <h3 className="text-3xl font-semibold">Chats</h3>
          </div>
        );
      case "7":
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div>
              <div className="mb-2 text-sm font-medium text-[var(--accent)]">
                Chat Message
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                {s.chat.message || "Chat scenario…"}
              </p>
            </div>
            {s.chat.gif && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.chat.gif.previewUrl}
                alt=""
                className="h-32 w-full rounded-xl object-cover"
              />
            )}
          </div>
        );
      default:
        return null;
    }
  }, [slide.id, s, topic, document.signature]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            PowerPoint preview
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Slide {index + 1} of {SLIDES.length} · {slide.label}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
            disabled={index === SLIDES.length - 1}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#0a0a0c] p-4">
        <div className="aspect-video w-full max-w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] scrollbar-thin">
          {body}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2 scrollbar-thin">
        {SLIDES.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] ${
              i === index
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
            }`}
          >
            {i + 1}. {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
