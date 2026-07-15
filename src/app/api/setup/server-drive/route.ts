import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAppSettingsFromDrive, getSharedDataFolderId } from "@/lib/box-studio-drive-data";

export async function GET() {
  const session = await auth();

  const envConfigured = {
    refreshToken: Boolean(process.env.BOX_STUDIO_GOOGLE_REFRESH_TOKEN?.trim()),
    dataFolderId: Boolean(process.env.BOX_STUDIO_DATA_FOLDER_ID?.trim()),
    slackBot: Boolean(process.env.SLACK_BOT_TOKEN?.trim()),
    slackSigning: Boolean(process.env.SLACK_SIGNING_SECRET?.trim()),
  };

  let sessionDrive: {
    hasRefreshToken: boolean;
    refreshToken?: string;
    miniBoxArchiveFolderId?: string;
    ciabArchiveFolderId?: string;
    dataFolderId?: string;
  } | null = null;

  if (session?.accessToken) {
    let dataFolderId: string | undefined;
    try {
      dataFolderId = await getSharedDataFolderId();
    } catch {
      // user session may not have drive access yet
    }

    let settings = null;
    try {
      settings = await loadAppSettingsFromDrive();
    } catch {
      // ignore
    }

    sessionDrive = {
      hasRefreshToken: Boolean(session.refreshToken),
      refreshToken: session.refreshToken || undefined,
      miniBoxArchiveFolderId: settings?.knowledgeFolders?.["mini-box"]?.folderId,
      ciabArchiveFolderId: settings?.knowledgeFolders?.ciab?.folderId,
      dataFolderId: process.env.BOX_STUDIO_DATA_FOLDER_ID?.trim() || dataFolderId,
    };
  }

  return NextResponse.json({
    envConfigured,
    sessionDrive,
    slackEndpoints: {
      events: "https://ciabv2-gilt.vercel.app/api/webhooks/slack/events",
      interactions: "https://ciabv2-gilt.vercel.app/api/webhooks/slack/interactions",
      miniBox: "https://ciabv2-gilt.vercel.app/api/webhooks/slack",
      newbox: "https://ciabv2-gilt.vercel.app/api/webhooks/slack/newbox",
    },
  });
}
