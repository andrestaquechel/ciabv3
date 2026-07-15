import {
  loadAppSettingsFromDrive,
  loadKnowledgeIndexFromDrive,
} from "@/lib/box-studio-drive-data";
import type { IndexedDocument } from "@/lib/knowledge-cache";

function scoreDocument(doc: IndexedDocument, terms: string[]): number {
  const haystack = `${doc.name} ${doc.path} ${doc.text}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (term.length < 3) continue;
    if (haystack.includes(term)) score += 1;
    if (doc.name.toLowerCase().includes(term)) score += 2;
  }
  // Prefer recent mini boxes (last ~2 years)
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
    const folderId = settings?.knowledgeFolders?.[boxType]?.folderId;
    if (!folderId) return "(no archive folder configured — set Mini Box archive in Settings → Knowledge)";

    const index = await loadKnowledgeIndexFromDrive(folderId);
    if (!index?.documents?.length) {
      return "(archive not indexed — open Knowledge page and click Build archive index)";
    }

    const terms = topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);

    const ranked = index.documents
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
