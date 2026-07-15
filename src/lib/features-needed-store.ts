export const DEFAULT_FEATURE_AUTHOR = "Andres T";

export type FeatureRequest = {
  id: string;
  body: string;
  author: string;
  /** Pasted or attached screenshot (data URL) */
  imageDataUrl?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "box-studio:features-needed";

function readAll(): FeatureRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeatureRequest[];
  } catch {
    return [];
  }
}

function writeAll(items: FeatureRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listFeatureRequests(): FeatureRequest[] {
  return readAll().sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function saveFeatureRequest(item: FeatureRequest) {
  const all = readAll();
  const idx = all.findIndex((f) => f.id === item.id);
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
}

export function deleteFeatureRequest(id: string) {
  writeAll(readAll().filter((f) => f.id !== id));
}

export function createFeatureRequest(
  body: string,
  author: string,
  imageDataUrl?: string,
): FeatureRequest {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    body: body.trim(),
    author: author.trim() || DEFAULT_FEATURE_AUTHOR,
    imageDataUrl,
    createdAt: now,
    updatedAt: now,
  };
}
