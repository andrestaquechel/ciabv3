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
