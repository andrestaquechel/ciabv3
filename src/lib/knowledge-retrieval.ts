import {
  loadAppSettingsFromDrive,
  loadKnowledgeIndexFromDrive,
} from "@/lib/box-studio-drive-data";
import type { IndexedDocument } from "@/lib/knowledge-cache";
import {
  exportFileText,
  listFolderEntries,
  type DriveEntry,
} from "@/lib/google-drive";

/**
 * Default archive folders, used when no folder is configured in Settings →
 * Knowledge. Overridable via env. The CIAB default points at the shared
 * "01_Main Boxes" archive so Main Box generation is grounded in the real
 * example decks out of the box.
 */
const DEFAULT_ARCHIVE_FOLDERS: Record<"mini-box" | "ciab", string | undefined> = {
  "mini-box": process.env.BOX_STUDIO_MINIBOX_ARCHIVE_FOLDER_ID?.trim() || undefined,
  ciab:
    process.env.BOX_STUDIO_CIAB_ARCHIVE_FOLDER_ID?.trim() ||
    "1NaeoSR0XzR7eIjq9mzs_3KiUV03eDpkg",
};

const INDEXABLE_ARCHIVE_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "application/pdf",
]);

/** In-memory cache of live-scanned archive docs (per folder), 30-minute TTL. */
const liveScanCache = new Map<string, { at: number; docs: IndexedDocument[] }>();
const LIVE_SCAN_TTL_MS = 30 * 60 * 1000;

function scoreDocument(doc: IndexedDocument, terms: string[]): number {
  const haystack = `${doc.name} ${doc.path} ${doc.text}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (term.length < 3) continue;
    if (haystack.includes(term)) score += 1;
    if (doc.name.toLowerCase().includes(term)) score += 2;
  }
  // Prefer recent boxes (last ~2 years)
  const modified = Date.parse(doc.modifiedTime);
  if (!Number.isNaN(modified)) {
    const ageDays = (Date.now() - modified) / (1000 * 60 * 60 * 24);
    if (ageDays <= 730) score += 1;
    if (ageDays <= 365) score += 1;
  }
  return score;
}

function excerpt(text: string, maxChars = 2400): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}…`;
}

/**
 * Live fallback used when no prebuilt knowledge index exists: walk the archive
 * (bounded depth), take the most recent example documents, and export their
 * text on the fly. Cached in-memory so repeated generations in one box do not
 * re-scan Drive.
 */
async function liveScanArchive(
  folderId: string,
  limit: number,
): Promise<IndexedDocument[]> {
  const cached = liveScanCache.get(folderId);
  if (cached && Date.now() - cached.at < LIVE_SCAN_TTL_MS) return cached.docs;

  // Collect candidate files across the folder and one level of subfolders
  // (archives are typically organized as year subfolders).
  const candidates: Array<DriveEntry & { path: string }> = [];
  const maxFilesToConsider = 120;

  async function collect(currentId: string, path: string, depth: number) {
    if (candidates.length >= maxFilesToConsider) return;
    const entries = await listFolderEntries(currentId);
    for (const entry of entries) {
      if (candidates.length >= maxFilesToConsider) break;
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isFolder) {
        if (depth < 2) await collect(entry.id, entryPath, depth + 1);
      } else if (INDEXABLE_ARCHIVE_MIMES.has(entry.mimeType)) {
        candidates.push({ ...entry, path: entryPath });
      }
    }
  }

  await collect(folderId, "", 0);

  // Most recent first, then export text for just the top `limit`.
  candidates.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
  const top = candidates.slice(0, limit);

  const docs: IndexedDocument[] = [];
  for (const c of top) {
    let text = "";
    try {
      text = await exportFileText(c.id, c.mimeType);
    } catch {
      text = "";
    }
    if (!text.trim()) continue;
    docs.push({
      id: c.id,
      name: c.name,
      path: c.path,
      mimeType: c.mimeType,
      modifiedTime: c.modifiedTime,
      text,
      webViewLink: c.webViewLink,
    });
  }

  liveScanCache.set(folderId, { at: Date.now(), docs });
  return docs;
}

export async function retrieveArchiveExamples({
  topic,
  boxType = "mini-box",
  limit = 4,
  maxChars = 12000,
}: {
  topic: string;
  boxType?: "mini-box" | "ciab";
  limit?: number;
  maxChars?: number;
}): Promise<string> {
  try {
    const settings = await loadAppSettingsFromDrive();
    const folderId =
      settings?.knowledgeFolders?.[boxType]?.folderId ||
      DEFAULT_ARCHIVE_FOLDERS[boxType];
    if (!folderId) {
      return `(no archive folder configured — set the ${boxType === "ciab" ? "CIAB" : "Mini Box"} archive in Settings → Knowledge)`;
    }

    let documents = (await loadKnowledgeIndexFromDrive(folderId))?.documents;

    // No prebuilt index → scan the archive live (bounded + cached) so
    // generation is still grounded in real example boxes.
    if (!documents?.length) {
      documents = await liveScanArchive(folderId, Math.max(limit, 5));
    }

    if (!documents?.length) {
      return "(archive not indexed and live scan returned nothing — check Drive access or build the archive index on the Knowledge page)";
    }

    const terms = topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);

    const ranked = documents
      .filter((d) => d.text?.trim())
      .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
      .sort((a, b) => b.score - a.score || b.doc.modifiedTime.localeCompare(a.doc.modifiedTime));

    const picks =
      ranked.some((r) => r.score > 0)
        ? ranked.filter((r) => r.score > 0).slice(0, limit)
        : ranked.slice(0, limit);

    const blocks: string[] = [];
    let total = 0;
    for (const { doc } of picks) {
      const block = [
        `EXAMPLE: ${doc.path || doc.name}`,
        `Modified: ${doc.modifiedTime}`,
        excerpt(doc.text),
      ].join("\n");
      if (total + block.length > maxChars) break;
      blocks.push(block);
      total += block.length;
    }

    return blocks.length ? blocks.join("\n\n---\n\n") : "(no matching archive examples found)";
  } catch {
    return "(could not load archive — check BOX_STUDIO_GOOGLE_REFRESH_TOKEN on Vercel)";
  }
}
