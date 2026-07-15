import { Readable } from "stream";
import { getDriveClient } from "@/lib/google-drive";

const DATA_FOLDER_NAME = "Box Studio Data";
const META_FOLDER_NAME = ".box-studio";
const APP_SETTINGS_FILE = "app-settings.json";
const KNOWLEDGE_INDEX_FILE = "knowledge-index.json";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type AppSettingsPayload = {
  claudeModel?: string;
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
