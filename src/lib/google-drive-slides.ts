import { Readable } from "stream";
import { getDriveClient } from "@/lib/google-drive";
import { getSharedDataFolderId } from "@/lib/box-studio-drive-data";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const SLIDES_MIME = "application/vnd.google-apps.presentation";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const REVIEW_FOLDER_NAME = "Mini Box Review Drafts";

type DriveClient = Awaited<ReturnType<typeof getDriveClient>>;

export type UploadedSlides = {
  fileId: string;
  webViewLink: string;
};

/** Find (or create) the "Mini Box Review Drafts" folder under Box Studio Data. */
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
  if (!created.data.id) throw new Error("Could not create the review-decks folder.");
  return created.data.id;
}

/** Resolve the Workspace domain to grant commenter access to. Prefers
 *  BOX_STUDIO_SHARE_DOMAIN; otherwise derives it from the Drive account email. */
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
 * Upload a .pptx buffer to Google Drive, importing it as a native Google Slides
 * file in the "Mini Box Review Drafts" folder, and share it with the Workspace
 * domain as a commenter so CSMs can comment in-browser. Returns the file id and
 * shareable web link.
 */
export async function uploadPptxAsGoogleSlides({
  pptxBuffer,
  name,
}: {
  pptxBuffer: Buffer;
  name: string;
}): Promise<UploadedSlides> {
  const drive = await getDriveClient();
  const parentFolderId = await ensureReviewFolder(drive);

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: SLIDES_MIME,
      parents: [parentFolderId],
    },
    media: {
      mimeType: PPTX_MIME,
      body: Readable.from(pptxBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) {
    throw new Error("Google Drive did not return a file id for the Slides upload.");
  }

  // Best-effort: share to the Workspace domain as commenter so CSMs can comment.
  // A locked-down Workspace may reject this; the link still works for the owner
  // and anyone the parent folder is shared with.
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
    created.data.webViewLink ||
    `https://docs.google.com/presentation/d/${fileId}/edit`;

  return { fileId, webViewLink };
}
