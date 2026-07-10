export type IndexedDocument = {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  modifiedTime: string;
  text: string;
  webViewLink?: string;
};

export type KnowledgeIndex = {
  folderId: string;
  boxType: "mini-box" | "ciab";
  indexedAt: string;
  documents: IndexedDocument[];
};

const indexKey = (boxType: string, folderId: string) =>
  `box-studio:knowledge-index:${boxType}:${folderId}`;

export function loadKnowledgeIndex(
  boxType: "mini-box" | "ciab",
  folderId: string,
): KnowledgeIndex | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(indexKey(boxType, folderId));
    if (!raw) return null;
    return JSON.parse(raw) as KnowledgeIndex;
  } catch {
    return null;
  }
}

export function saveKnowledgeIndex(index: KnowledgeIndex) {
  localStorage.setItem(
    indexKey(index.boxType, index.folderId),
    JSON.stringify(index),
  );
}

export function clearKnowledgeIndex(
  boxType: "mini-box" | "ciab",
  folderId: string,
) {
  localStorage.removeItem(indexKey(boxType, folderId));
}
