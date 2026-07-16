import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getServerAuthClient } from "@/lib/google-drive-server";
import type { CiabGeneratedContent } from "@/lib/ciab";

/**
 * Stage 2 — branded Main Box deck export.
 *
 * Approach (see docs/decisions/003-ciab-branded-deck.md): rather than commit a
 * 30-45 MB master PPTX and do brittle XML surgery (the Mini Box approach, which
 * only works for a fixed 7-slide layout), we keep a branded MASTER DECK in Drive
 * derived from a real example, seed its text boxes with {{TOKENS}}, then for each
 * new box:
 *   1. Copy the master deck (server-side, no download).
 *   2. Run a single Slides API batchUpdate of replaceAllText, token → content.
 *   3. (Later) replace GIF placeholders via replaceAllShapesWithImage by alt text.
 *
 * This preserves the master's exact fonts, colors, and layout while filling in
 * new copy, and is robust to the deck's structure. The token-map builder below
 * is pure and unit-verifiable; renderCiabDeckFromMaster performs the API calls
 * and is not yet wired into the live flow (it needs Slides write scope + a
 * token-seeded master — tracked in the decision doc).
 */

/** The Drive file id of the working master deck (copied from CiaB_06.26). */
export const CIAB_MASTER_TEMPLATE_FILE_ID =
  process.env.BOX_STUDIO_CIAB_MASTER_TEMPLATE_ID?.trim() ||
  "1DKaholGI_SzS0YBb9U7Om3z8AaM7GowgtpSX1ncuCS8";

/** Max blog body sections the master template provides slots for. */
export const CIAB_MAX_BLOG_SECTIONS = 4;

function tok(name: string): string {
  return `{{${name}}}`;
}

/**
 * The full set of text tokens the master deck must contain. Kept here so the
 * master and the code never drift: every token below is filled by
 * buildCiabDeckTokens; any token the master lacks is simply a no-op replace.
 */
export const EXPECTED_CIAB_TOKENS: string[] = [
  "COVER_TITLE",
  "COVER_SUBTITLE",
  "WELCOME_BODY",
  "BLOG_TITLE",
  "BLOG_INTRO",
  ...Array.from({ length: CIAB_MAX_BLOG_SECTIONS }, (_, i) => [
    `BLOG_S${i + 1}_HEADING`,
    `BLOG_S${i + 1}_BODY`,
    `BLOG_S${i + 1}_MOVE`,
  ]).flat(),
  "BLOG_CONCLUSION_HEADING",
  "BLOG_CONCLUSION_BODY",
  "BLOG_CONCLUSION_MOVE",
  ...[1, 2, 3, 4]
    .map((w) => [
      `W${w}_EMAIL_SUBJECT`,
      `W${w}_EMAIL_GREETING`,
      `W${w}_EMAIL_BODY`,
      `W${w}_CHAT`,
    ])
    .flat(),
  "RESOURCES",
].map(tok);

/**
 * Map generated Main Box content onto the deck's text tokens. Pure — every value
 * is final copy for its slot; unused slots resolve to an empty string so leftover
 * template tokens never ship in the deck.
 */
export function buildCiabDeckTokens(content: CiabGeneratedContent): Record<string, string> {
  const map: Record<string, string> = {};
  const put = (name: string, value: string) => {
    map[tok(name)] = value ?? "";
  };

  put("COVER_TITLE", content.topic);
  put("COVER_SUBTITLE", content.tagline || "");
  put("WELCOME_BODY", content.welcome.body);
  put("BLOG_TITLE", content.blog.title || content.topic);
  put("BLOG_INTRO", content.blog.intro);

  for (let i = 0; i < CIAB_MAX_BLOG_SECTIONS; i += 1) {
    const s = content.blog.sections[i];
    put(`BLOG_S${i + 1}_HEADING`, s?.heading || "");
    put(`BLOG_S${i + 1}_BODY`, s?.body || "");
    put(`BLOG_S${i + 1}_MOVE`, s?.yourMove ? `🎯 Your Move: ${s.yourMove.replace(/^🎯\s*Your Move:\s*/i, "")}` : "");
  }

  put("BLOG_CONCLUSION_HEADING", content.blog.conclusion.heading);
  put("BLOG_CONCLUSION_BODY", content.blog.conclusion.body);
  put(
    "BLOG_CONCLUSION_MOVE",
    content.blog.conclusion.yourFinalMove
      ? `🎯 Your Final Move: ${content.blog.conclusion.yourFinalMove.replace(/^🎯\s*Your Final Move:\s*/i, "")}`
      : "",
  );

  for (const w of [1, 2, 3, 4] as const) {
    const email = content.emails.find((e) => e.week === w) || content.emails[w - 1];
    const chat = content.chats.find((c) => c.week === w) || content.chats[w - 1];
    put(`W${w}_EMAIL_SUBJECT`, email?.subject || "");
    put(`W${w}_EMAIL_GREETING`, email?.greeting || "");
    put(`W${w}_EMAIL_BODY`, email?.body || "");
    put(`W${w}_CHAT`, chat?.message || "");
  }

  put("RESOURCES", content.resources.items.map((i) => `• ${i}`).join("\n"));

  return map;
}

async function getSlidesAndDrive() {
  // Prefer a live user session; fall back to the server refresh token (Slack/cron).
  let authClient;
  try {
    const session = await auth();
    if (session?.accessToken) {
      const oauth2 = new google.auth.OAuth2(
        process.env.AUTH_GOOGLE_ID,
        process.env.AUTH_GOOGLE_SECRET,
      );
      oauth2.setCredentials({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      authClient = oauth2;
    }
  } catch {
    // no session — use server credentials below
  }
  if (!authClient) authClient = await getServerAuthClient();
  if (!authClient) throw new Error("Connect Google (or set BOX_STUDIO_GOOGLE_REFRESH_TOKEN) to build the deck.");

  return {
    slides: google.slides({ version: "v1", auth: authClient }),
    drive: google.drive({ version: "v3", auth: authClient }),
  };
}

/**
 * Copy the branded master deck and fill its tokens with the generated content.
 * Returns the new deck's shareable link. NOTE: requires the Slides write scope
 * (https://www.googleapis.com/auth/presentations) and a token-seeded master;
 * not yet wired into the Slack flow (see decision doc).
 */
export async function renderCiabDeckFromMaster({
  content,
  name,
  masterFileId = CIAB_MASTER_TEMPLATE_FILE_ID,
}: {
  content: CiabGeneratedContent;
  name: string;
  masterFileId?: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const { slides, drive } = await getSlidesAndDrive();

  const copied = await drive.files.copy({
    fileId: masterFileId,
    requestBody: { name },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const fileId = copied.data.id;
  if (!fileId) throw new Error("Could not copy the CIAB master deck.");

  const tokens = buildCiabDeckTokens(content);
  const requests = Object.entries(tokens).map(([token, value]) => ({
    replaceAllText: {
      containsText: { text: token, matchCase: true },
      replaceText: value,
    },
  }));

  await slides.presentations.batchUpdate({
    presentationId: fileId,
    requestBody: { requests },
  });

  const webViewLink =
    copied.data.webViewLink || `https://docs.google.com/presentation/d/${fileId}/edit`;
  return { fileId, webViewLink };
}
