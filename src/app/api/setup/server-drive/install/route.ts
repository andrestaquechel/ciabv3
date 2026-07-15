import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSharedDataFolderId } from "@/lib/box-studio-drive-data";
import { upsertVercelEnvVar } from "@/lib/vercel-env";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in with Google first." }, { status: 401 });
  }

  const refreshToken = session.refreshToken?.trim();
  if (!refreshToken) {
    return NextResponse.json(
      {
        error:
          "No Google refresh token in your session. Sign out, then sign in again with Google (consent screen) and retry.",
        needsReauth: true,
      },
      { status: 400 },
    );
  }

  let dataFolderId: string | undefined;
  try {
    dataFolderId = await getSharedDataFolderId();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not access Google Drive to locate Box Studio Data folder.",
      },
      { status: 502 },
    );
  }

  try {
    await upsertVercelEnvVar({
      key: "BOX_STUDIO_GOOGLE_REFRESH_TOKEN",
      value: refreshToken,
    });
    await upsertVercelEnvVar({
      key: "BOX_STUDIO_DATA_FOLDER_ID",
      value: dataFolderId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Vercel env install failed.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    dataFolderId,
    message:
      "Installed BOX_STUDIO_GOOGLE_REFRESH_TOKEN and BOX_STUDIO_DATA_FOLDER_ID on Vercel. Redeploy for Slack workflows to use them.",
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  return NextResponse.json({
    hasRefreshToken: Boolean(session.refreshToken),
    refreshTokenPreview: session.refreshToken
      ? `${session.refreshToken.slice(0, 8)}…${session.refreshToken.slice(-6)}`
      : undefined,
    email: session.user.email,
  });
}
