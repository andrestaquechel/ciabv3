import { Readable } from "stream";
import { getDriveClient } from "@/lib/google-drive";

const DATA_FOLDER_NAME = "Box Studio Data";
const META_FOLDER_NAME = ".box-studio";
const APP_SETTINGS_FILE = "app-settings.json";
const KNOWLEDGE_INDEX_FILE = "knowledge-index.json";
const DRAFTS_FOLDER = "generated-drafts";
const SLACK_WORKFLOWS_FOLDER = "slack-workflows";

const FOLDER_MIME = "application/vnd.google-apps.folder";

import type { GenerationPromptsConfig } from "@/lib/mini-box-prompts";
import type { AnnualCalendarsConfig } from "@/lib/annual-calendar-types";
import type { TopicResearchPromptsConfig } from "@/lib/mini-box-topic-prompts";

export type AppSettingsPayload = {
  claudeModel?: string;
  generationPrompts?: GenerationPromptsConfig;
  topicResearchPrompts?: TopicResearchPromptsConfig;
  annualCalendars?: AnnualCalendarsConfig;
  slackReview?: {
    /** Slack user IDs (U…) to @mention for CSM review */
    csmUserIds?: string[];
    /** Slack user ID for Morgan — can click Apply CSM feedback */
    morganUserId?: string;
  };
  /** Maps `${channelId}:${threadTs}` → workflow id */
  slackActiveThreads?: Record<string, string>;
  knowledgeFolders?: {
    "mini-box"?: {
      folderId: string;
      folderUrl: string;
      folderName?: string;
      setAt: string;
    };
    ciab?: {
      folderId: string;
      folderUrl: string;
      folderName?: string;
      setAt: string;
    };
  };
  updatedAt?: string;
  updatedBy?: string;
};

async function findChildByName(parentId: string, name: string, mimeType?: string) {
  const drive = await getDriveClient();
  const mimeFilter = mimeType ? ` and mimeType='${mimeType}'` : "";
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false${mimeFilter}`,
    fields: "files(id,name,mimeType)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findChildByName(parentId, name, FOLDER_MIME);
  if (existing) return existing;

  const drive = await getDriveClient();
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Could not create folder "${name}".`);
  return created.data.id;
}

/** Read-only lookup — never creates folders (safe with drive.readonly tokens). */
async function findSharedDataFolderId(): Promise<string | null> {
  const fromEnv = process.env.BOX_STUDIO_DATA_FOLDER_ID?.trim();
  if (fromEnv) return fromEnv;

  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: `name='${DATA_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false and 'root' in parents`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Shared team folder for app settings (env override or auto-created in My Drive). */
export async function getSharedDataFolderId(): Promise<string> {
  const existing = await findSharedDataFolderId();
  if (existing) return existing;

  const drive = await getDriveClient();
  const created = await drive.files.create({
    requestBody: {
      name: DATA_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      parents: ["root"],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Could not create Box Studio Data folder.");
  return created.data.id;
}

async function findArchiveMetaFolderId(
  archiveFolderId: string,
): Promise<string | null> {
  return findChildByName(archiveFolderId, META_FOLDER_NAME, FOLDER_MIME);
}

export async function ensureArchiveMetaFolder(archiveFolderId: string): Promise<string> {
  return ensureFolder(archiveFolderId, META_FOLDER_NAME);
}

async function readJsonFile<T>(fileId: string): Promise<T | null> {
  const drive = await getDriveClient();
  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "text" },
    );
    const text = String(res.data ?? "").trim();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function upsertJsonFile(
  parentFolderId: string,
  fileName: string,
  payload: unknown,
): Promise<void> {
  const drive = await getDriveClient();
  const body = JSON.stringify(payload, null, 2);
  const existingId = await findChildByName(parentFolderId, fileName);

  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: {
        mimeType: "application/json",
        body: Readable.from([body]),
      },
      supportsAllDrives: true,
    });
    return;
  }

  await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/json",
      parents: [parentFolderId],
    },
    media: {
      mimeType: "application/json",
      body: Readable.from([body]),
    },
    fields: "id",
    supportsAllDrives: true,
  });
}

export async function loadAppSettingsFromDrive(): Promise<AppSettingsPayload | null> {
  const dataFolderId = await findSharedDataFolderId();
  if (!dataFolderId) return null;
  const fileId = await findChildByName(dataFolderId, APP_SETTINGS_FILE);
  if (!fileId) return null;
  return readJsonFile<AppSettingsPayload>(fileId);
}

export async function saveAppSettingsToDrive(
  settings: AppSettingsPayload,
  updatedBy?: string,
): Promise<AppSettingsPayload> {
  const dataFolderId = await getSharedDataFolderId();
  const next: AppSettingsPayload = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await upsertJsonFile(dataFolderId, APP_SETTINGS_FILE, next);
  return next;
}

export async function loadKnowledgeIndexFromDrive(
  archiveFolderId: string,
): Promise<import("@/lib/knowledge-cache").KnowledgeIndex | null> {
  const metaFolderId = await findArchiveMetaFolderId(archiveFolderId);
  if (!metaFolderId) return null;
  const fileId = await findChildByName(metaFolderId, KNOWLEDGE_INDEX_FILE);
  if (!fileId) return null;
  return readJsonFile(fileId);
}

export async function saveKnowledgeIndexToDrive(
  index: import("@/lib/knowledge-cache").KnowledgeIndex,
): Promise<void> {
  const metaFolderId = await ensureArchiveMetaFolder(index.folderId);
  await upsertJsonFile(metaFolderId, KNOWLEDGE_INDEX_FILE, index);
}

export type GeneratedBoxDraft = {
  id: string;
  topic: string;
  createdAt: string;
  createdBy?: string;
  source?: string;
  outline?: unknown;
  sections: import("@/lib/mini-box-generate").GeneratedMiniBoxSections;
  gifs?: {
    welcome: import("@/lib/mini-box").GifSelection;
    onePager: import("@/lib/mini-box").GifSelection;
    chat: import("@/lib/mini-box").GifSelection;
  };
};

async function ensureDraftsFolder(): Promise<string> {
  const dataFolderId = await getSharedDataFolderId();
  return ensureFolder(dataFolderId, DRAFTS_FOLDER);
}

export async function saveGeneratedDraftToDrive(
  draft: GeneratedBoxDraft,
): Promise<void> {
  const folderId = await ensureDraftsFolder();
  await upsertJsonFile(folderId, `${draft.id}.json`, draft);
}

export async function loadGeneratedDraftFromDrive(
  draftId: string,
): Promise<GeneratedBoxDraft | null> {
  const dataFolderId = await findSharedDataFolderId();
  if (!dataFolderId) return null;
  const draftsFolderId = await findChildByName(dataFolderId, DRAFTS_FOLDER, FOLDER_MIME);
  if (!draftsFolderId) return null;
  const fileId = await findChildByName(draftsFolderId, `${draftId}.json`);
  if (!fileId) return null;
  return readJsonFile<GeneratedBoxDraft>(fileId);
}

export type SlackWorkflowRecord = {
  id: string;
  boxType: "mini-box" | "ciab";
  status:
    | "topic_selection"
    | "outline"
    | "full_draft"
    | "csm_review"
    | "morgan_review"
    | "published";
  slackChannel: string;
  slackThreadTs?: string;
  topicCandidates?: import("@/lib/mini-box-topic-prompts").TopicCandidate[];
  selectedTopic?: import("@/lib/mini-box-topic-prompts").TopicCandidate;
  outline?: import("@/lib/mini-box-prompts").MiniBoxOutline;
  draftId?: string;
  monthlyCiabTopic?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

async function ensureSlackWorkflowsFolder(): Promise<string> {
  const dataFolderId = await getSharedDataFolderId();
  return ensureFolder(dataFolderId, SLACK_WORKFLOWS_FOLDER);
}

export async function saveSlackWorkflowToDrive(
  workflow: SlackWorkflowRecord,
): Promise<void> {
  const folderId = await ensureSlackWorkflowsFolder();
  await upsertJsonFile(folderId, `${workflow.id}.json`, workflow);
}

export async function loadSlackWorkflowFromDrive(
  workflowId: string,
): Promise<SlackWorkflowRecord | null> {
  const dataFolderId = await findSharedDataFolderId();
  if (!dataFolderId) return null;
  const folderId = await findChildByName(
    dataFolderId,
    SLACK_WORKFLOWS_FOLDER,
    FOLDER_MIME,
  );
  if (!folderId) return null;
  const fileId = await findChildByName(folderId, `${workflowId}.json`);
  if (!fileId) return null;
  return readJsonFile<SlackWorkflowRecord>(fileId);
}

export async function saveAnnualCalendarToDrive(
  calendar: import("@/lib/annual-calendar-types").ParsedAnnualCalendar,
): Promise<AppSettingsPayload> {
  const existing = (await loadAppSettingsFromDrive()) ?? {};
  const key = String(calendar.year);
  const next: AppSettingsPayload = {
    ...existing,
    annualCalendars: {
      ...existing.annualCalendars,
      [key]: calendar,
    },
    updatedAt: new Date().toISOString(),
  };
  const dataFolderId = await getSharedDataFolderId();
  await upsertJsonFile(dataFolderId, APP_SETTINGS_FILE, next);
  return next;
}

export async function registerSlackWorkflowThread(
  channel: string,
  threadTs: string,
  workflowId: string,
): Promise<void> {
  const existing = (await loadAppSettingsFromDrive()) ?? {};
  const threadKey = `${channel}:${threadTs}`;
  const next: AppSettingsPayload = {
    ...existing,
    slackActiveThreads: {
      ...existing.slackActiveThreads,
      [threadKey]: workflowId,
    },
    updatedAt: new Date().toISOString(),
  };
  const dataFolderId = await getSharedDataFolderId();
  await upsertJsonFile(dataFolderId, APP_SETTINGS_FILE, next);
}

export async function findSlackWorkflowIdByThread(
  channel: string,
  threadTs: string,
): Promise<string | null> {
  const settings = await loadAppSettingsFromDrive();
  const threadKey = `${channel}:${threadTs}`;
  return settings?.slackActiveThreads?.[threadKey] ?? null;
}
