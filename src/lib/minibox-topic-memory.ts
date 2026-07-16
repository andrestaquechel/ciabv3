import {
  anthropicConfigured,
  anthropicJson,
  resolveAnthropicModel,
} from "@/lib/anthropic";
import {
  loadAppSettingsFromDrive,
  loadKnowledgeIndexFromDrive,
  loadTopicMemoryFromDrive,
  saveKnowledgeIndexToDrive,
  saveTopicMemoryToDrive,
} from "@/lib/box-studio-drive-data";
import { indexArchiveRecursive } from "@/lib/google-drive";
import type { IndexedDocument } from "@/lib/knowledge-cache";
import type { TopicCandidate } from "@/lib/mini-box-topic-prompts";

/** How far back the rolling topic memory keeps records. */
export const TOPIC_MEMORY_WINDOW_MONTHS = 24;

export type TopicSource = { name?: string; url?: string };

export type MiniBoxTopicRecord = {
  /** Stable key — Drive file id when known, else `${dateKey}:${slug}`. */
  id: string;
  title: string;
  month?: number;
  year?: number;
  /** "YYYY-MM" for windowing/sorting; derived from month/year when available. */
  dateKey?: string;
  driveFileId?: string;
  webViewLink?: string;
  /** 1–2 sentence plain summary of what the box covered. */
  topicSummary: string;
  /** The specific incidents / scams / examples used — what we must not repeat. */
  keyExamples: string[];
  /** Publisher + URL of the sources cited. */
  sources: TopicSource[];
  /** Lowercased keywords for fast prefiltering. */
  keywords: string[];
  /** When this record was added to the memory. */
  createdAt: string;
};

export type MiniBoxTopicMemory = {
  version: 1;
  updatedAt: string;
  records: MiniBoxTopicRecord[];
};

export function emptyTopicMemory(): MiniBoxTopicMemory {
  return { version: 1, updatedAt: new Date().toISOString(), records: [] };
}

// --- naming / dates -------------------------------------------------------

/** Parse "MM.YY Mini Box - Title" (the house naming convention) into parts.
 *  Falls back to just a title when the MM.YY prefix isn't present. */
export function parseMiniBoxName(
  name: string,
): { month?: number; year?: number; title: string } {
  const clean = (name || "").replace(/\.(pptx|pdf|json)$/i, "").trim();
  const m = clean.match(/^(\d{1,2})\.(\d{2})\s*mini\s*box\s*[-–:]\s*(.+)$/i);
  if (m) {
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    return {
      month: month >= 1 && month <= 12 ? month : undefined,
      year,
      title: m[3].trim(),
    };
  }
  // "Mini Box - Title" (no date prefix)
  const m2 = clean.match(/mini\s*box\s*[-–:]\s*(.+)$/i);
  return { title: (m2?.[1] ?? clean).trim() };
}

function dateKeyOf(month?: number, year?: number): string | undefined {
  if (!month || !year) return undefined;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** "YYYY-MM" for the earliest month still inside the window ending at `now`. */
function windowFloorKey(now: Date): string {
  const floor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TOPIC_MEMORY_WINDOW_MONTHS - 1), 1),
  );
  return `${floor.getUTCFullYear()}-${String(floor.getUTCMonth() + 1).padStart(2, "0")}`;
}

// --- window maintenance ---------------------------------------------------

/** Drop records older than the 2-year window, de-dupe by id, sort newest first.
 *  Records with no parseable date are kept (they can't be safely aged out). */
export function pruneToWindow(
  records: MiniBoxTopicRecord[],
  now: Date = new Date(),
): MiniBoxTopicRecord[] {
  const floor = windowFloorKey(now);
  const byId = new Map<string, MiniBoxTopicRecord>();
  for (const r of records) {
    if (r.dateKey && r.dateKey < floor) continue; // older than 2 years → evict
    byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) =>
    (b.dateKey || "0000-00").localeCompare(a.dateKey || "0000-00"),
  );
}

/** Add/replace one record and re-apply the rolling window (adds the new box,
 *  evicts anything that has aged past 2 years). */
export function upsertRecord(
  memory: MiniBoxTopicMemory,
  record: MiniBoxTopicRecord,
  now: Date = new Date(),
): MiniBoxTopicMemory {
  const merged = pruneToWindow([record, ...memory.records], now);
  return { version: 1, updatedAt: now.toISOString(), records: merged };
}

// --- Drive-backed load/save ----------------------------------------------

async function resolveArchiveFolderId(): Promise<string | null> {
  try {
    const settings = await loadAppSettingsFromDrive();
    return settings?.knowledgeFolders?.["mini-box"]?.folderId ?? null;
  } catch {
    return null;
  }
}

export async function loadTopicMemory(): Promise<MiniBoxTopicMemory> {
  const folderId = await resolveArchiveFolderId();
  if (!folderId) return emptyTopicMemory();
  try {
    const memory = await loadTopicMemoryFromDrive(folderId);
    if (!memory?.records) return emptyTopicMemory();
    // Always return within-window so callers never see stale entries.
    return { ...memory, records: pruneToWindow(memory.records) };
  } catch {
    return emptyTopicMemory();
  }
}

export async function saveTopicMemory(
  memory: MiniBoxTopicMemory,
): Promise<boolean> {
  const folderId = await resolveArchiveFolderId();
  if (!folderId) return false;
  try {
    await saveTopicMemoryToDrive(folderId, memory);
    return true;
  } catch {
    return false;
  }
}

// --- distillation ---------------------------------------------------------

type Distilled = {
  topicSummary: string;
  keyExamples: string[];
  sources: TopicSource[];
  keywords: string[];
};

const DISTILL_SYSTEM =
  "You distill a past Living Security Mini Box (a short security-awareness piece) into a compact record used to avoid repeating topics. Return JSON only.";

function distillUser(title: string, text: string): string {
  return `Summarize this Mini Box for a topic-memory index.

TITLE: ${title}

CONTENT:
${text.slice(0, 6000)}

Return JSON:
{
  "topicSummary": "1-2 sentence plain-language summary of the security topic and the core lesson",
  "keyExamples": ["the specific incidents, scams, brands, or examples used — the concrete details another box should not simply reuse"],
  "sources": [{ "name": "publisher", "url": "https://..." }],
  "keywords": ["lowercase", "topic", "keywords", "for", "matching"]
}`;
}

export async function distillText(
  title: string,
  text: string,
  model?: string,
): Promise<Distilled | null> {
  if (!anthropicConfigured() || !text?.trim()) return null;
  try {
    const resolved = model || (await resolveAnthropicModel());
    const out = await anthropicJson<Distilled>({
      system: DISTILL_SYSTEM,
      user: distillUser(title, text),
      temperature: 0.2,
      maxTokens: 1024,
      model: resolved,
    });
    return {
      topicSummary: out.topicSummary || "",
      keyExamples: Array.isArray(out.keyExamples) ? out.keyExamples.slice(0, 8) : [],
      sources: Array.isArray(out.sources) ? out.sources.slice(0, 6) : [],
      keywords: Array.isArray(out.keywords)
        ? out.keywords.map((k) => String(k).toLowerCase()).slice(0, 20)
        : [],
    };
  } catch {
    return null;
  }
}

function recordFromDoc(
  doc: IndexedDocument,
  distilled: Distilled,
): MiniBoxTopicRecord {
  const parsed = parseMiniBoxName(doc.name);
  return {
    id: doc.id,
    title: parsed.title || doc.name,
    month: parsed.month,
    year: parsed.year,
    dateKey: dateKeyOf(parsed.month, parsed.year),
    driveFileId: doc.id,
    webViewLink: doc.webViewLink,
    ...distilled,
    createdAt: new Date().toISOString(),
  };
}

/** Which docs in the full-text index fall inside the 2-year window and aren't
 *  yet in the topic memory. Uses the MM.YY filename date when present, else the
 *  Drive modifiedTime. */
function docsNeedingDistill(
  docs: IndexedDocument[],
  memory: MiniBoxTopicMemory,
  now: Date,
): IndexedDocument[] {
  const floor = windowFloorKey(now);
  const have = new Set(memory.records.map((r) => r.driveFileId ?? r.id));
  return docs.filter((d) => {
    if (!d.text?.trim()) return false;
    if (have.has(d.id)) return false;
    const parsed = parseMiniBoxName(d.name);
    const key =
      dateKeyOf(parsed.month, parsed.year) ??
      (d.modifiedTime && !Number.isNaN(Date.parse(d.modifiedTime))
        ? d.modifiedTime.slice(0, 7)
        : undefined);
    // Keep undated docs (can't prove they're out of window); drop clearly old ones.
    return key ? key >= floor : true;
  });
}

/** Run up to `limit` async tasks with a bounded concurrency pool. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type BackfillResult = {
  configured: boolean;
  distilled: number;
  remaining: number;
  total: number;
  /** True when the archive had no full-text index and we scraped it once. */
  scraped: boolean;
};

/**
 * Backfill the topic memory from the archive — the engine behind both the
 * automatic fill and the manual API route. Distills each in-window box that
 * isn't in memory yet (idempotent: already-distilled boxes are skipped), with
 * bounded concurrency, and saves once.
 *
 * Prefers the existing full-text archive index (no Drive re-scrape). If that
 * index is missing and `allowScrape` is set, it scrapes the archive folder ONCE
 * (and caches it as the knowledge index so /ask benefits too) — after that,
 * fills read the small cached memory, never re-scraping.
 *
 * `maxDistill` caps work per invocation so a serverless request can't time out;
 * it's resumable, so a large archive finishes across a few calls.
 */
export async function runTopicMemoryBackfill({
  maxDistill = 60,
  concurrency = 5,
  allowScrape = false,
  model,
}: {
  maxDistill?: number;
  concurrency?: number;
  allowScrape?: boolean;
  model?: string;
} = {}): Promise<BackfillResult> {
  const folderId = await resolveArchiveFolderId();
  if (!folderId) {
    return { configured: false, distilled: 0, remaining: 0, total: 0, scraped: false };
  }
  if (!anthropicConfigured()) {
    return { configured: true, distilled: 0, remaining: 0, total: 0, scraped: false };
  }

  let docs = (await loadKnowledgeIndexFromDrive(folderId))?.documents ?? [];
  let scraped = false;

  // No full-text index yet → scrape the archive once so the memory has a source.
  if (!docs.length && allowScrape) {
    try {
      docs = await indexArchiveRecursive(folderId);
      scraped = true;
      if (docs.length) {
        await saveKnowledgeIndexToDrive({
          folderId,
          boxType: "mini-box",
          indexedAt: new Date().toISOString(),
          documents: docs,
        });
      }
    } catch {
      docs = [];
    }
  }

  const memory = await loadTopicMemory();
  const now = new Date();
  const pending = docsNeedingDistill(docs, memory, now);
  const total = pending.length;
  if (!total) {
    return { configured: true, distilled: 0, remaining: 0, total: 0, scraped };
  }

  const batch = pending.slice(0, Math.max(1, maxDistill));
  const resolved = model || (await resolveAnthropicModel());

  const distilledRecords = (
    await mapPool(batch, concurrency, async (doc) => {
      const d = await distillText(
        parseMiniBoxName(doc.name).title || doc.name,
        doc.text,
        resolved,
      );
      return d ? recordFromDoc(doc, d) : null;
    })
  ).filter((r): r is MiniBoxTopicRecord => Boolean(r));

  let working = memory;
  for (const rec of distilledRecords) working = upsertRecord(working, rec, now);
  if (distilledRecords.length) await saveTopicMemory(working);

  return {
    configured: true,
    distilled: distilledRecords.length,
    remaining: Math.max(0, total - distilledRecords.length),
    total,
    scraped,
  };
}

/** Thin wrapper kept for the manual API route (batched, no scrape). */
export async function backfillTopicMemory({
  maxPerRun = 10,
  model,
}: { maxPerRun?: number; model?: string } = {}): Promise<BackfillResult> {
  return runTopicMemoryBackfill({
    maxDistill: maxPerRun,
    concurrency: 4,
    allowScrape: true,
    model,
  });
}

/**
 * Automatic, no-button fill used by the topic-research flow. Fills the memory
 * from the archive if it's incomplete. "full" mode (background jobs) fills the
 * whole in-window archive in one go and may scrape once; "incremental" mode
 * (synchronous requests) distills only a small bounded batch so it never risks a
 * timeout. Both are resumable and best-effort — failures never block research.
 */
export async function ensureTopicMemoryFilled(
  mode: "full" | "incremental" = "incremental",
  model?: string,
): Promise<void> {
  try {
    if (mode === "full") {
      // Loop until the archive is fully distilled (resumable; capped per call).
      for (let i = 0; i < 20; i++) {
        const r = await runTopicMemoryBackfill({
          maxDistill: 40,
          concurrency: 5,
          allowScrape: true,
          model,
        });
        if (!r.configured || r.remaining === 0 || r.distilled === 0) break;
      }
    } else {
      await runTopicMemoryBackfill({
        maxDistill: 8,
        concurrency: 4,
        allowScrape: false,
        model,
      });
    }
  } catch {
    // best-effort — topic memory is optional
  }
}

// --- self-update on box creation -----------------------------------------

/** Distill a freshly generated Mini Box and fold it into the rolling memory
 *  (adds the new box, evicts anything now older than 2 years). Best-effort. */
export async function addGeneratedBoxToMemory(input: {
  title: string;
  topic: string;
  month?: number;
  year?: number;
  driveFileId?: string;
  webViewLink?: string;
  /** Full box text (welcome/one-pager/chat concatenated) for distillation. */
  contentText: string;
  /** Sources already known from the selected topic candidate, if any. */
  sources?: TopicSource[];
  model?: string;
}): Promise<boolean> {
  const folderId = await resolveArchiveFolderId();
  if (!folderId) return false;

  const now = new Date();
  const memory = await loadTopicMemory();
  const distilled = await distillText(input.title || input.topic, input.contentText, input.model);

  const parsed = { month: input.month, year: input.year };
  const dateKey = dateKeyOf(parsed.month, parsed.year);
  const id =
    input.driveFileId ??
    `${dateKey ?? "undated"}:${slugify(input.title || input.topic)}`;

  const mergedSources = [
    ...(input.sources ?? []),
    ...(distilled?.sources ?? []),
  ]
    .filter((s) => s && (s.name || s.url))
    .slice(0, 6);

  const record: MiniBoxTopicRecord = {
    id,
    title: input.title || input.topic,
    month: parsed.month,
    year: parsed.year,
    dateKey,
    driveFileId: input.driveFileId,
    webViewLink: input.webViewLink,
    topicSummary: distilled?.topicSummary || input.topic,
    keyExamples: distilled?.keyExamples ?? [],
    sources: mergedSources,
    keywords: distilled?.keywords ?? deriveKeywords(`${input.title} ${input.topic}`),
    createdAt: now.toISOString(),
  };

  return saveTopicMemory(upsertRecord(memory, record, now));
}

function deriveKeywords(text: string): string[] {
  return [
    ...new Set(
      (text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3),
    ),
  ].slice(0, 12);
}

// --- cross-reference ------------------------------------------------------

function candidateKeywords(c: TopicCandidate): string[] {
  return deriveKeywords(`${c.topicHook} ${c.whatHappened} ${c.endUserMeaning}`);
}

/** Cheap keyword-overlap prefilter: records that share any keyword with the
 *  candidate are the only ones worth a model comparison. */
function relatedRecords(
  c: TopicCandidate,
  memory: MiniBoxTopicMemory,
): MiniBoxTopicRecord[] {
  const terms = new Set(candidateKeywords(c));
  return memory.records.filter((r) => {
    const hay = new Set([
      ...(r.keywords ?? []),
      ...deriveKeywords(`${r.title} ${r.topicSummary}`),
    ]);
    for (const t of terms) if (hay.has(t)) return true;
    return false;
  });
}

function refLabel(r: MiniBoxTopicRecord): string {
  const mm = r.month ? String(r.month).padStart(2, "0") : undefined;
  const yy = r.year ? String(r.year % 100).padStart(2, "0") : undefined;
  return mm && yy ? `${mm}.${yy} ${r.title}` : r.title;
}

const COVERAGE_RANK: Record<string, number> = {
  none: 0,
  related: 1,
  duplicate: 2,
};

type CoverageVerdict = {
  id: string;
  priorCoverage: "none" | "related" | "duplicate";
  ref?: string;
  note?: string;
};

/**
 * Annotate each candidate with how it overlaps the last ~2 years of Mini Boxes
 * and reorder so duplicates sink to the bottom. Rule (per house policy): a topic
 * that BUILDS UPON a prior box is fine ("related"); one that repeats the exact
 * same content AND examples is a "duplicate" and gets deprioritized.
 */
export async function crossReferenceCandidates(
  candidates: TopicCandidate[],
  memory: MiniBoxTopicMemory,
  model?: string,
): Promise<TopicCandidate[]> {
  if (!candidates.length || !memory.records.length) return candidates;

  // Only candidates with a keyword-overlapping prior box need a model verdict.
  const withRelated = candidates
    .map((c) => ({ c, related: relatedRecords(c, memory) }))
    .filter((x) => x.related.length);

  if (!withRelated.length || !anthropicConfigured()) {
    return candidates.map((c) => ({ ...c, priorCoverage: "none" as const }));
  }

  const priorContext = withRelated
    .flatMap((x) => x.related)
    .filter((r, i, arr) => arr.findIndex((o) => o.id === r.id) === i)
    .map((r) =>
      [
        `PAST BOX: ${refLabel(r)}`,
        `Summary: ${r.topicSummary}`,
        r.keyExamples.length ? `Examples used: ${r.keyExamples.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  const candidateContext = withRelated
    .map((x) =>
      [
        `CANDIDATE ${x.c.id}: ${x.c.topicHook}`,
        `What happened: ${x.c.whatHappened}`,
        `For employees: ${x.c.endUserMeaning}`,
      ].join("\n"),
    )
    .join("\n\n");

  let verdicts: CoverageVerdict[] = [];
  try {
    const resolved = model || (await resolveAnthropicModel());
    const parsed = await anthropicJson<{ verdicts: CoverageVerdict[] }>({
      system:
        "You compare proposed Mini Box topics against past Mini Boxes to prevent repetition. Return JSON only. Judgment rule: it is GOOD to build upon or advance a prior topic with a fresh angle, new incident, or new lesson (mark 'related'); it is BAD to repeat the SAME content AND the SAME examples/incidents (mark 'duplicate'). If a candidate has no meaningful overlap, mark 'none'.",
      user: `PAST MINI BOXES (last ~2 years):
${priorContext}

PROPOSED CANDIDATES:
${candidateContext}

For each candidate id above, decide its overlap with the closest past box.
Return JSON:
{
  "verdicts": [
    {
      "id": "<candidate id>",
      "priorCoverage": "none | related | duplicate",
      "ref": "the closest past box label, e.g. '07.25 16 Billion Passwords' (omit if none)",
      "note": "one short line: how it advances the prior box (related) or why it repeats it (duplicate)"
    }
  ]
}`,
      temperature: 0.2,
      maxTokens: 1500,
      model: resolved,
    });
    verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
  } catch {
    verdicts = [];
  }

  const byId = new Map(verdicts.map((v) => [String(v.id), v] as const));
  const annotated = candidates.map((c) => {
    const v = byId.get(String(c.id));
    const priorCoverage = v?.priorCoverage ?? "none";
    return {
      ...c,
      priorCoverage,
      priorCoverageRef: priorCoverage === "none" ? undefined : v?.ref,
      priorCoverageNote: priorCoverage === "none" ? undefined : v?.note,
    };
  });

  // Auto-deprioritize: duplicates sink, then related, then fresh — stable within
  // each group so the researcher's original ordering is otherwise preserved.
  return annotated
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        COVERAGE_RANK[a.c.priorCoverage ?? "none"] -
          COVERAGE_RANK[b.c.priorCoverage ?? "none"] || a.i - b.i,
    )
    .map((x) => x.c);
}
