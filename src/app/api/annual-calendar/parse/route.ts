import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseAnnualCalendarImage } from "@/lib/annual-calendar-ocr";
import { currentMonthCiabTopic, formatCalendarSummary } from "@/lib/annual-calendar-types";
import { saveAnnualCalendarToDrive } from "@/lib/box-studio-drive-data";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Connect Google to save parsed calendar." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      dataUrl?: string;
      year?: number;
      sourceFileName?: string;
    };

    if (!body.dataUrl?.trim()) {
      return NextResponse.json({ error: "dataUrl is required." }, { status: 400 });
    }

    const calendar = await parseAnnualCalendarImage({
      dataUrl: body.dataUrl.trim(),
      source: "knowledge-base",
      sourceFileName: body.sourceFileName,
    });

    if (body.year && body.year !== calendar.year) {
      calendar.year = body.year;
    }

    await saveAnnualCalendarToDrive(calendar);

    const ciab = currentMonthCiabTopic({ [String(calendar.year)]: calendar });

    return NextResponse.json({
      calendar,
      monthlyCiabTopic: ciab,
      summary: formatCalendarSummary(calendar),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar parse failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
