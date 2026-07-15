export type MonthTopicEntry = {
  month: string;
  monthNumber: number;
  ciabTopic?: string;
  miniBoxTopics?: string[];
  notes?: string;
};

export type ParsedAnnualCalendar = {
  year: number;
  months: MonthTopicEntry[];
  parsedAt: string;
  source: "knowledge-base" | "slack";
  sourceFileName?: string;
};

export type AnnualCalendarsConfig = Record<string, ParsedAnnualCalendar>;

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function currentMonthCiabTopic(
  calendars: AnnualCalendarsConfig | undefined,
  date = new Date(),
): string | undefined {
  if (!calendars) return undefined;
  const yearKey = String(date.getFullYear());
  const entry = calendars[yearKey];
  if (!entry?.months?.length) return undefined;

  const monthNum = date.getMonth() + 1;
  const byNumber = entry.months.find((m) => m.monthNumber === monthNum);
  if (byNumber?.ciabTopic?.trim()) return byNumber.ciabTopic.trim();

  const monthName = MONTH_NAMES[date.getMonth()];
  const byName = entry.months.find(
    (m) => m.month.toLowerCase().startsWith(monthName),
  );
  return byName?.ciabTopic?.trim() || undefined;
}

export function formatCalendarSummary(calendar: ParsedAnnualCalendar): string {
  const lines = calendar.months
    .slice()
    .sort((a, b) => a.monthNumber - b.monthNumber)
    .map((m) => {
      const parts = [`*${m.month}*`];
      if (m.ciabTopic) parts.push(`CIAB: ${m.ciabTopic}`);
      if (m.miniBoxTopics?.length) {
        parts.push(`Mini Box: ${m.miniBoxTopics.join(", ")}`);
      }
      return parts.join(" — ");
    });
  return lines.join("\n");
}
