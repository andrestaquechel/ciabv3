export type BoxType = "mini-box" | "ciab";

export type KnowledgeFolderConfig = {
  folderId: string;
  folderUrl: string;
  folderName?: string;
  setAt: string;
};

export type KnowledgeSettings = {
  "mini-box"?: KnowledgeFolderConfig;
  ciab?: KnowledgeFolderConfig;
};

const STORAGE_KEY = "box-studio:knowledge-folders";

export function loadKnowledgeSettings(): KnowledgeSettings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveKnowledgeSettings(settings: KnowledgeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getFolderConfig(type: BoxType): KnowledgeFolderConfig | null {
  return loadKnowledgeSettings()[type] ?? null;
}

export function setFolderConfig(type: BoxType, config: KnowledgeFolderConfig) {
  const settings = loadKnowledgeSettings();
  settings[type] = config;
  saveKnowledgeSettings(settings);
}

export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}
