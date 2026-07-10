import { google } from "googleapis";
import { auth } from "@/lib/auth";

export async function getGoogleAuthClient() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Connect Google to access Drive.");
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );

  oauth2.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  return oauth2;
}

export async function getDriveClient() {
  const authClient = await getGoogleAuthClient();
  return google.drive({ version: "v3", auth: authClient });
}

export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export async function listFolderFiles(folderId: string) {
  const drive = await getDriveClient();
  const files: Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    webViewLink?: string;
  }> = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
      pageSize: 100,
      pageToken,
      orderBy: "modifiedTime desc",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const batch = (res.data.files ?? [])
      .filter(
        (f): f is typeof f & { id: string; name: string; mimeType: string; modifiedTime: string } =>
          !!f.id && !!f.name && !!f.mimeType && !!f.modifiedTime,
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink ?? undefined,
      }));
    files.push(...batch);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  isFolder: boolean;
};

export async function listFolderEntries(folderId: string): Promise<DriveEntry[]> {
  const drive = await getDriveClient();
  const entries: DriveEntry[] = [];
  let pageToken: string | undefined;
  const folderMime = "application/vnd.google-apps.folder";

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
      pageSize: 100,
      pageToken,
      orderBy: "folder,name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name || !f.mimeType || !f.modifiedTime) continue;
      entries.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink ?? undefined,
        isFolder: f.mimeType === folderMime,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return entries;
}

const INDEXABLE_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
  "text/plain",
]);

export async function indexArchiveRecursive(
  folderId: string,
  pathPrefix = "",
  maxFiles = 250,
): Promise<
  Array<{
    id: string;
    name: string;
    path: string;
    mimeType: string;
    modifiedTime: string;
    text: string;
    webViewLink?: string;
  }>
> {
  const results: Array<{
    id: string;
    name: string;
    path: string;
    mimeType: string;
    modifiedTime: string;
    text: string;
    webViewLink?: string;
  }> = [];

  async function walk(folderId: string, path: string) {
    if (results.length >= maxFiles) return;
    const entries = await listFolderEntries(folderId);
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isFolder) {
        await walk(entry.id, entryPath);
      } else if (INDEXABLE_MIMES.has(entry.mimeType)) {
        const text = await exportFileText(entry.id, entry.mimeType);
        results.push({
          id: entry.id,
          name: entry.name,
          path: entryPath,
          mimeType: entry.mimeType,
          modifiedTime: entry.modifiedTime,
          text,
          webViewLink: entry.webViewLink,
        });
      } else {
        results.push({
          id: entry.id,
          name: entry.name,
          path: entryPath,
          mimeType: entry.mimeType,
          modifiedTime: entry.modifiedTime,
          text: `[File: ${entry.name}]`,
          webViewLink: entry.webViewLink,
        });
      }
    }
  }

  await walk(folderId, pathPrefix);
  return results;
}

export type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

export type DriveBrowseScope =
  | { kind: "my-drive"; parentId: string }
  | { kind: "shared-with-me"; parentId?: string }
  | { kind: "shared-drive"; driveId: string; parentId: string };

export type DrivePreviewItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  isFolder: boolean;
};

export async function listSharedDrives(): Promise<Array<{ id: string; name: string }>> {
  const drive = await getDriveClient();
  const drives: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.drives.list({
      pageSize: 100,
      pageToken,
    });
    for (const item of res.data.drives ?? []) {
      if (item.id && item.name) {
        drives.push({ id: item.id, name: item.name });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return drives;
}

function folderMimeType() {
  return "application/vnd.google-apps.folder";
}

export async function listDriveFolders(
  scope: DriveBrowseScope,
): Promise<DriveFolder[]> {
  const drive = await getDriveClient();
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;

  let q: string;
  let driveId: string | undefined;
  let corpora: string | undefined;

  switch (scope.kind) {
    case "my-drive":
      q = `mimeType='${folderMimeType()}' and trashed=false and '${scope.parentId}' in parents`;
      break;
    case "shared-with-me":
      q = scope.parentId
        ? `mimeType='${folderMimeType()}' and trashed=false and '${scope.parentId}' in parents`
        : `sharedWithMe=true and mimeType='${folderMimeType()}' and trashed=false`;
      break;
    case "shared-drive":
      driveId = scope.driveId;
      corpora = "drive";
      q = `mimeType='${folderMimeType()}' and trashed=false and '${scope.parentId === "root" ? scope.driveId : scope.parentId}' in parents`;
      break;
  }

  do {
    const res = await drive.files.list({
      q,
      corpora,
      driveId,
      fields:
        "nextPageToken, files(id, name, webViewLink, modifiedTime)",
      pageSize: 100,
      pageToken,
      orderBy: "name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const batch = (res.data.files ?? [])
      .filter(
        (f): f is typeof f & { id: string; name: string } =>
          !!f.id && !!f.name,
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink ?? undefined,
        modifiedTime: f.modifiedTime ?? undefined,
      }));
    folders.push(...batch);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return folders;
}

export async function previewFolderContents(folderId: string, limit = 30) {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields:
      "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
    pageSize: limit,
    orderBy: "folder,name,modifiedTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const items: DrivePreviewItem[] = (res.data.files ?? [])
    .filter(
      (f): f is typeof f & { id: string; name: string; mimeType: string } =>
        !!f.id && !!f.name && !!f.mimeType,
    )
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
      isFolder: f.mimeType === folderMimeType(),
    }));

  return {
    items,
    shown: items.length,
    hasMore: !!res.data.nextPageToken,
    folderCount: items.filter((i) => i.isFolder).length,
    fileCount: items.filter((i) => !i.isFolder).length,
  };
}

export async function getFolderInfo(folderId: string): Promise<DriveFolder> {
  const drive = await getDriveClient();
  const res = await drive.files.get({
    fileId: folderId,
    fields: "id, name, webViewLink, modifiedTime",
    supportsAllDrives: true,
  });
  if (!res.data.id || !res.data.name) {
    throw new Error("Folder not found.");
  }
  return {
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink ?? undefined,
    modifiedTime: res.data.modifiedTime ?? undefined,
  };
}

export async function exportFileText(fileId: string, mimeType: string) {
  const drive = await getDriveClient();

  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" },
    );
    return String(res.data ?? "").slice(0, 12000);
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const meta = await drive.files.get({
      fileId,
      fields: "name,modifiedTime,description",
    });
    return `PowerPoint: ${meta.data.name}\nModified: ${meta.data.modifiedTime}\n${meta.data.description ?? ""}`;
  }

  if (mimeType === "application/vnd.google-apps.presentation") {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" },
    );
    return String(res.data ?? "").slice(0, 12000);
  }

  return "";
}
