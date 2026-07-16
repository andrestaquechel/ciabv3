import { Readable } from "stream";
import { getDriveClient } from "@/lib/google-drive";
import { getSharedDataFolderId } from "@/lib/box-studio-drive-data";

const DOC_MIME = "application/vnd.google-apps.document";
const HTML_MIME = "text/html";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const REVIEW_FOLDER_NAME = "CIAB Review Drafts";

type DriveClient = Awaited<ReturnType<typeof getDriveClient>>;

export type UploadedDoc = {
  fileId: string;
  webViewLink: string;
};

function stringToStream(text: string): Readable {
  const stream = new Readable();
  stream.push(Buffer.from(text, "utf-8"));
  stream.push(null);
  return stream;
}

function driveErrorDetail(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      errors?: Array<{ message?: string; reason?: string }>;
      response?: { data?: { error?: { message?: string } } };
    };
    const parts = [
      e.message,
      e.response?.data?.error?.message,
      e.errors?.[0]?.message,
    ].filter((p): p is string => Boolean(p));
    if (parts.length) return [...new Set(parts)].join(" — ");
  }
  return String(err);
}

async function ensureReviewFolder(drive: DriveClient): Promise<string> {
  const parentId = await getSharedDataFolderId();
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name='${REVIEW_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: { name: REVIEW_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Could not create the CIAB review-docs folder.");
  return created.data.id;
}

async function resolveShareDomain(drive: DriveClient): Promise<string | null> {
  const fromEnv = process.env.BOX_STUDIO_SHARE_DOMAIN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    const email = about.data.user?.emailAddress ?? "";
    const at = email.lastIndexOf("@");
    return at > -1 ? email.slice(at + 1) : null;
  } catch {
    return null;
  }
}

/**
 * Upload an HTML string to Google Drive, importing it as a native Google Doc in
 * the "CIAB Review Drafts" folder, and share it with the Workspace domain as a
 * commenter so stakeholders and CSMs can comment in-browser. Returns the file id
 * and shareable link.
 */
export async function uploadHtmlAsGoogleDoc({
  html,
  name,
}: {
  html: string;
  name: string;
}): Promise<UploadedDoc> {
  const drive = await getDriveClient();
  const parentFolderId = await ensureReviewFolder(drive);

  let created;
  try {
    created = await drive.files.create({
      requestBody: { name, mimeType: DOC_MIME, parents: [parentFolderId] },
      media: { mimeType: HTML_MIME, body: stringToStream(html) },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
  } catch (err) {
    throw new Error(`Drive doc create/convert failed: ${driveErrorDetail(err)}`);
  }

  const fileId = created.data.id;
  if (!fileId) throw new Error("Google Drive did not return a file id for the Doc upload.");

  const domain = await resolveShareDomain(drive);
  if (domain) {
    try {
      await drive.permissions.create({
        fileId,
        sendNotificationEmail: false,
        requestBody: { role: "commenter", type: "domain", domain },
        supportsAllDrives: true,
      });
    } catch {
      // sharing is best-effort
    }
  }

  const webViewLink =
    created.data.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`;

  return { fileId, webViewLink };
}
