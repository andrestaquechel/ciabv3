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
] as const;

export const MONTH_LABELS = MONTH_NAMES.map(
  (m) => m.charAt(0).toUpperCase() + m.slice(1),
);

export type MonthDropdownOption = {
  monthNumber: number;
  label: string;
};

export function parseMonthInput(input: string, year = new Date().getFullYear()): {
  monthNumber: number;
  monthLabel: string;
  year: number;
} | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;

  const asNum = Number(t);
  if (asNum >= 1 && asNum <= 12) {
    return {
      monthNumber: asNum,
      monthLabel: MONTH_LABELS[asNum - 1],
      year,
    };
  }

  const idx = MONTH_NAMES.findIndex((m) => m.startsWith(t) || t.startsWith(m.slice(0, 3)));
  if (idx >= 0) {
    return {
      monthNumber: idx + 1,
      monthLabel: MONTH_LABELS[idx],
      year,
    };
  }

  return null;
}

export function monthEntry(
  calendars: AnnualCalendarsConfig | undefined,
  monthNumber: number,
  year = new Date().getFullYear(),
): MonthTopicEntry | undefined {
  const entry = calendars?.[String(year)];
  return entry?.months?.find((m) => m.monthNumber === monthNumber);
}

export function monthCiabTopic(
  calendars: AnnualCalendarsConfig | undefined,
  monthNumber: number,
  year = new Date().getFullYear(),
): string | undefined {
  return monthEntry(calendars, monthNumber, year)?.ciabTopic?.trim() || undefined;
}

export function monthMiniBoxTopics(
  calendars: AnnualCalendarsConfig | undefined,
  monthNumber: number,
  year = new Date().getFullYear(),
): string[] {
  return monthEntry(calendars, monthNumber, year)?.miniBoxTopics?.filter(Boolean) || [];
}

/** Label for Slack month dropdown, e.g. "July - Emerging Threats" */
export function monthCalendarLabel(
  calendars: AnnualCalendarsConfig | undefined,
  monthNumber: number,
  boxType: "mini-box" | "ciab",
  year = new Date().getFullYear(),
): string {
  const monthName = MONTH_LABELS[monthNumber - 1] || "Month";
  const entry = monthEntry(calendars, monthNumber, year);
  const topic =
    boxType === "ciab"
      ? entry?.ciabTopic?.trim()
      : entry?.miniBoxTopics?.[0]?.trim() || entry?.ciabTopic?.trim();
  if (!topic) return monthName;
  const label = `${monthName} - ${topic}`;
  return label.length > 75 ? `${label.slice(0, 72)}…` : label;
}

export function buildMonthDropdownOptions(
  calendars: AnnualCalendarsConfig | undefined,
  boxType: "mini-box" | "ciab",
  year = new Date().getFullYear(),
): MonthDropdownOption[] {
  return MONTH_LABELS.map((_, i) => {
    const monthNumber = i + 1;
    return {
      monthNumber,
      label: monthCalendarLabel(calendars, monthNumber, boxType, year),
    };
  });
}

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
