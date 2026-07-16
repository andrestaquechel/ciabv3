import { NextResponse } from "next/server";
import { loadAnnualCalendarsConfig } from "@/lib/db/annual-calendars";
import { formatCalendarSummary } from "@/lib/annual-calendar-types";

export async function GET() {
  try {
    const annualCalendars = await loadAnnualCalendarsConfig();
    const years = Object.keys(annualCalendars)
      .map(Number)
      .sort((a, b) => b - a);

    return NextResponse.json({
      annualCalendars,
      years,
      summaries: Object.fromEntries(
        Object.entries(annualCalendars).map(([year, cal]) => [
          year,
          formatCalendarSummary(cal),
        ]),
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load annual calendars.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
