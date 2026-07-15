import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadAnnualCalendarsFromDrive,
  saveAnnualCalendarsToDrive,
  type AnnualCalendarYear,
  type AnnualCalendarsPayload,
} from "@/lib/box-studio-drive-data";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to view annual calendars." },
      { status: 401 },
    );
  }

  try {
    const stored = (await loadAnnualCalendarsFromDrive()) ?? { calendars: {} };
    return NextResponse.json(stored);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load calendars.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to save annual calendars." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      year: number;
      imageDataUrl?: string | null;
      notes?: string;
      sourceFileName?: string;
      clearImage?: boolean;
    };
    if (!body.year || body.year < 2000 || body.year > 2100) {
      return NextResponse.json({ error: "Invalid year." }, { status: 400 });
    }

    const existing = (await loadAnnualCalendarsFromDrive()) ?? { calendars: {} };
    const key = String(body.year);
    const prev = existing.calendars[key];
    const entry: AnnualCalendarYear = {
      year: body.year,
      notes: body.notes ?? prev?.notes ?? "",
      sourceFileName: body.sourceFileName ?? prev?.sourceFileName,
      updatedAt: new Date().toISOString(),
      updatedBy: session.user?.email ?? undefined,
    };

    if (body.clearImage) {
      entry.imageDataUrl = undefined;
    } else if (body.imageDataUrl) {
      entry.imageDataUrl = body.imageDataUrl;
    } else if (prev?.imageDataUrl) {
      entry.imageDataUrl = prev.imageDataUrl;
    }

    const next: AnnualCalendarsPayload = {
      ...existing,
      calendars: { ...existing.calendars, [key]: entry },
    };

    const saved = await saveAnnualCalendarsToDrive(
      next,
      session.user?.email ?? undefined,
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save calendar.";
    const needsReauth = /insufficient authentication scopes/i.test(message);
    return NextResponse.json(
      {
        error: needsReauth
          ? "Google needs updated permissions. Sign out and sign in again from Settings, then retry."
          : message,
      },
      { status: needsReauth ? 403 : 500 },
    );
  }
}
