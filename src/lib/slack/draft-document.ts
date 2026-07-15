import { createEmptyMiniBox, type MiniBoxDocument } from "@/lib/mini-box";
import { applyGeneratedMiniBoxToDocument } from "@/lib/mini-box";
import type { GeneratedBoxDraft } from "@/lib/box-studio-drive-data";

export function draftToMiniBoxDocument(draft: GeneratedBoxDraft): MiniBoxDocument {
  const doc = createEmptyMiniBox(draft.topic);
  return applyGeneratedMiniBoxToDocument(
    doc,
    draft.topic,
    draft.outline as import("@/lib/mini-box-prompts").MiniBoxOutline | string | null,
    draft.sections,
    draft.gifs,
  );
}

export function slidePreviewText(doc: MiniBoxDocument): string {
  const s = doc.sections;
  return [
    `*Slide preview — ${doc.topic}*`,
    "",
    "*Cover:* " + (s.title.topicTitle || doc.topic),
    "",
    "*Welcome (intro):*",
    s.welcome.intro.slice(0, 400) + (s.welcome.intro.length > 400 ? "…" : ""),
    "",
    "*One-pager subject:* " + s.onePager.subjectLine,
    "*Callout:* " + s.onePager.callout,
    "",
    "*Chat:*",
    s.chat.message.slice(0, 400) + (s.chat.message.length > 400 ? "…" : ""),
  ].join("\n");
}
