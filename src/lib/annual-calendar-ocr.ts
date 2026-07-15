import {
  anthropicConfigured,
  anthropicMissingKeyMessage,
  anthropicVisionJson,
  anthropicVisionJsonFromDataUrl,
} from "@/lib/anthropic";
import type { ParsedAnnualCalendar } from "@/lib/annual-calendar-types";

const OCR_SYSTEM = `You extract structured data from Living Security annual topic calendar images.
The calendar lists CIAB (monthly campaign) topics and may list Mini Box topics per month.
Return JSON only. Use full month names and monthNumber 1-12.`;

const OCR_USER = `Extract every month from this annual topic calendar image.

Return JSON:
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

  type OcrResult = { year: number; months: ParsedAnnualCalendar["months"] };

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
