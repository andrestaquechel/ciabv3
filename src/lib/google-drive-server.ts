import { google } from "googleapis";

/** Server-side OAuth client for Slack/cron when no user session (optional refresh token). */
export async function getServerAuthClient() {
  const refreshToken = process.env.BOX_STUDIO_GOOGLE_REFRESH_TOKEN?.trim();
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!refreshToken || !clientId || !clientSecret) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/** Server-side Drive access for Slack/cron when no user session (optional refresh token). */
export async function getServerDriveClient() {
  const oauth2 = await getServerAuthClient();
  if (!oauth2) return null;
  return google.drive({ version: "v3", auth: oauth2 });
}
