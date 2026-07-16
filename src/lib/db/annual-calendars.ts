import type {
  AnnualCalendarsConfig,
  ParsedAnnualCalendar,
} from "@/lib/annual-calendar-types";
import {
  loadAnnualCalendarsFromDrive,
  saveAnnualCalendarToDrive,
} from "@/lib/box-studio-drive-data";
import { getDb } from "@/lib/db/sqlite";

type CalendarRow = {
  year: number;
  data: string;
  updated_at?: string;
};

function rowToCalendar(row: CalendarRow): ParsedAnnualCalendar {
  return JSON.parse(row.data) as ParsedAnnualCalendar;
}

function calendarUpdatedAt(calendar: ParsedAnnualCalendar): string {
  return calendar.parsedAt || new Date(0).toISOString();
}

function mergeCalendarConfigs(
  ...sources: AnnualCalendarsConfig[]
): AnnualCalendarsConfig {
  const merged: AnnualCalendarsConfig = {};

  for (const source of sources) {
    for (const [yearKey, calendar] of Object.entries(source)) {
      const existing = merged[yearKey];
      if (!existing) {
        merged[yearKey] = calendar;
        continue;
      }
      if (
        calendarUpdatedAt(calendar) >= calendarUpdatedAt(existing)
      ) {
        merged[yearKey] = calendar;
      }
    }
  }

  return merged;
}

async function saveAnnualCalendarSqlite(
  calendar: ParsedAnnualCalendar,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO annual_calendars (year, data, parsed_at, source, source_file_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(year) DO UPDATE SET
            data = excluded.data,
            parsed_at = excluded.parsed_at,
            source = excluded.source,
            source_file_name = excluded.source_file_name,
            updated_at = excluded.updated_at`,
    args: [
      calendar.year,
      JSON.stringify(calendar),
      calendar.parsedAt,
      calendar.source,
      calendar.sourceFileName ?? null,
      now,
    ],
  });
}

async function loadAnnualCalendarsSqlite(): Promise<AnnualCalendarsConfig> {
  const db = await getDb();
  const result = await db.execute(
    "SELECT year, data, updated_at FROM annual_calendars ORDER BY year DESC",
  );

  const config: AnnualCalendarsConfig = {};
  for (const row of result.rows) {
    const year = Number(row.year);
    config[String(year)] = rowToCalendar({
      year,
      data: String(row.data),
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
    });
  }
  return config;
}

/** Persist calendar locally (SQLite) and to shared Drive for Vercel durability. */
export async function saveAnnualCalendar(
  calendar: ParsedAnnualCalendar,
): Promise<void> {
  const errors: string[] = [];

  try {
    await saveAnnualCalendarSqlite(calendar);
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "SQLite calendar save failed",
    );
  }

  try {
    await saveAnnualCalendarToDrive(calendar);
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "Drive calendar save failed",
    );
  }

  if (errors.length === 2) {
    throw new Error(errors.join("; "));
  }
}

export async function loadAnnualCalendarsConfig(): Promise<AnnualCalendarsConfig> {
  const [fromDrive, fromSqlite] = await Promise.all([
    loadAnnualCalendarsFromDrive().catch(() => ({} as AnnualCalendarsConfig)),
    loadAnnualCalendarsSqlite().catch(() => ({} as AnnualCalendarsConfig)),
  ]);

  return mergeCalendarConfigs(fromDrive, fromSqlite);
}

export async function loadAnnualCalendar(
  year: number,
): Promise<ParsedAnnualCalendar | null> {
  const config = await loadAnnualCalendarsConfig();
  return config[String(year)] ?? null;
}
