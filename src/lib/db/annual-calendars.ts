import type {
  AnnualCalendarsConfig,
  ParsedAnnualCalendar,
} from "@/lib/annual-calendar-types";
import { getDb } from "@/lib/db/sqlite";

type CalendarRow = {
  year: number;
  data: string;
};

function rowToCalendar(row: CalendarRow): ParsedAnnualCalendar {
  return JSON.parse(row.data) as ParsedAnnualCalendar;
}

export async function saveAnnualCalendar(
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

export async function loadAnnualCalendarsConfig(): Promise<AnnualCalendarsConfig> {
  const db = await getDb();
  const result = await db.execute(
    "SELECT year, data FROM annual_calendars ORDER BY year DESC",
  );

  const config: AnnualCalendarsConfig = {};
  for (const row of result.rows) {
    const year = Number(row.year);
    config[String(year)] = rowToCalendar({
      year,
      data: String(row.data),
    });
  }
  return config;
}

export async function loadAnnualCalendar(
  year: number,
): Promise<ParsedAnnualCalendar | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT year, data FROM annual_calendars WHERE year = ?",
    args: [year],
  });

  const row = result.rows[0];
  if (!row) return null;

  return rowToCalendar({
    year: Number(row.year),
    data: String(row.data),
  });
}
