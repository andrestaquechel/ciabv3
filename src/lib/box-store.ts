import {
  createEmptyCiab,
  createEmptyMiniBox,
  type MiniBoxDocument,
} from "@/lib/mini-box";

export type BoxKind = "mini-box" | "ciab";

const STORAGE_KEY = "box-studio:boxes";
const LEGACY_KEY = "box-studio:mini-boxes";

function migrateDoc(raw: MiniBoxDocument): MiniBoxDocument {
  const base =
    raw.type === "ciab"
      ? createEmptyCiab(raw.topic || raw.title || "")
      : createEmptyMiniBox(raw.topic || raw.title || "");
  return {
    ...base,
    ...raw,
    articles: raw.articles || [],
    signature: raw.signature || "{{ SIGNATURE }}",
    sections: {
      ...base.sections,
      ...raw.sections,
      ideate: raw.sections?.ideate || base.sections.ideate,
      inputs: raw.sections?.inputs || base.sections.inputs,
      review: raw.sections?.review || base.sections.review,
      title: {
        ...base.sections.title,
        ...raw.sections?.title,
        topicTitle:
          raw.sections?.title?.topicTitle ||
          raw.topic ||
          base.sections.title.topicTitle,
      },
      welcome: {
        ...base.sections.welcome,
        ...(raw.sections?.welcome || {}),
      },
      onePager: {
        ...base.sections.onePager,
        ...(raw.sections?.onePager || {}),
        callout:
          raw.sections?.onePager?.callout ?? base.sections.onePager.callout,
      },
      chat: {
        ...base.sections.chat,
        ...(raw.sections?.chat || {}),
      },
    },
  };
}

function readAll(): MiniBoxDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return (JSON.parse(raw) as MiniBoxDocument[]).map(migrateDoc);
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = (JSON.parse(legacy) as MiniBoxDocument[]).map(migrateDoc);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

function writeAll(boxes: MiniBoxDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
}

export function listBoxes(): MiniBoxDocument[] {
  return readAll().sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function loadBox(id: string): MiniBoxDocument | null {
  const found = readAll().find((b) => b.id === id);
  return found ? migrateDoc(found) : null;
}

export function saveBox(doc: MiniBoxDocument) {
  const all = readAll();
  const idx = all.findIndex((b) => b.id === doc.id);
  const next = { ...doc, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
}

export function createBox(kind: BoxKind, topic = ""): MiniBoxDocument {
  return kind === "ciab" ? createEmptyCiab(topic) : createEmptyMiniBox(topic);
}

export function boxKindLabel(kind: BoxKind) {
  return kind === "ciab" ? "CIAB" : "Mini Box";
}

export const SYNC_PREVIEW_KEY = "box-studio:sync-preview";

export function loadSyncPreviewPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SYNC_PREVIEW_KEY);
  if (stored === "0") return false;
  return true;
}

export function saveSyncPreviewPreference(enabled: boolean) {
  localStorage.setItem(SYNC_PREVIEW_KEY, enabled ? "1" : "0");
}
