import { google } from "googleapis";
import { auth } from "@/lib/auth";

export async function getGoogleAuthClient() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not connected to Google. Sign in to continue.");
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

export async function getSlidesClient() {
  const authClient = await getGoogleAuthClient();
  return google.slides({ version: "v1", auth: authClient });
}

export async function getDriveClient() {
  const authClient = await getGoogleAuthClient();
  return google.drive({ version: "v3", auth: authClient });
}

/** Copy the Mini Box master template into the signed-in user's Drive. */
export async function copyMiniBoxTemplate(title: string) {
  const templateId = process.env.MINI_BOX_TEMPLATE_ID;
  if (!templateId) {
    throw new Error(
      "MINI_BOX_TEMPLATE_ID is not set. Add your master Google Slides template ID to .env.local.",
    );
  }

  const drive = await getDriveClient();
  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: title,
    },
    supportsAllDrives: true,
  });

  if (!copy.data.id) {
    throw new Error("Failed to copy Mini Box template.");
  }

  return copy.data.id;
}

export function slidesPreviewUrl(presentationId: string) {
  return `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;
}

export function slidesEditUrl(presentationId: string) {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}
