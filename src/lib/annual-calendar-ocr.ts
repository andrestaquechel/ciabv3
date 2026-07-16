import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
  anthropicVisionJson,
  anthropicVisionJsonFromDataUrl,
} from "@/lib/anthropic";
import type { ParsedAnnualCalendar } from "@/lib/annual-calendar-types";

const OCR_SYSTEM = `You extract structured data from Living Security annual topic calendar images or text lists.
The calendar lists CIAB (monthly campaign) topics and may list Mini Box topics per month.
Return JSON only. Use full month names and monthNumber 1-12.`;

const OCR_JSON_SCHEMA = `Return JSON:
{
  "year": number,
  "months": [
    {
      "month": "January",
      "monthNumber": 1,
      "ciabTopic": "topic name or empty string",
      "miniBoxTopics": ["optional mini box themes for that month"],
      "notes": "optional extra text from that row/cell"
    }
  ]
}

Rules:
- Include all 12 months if visible; skip months that are blank.
- ciabTopic is the main monthly CIAB/security awareness theme.
- miniBoxTopics: list any explicit Mini Box topics shown for that month (0-3 items).
- If only one topic column exists, treat it as ciabTopic.
- year: use the calendar year shown, or best guess from context.`;

const OCR_USER = `Extract every month from this annual topic calendar image.

${OCR_JSON_SCHEMA}`;

type OcrResult = { year: number; months: ParsedAnnualCalendar["months"] };

function normalizeCalendarResult(
  parsed: OcrResult,
  source: ParsedAnnualCalendar["source"],
  sourceFileName?: string,
): ParsedAnnualCalendar {
  return {
    year: parsed.year,
    months: (parsed.months || []).map((m) => ({
      month: m.month,
      monthNumber: m.monthNumber,
      ciabTopic: m.ciabTopic?.trim() || undefined,
      miniBoxTopics: m.miniBoxTopics?.filter(Boolean),
      notes: m.notes?.trim() || undefined,
    })),
    parsedAt: new Date().toISOString(),
    source,
    sourceFileName,
  };
}

export async function parseAnnualCalendarText(
  text: string,
  source: ParsedAnnualCalendar["source"] = "slack",
): Promise<ParsedAnnualCalendar> {
  if (!anthropicConfigured()) {
    throw new Error(anthropicMissingKeyMessage());
  }

  const parsed = await anthropicJson<OcrResult>({
    system: OCR_SYSTEM,
    user: `Extract the annual topic calendar from this pasted list or table.

${OCR_JSON_SCHEMA}

Pasted calendar:
${text.trim()}`,
    temperature: 0.1,
    maxTokens: 4096,
  });

  return normalizeCalendarResult(parsed, source, "pasted-text");
}

export async function parseAnnualCalendarImage({
  dataUrl,
  imageBase64,
  mediaType,
  source,
  sourceFileName,
}: {
  dataUrl?: string;
  imageBase64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  source: ParsedAnnualCalendar["source"];
  sourceFileName?: string;
}): Promise<ParsedAnnualCalendar> {
  if (!anthropicConfigured()) {
    throw new Error(anthropicMissingKeyMessage());
  }

  let parsed: OcrResult;
  if (dataUrl) {
    parsed = await anthropicVisionJsonFromDataUrl<OcrResult>({
      system: OCR_SYSTEM,
      userText: OCR_USER,
      dataUrl,
      temperature: 0.1,
      maxTokens: 4096,
    });
  } else if (imageBase64 && mediaType) {
    parsed = await anthropicVisionJson<OcrResult>({
      system: OCR_SYSTEM,
      userText: OCR_USER,
      imageBase64,
      mediaType,
      temperature: 0.1,
      maxTokens: 4096,
    });
  } else {
    throw new Error("Image data required for calendar OCR.");
  }

  return normalizeCalendarResult(parsed, source, sourceFileName);
}
