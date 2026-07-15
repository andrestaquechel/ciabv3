import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function botToken() {
  return process.env.SLACK_BOT_TOKEN?.trim() || "";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const token = botToken();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Add SLACK_BOT_TOKEN to Vercel (OAuth & Permissions → Bot User OAuth Token), then redeploy.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  const members: Array<{
    id: string;
    name: string;
    realName: string;
    displayName: string;
    email?: string;
    title?: string;
  }> = [];

  let cursor: string | undefined;
  do {
    const url = new URL("https://slack.com/api/users.list");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      members?: Array<{
        id: string;
        deleted?: boolean;
        is_bot?: boolean;
        name?: string;
        real_name?: string;
        profile?: {
          real_name?: string;
          display_name?: string;
          email?: string;
          title?: string;
        };
      }>;
      response_metadata?: { next_cursor?: string };
    };

    if (!data.ok) {
      return NextResponse.json(
        { error: data.error || "Slack users.list failed." },
        { status: 502 },
      );
    }

    for (const m of data.members || []) {
      if (m.deleted || m.is_bot) continue;
      const realName = m.profile?.real_name || m.real_name || "";
      const displayName = m.profile?.display_name || m.name || "";
      const haystack = `${realName} ${displayName} ${m.name} ${m.profile?.email || ""} ${m.profile?.title || ""}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;

      members.push({
        id: m.id,
        name: m.name || "",
        realName,
        displayName,
        email: m.profile?.email,
        title: m.profile?.title,
      });
    }

    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  members.sort((a, b) =>
    (a.realName || a.displayName).localeCompare(b.realName || b.displayName),
  );

  return NextResponse.json({ members, count: members.length });
}
