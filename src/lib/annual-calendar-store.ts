export type AnnualCalendarYear = {
  year: number;
  imageDataUrl?: string;
  notes?: string;
  sourceFileName?: string;
  updatedAt: string;
};

export type AnnualCalendarsStore = {
  calendars: Record<string, AnnualCalendarYear>;
  updatedAt?: string;
};

const STORAGE_KEY = "box-studio:annual-calendars";

function readStore(): AnnualCalendarsStore {
  if (typeof window === "undefined") return { calendars: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnnualCalendarsStore) : { calendars: {} };
  } catch {
    return { calendars: {} };
  }
}

function writeStore(store: AnnualCalendarsStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadAnnualCalendars(): AnnualCalendarsStore {
  return readStore();
}

export function saveAnnualCalendarYear(
  year: number,
  patch: {
    imageDataUrl?: string | null;
    notes?: string;
    sourceFileName?: string;
    clearImage?: boolean;
  },
): AnnualCalendarsStore {
  const store = readStore();
  const key = String(year);
  const prev = store.calendars[key];
  const entry: AnnualCalendarYear = {
    year,
    notes: patch.notes ?? prev?.notes ?? "",
    sourceFileName: patch.sourceFileName ?? prev?.sourceFileName,
    updatedAt: new Date().toISOString(),
  };

  if (patch.clearImage) {
    entry.imageDataUrl = undefined;
  } else if (patch.imageDataUrl) {
    entry.imageDataUrl = patch.imageDataUrl;
  } else if (prev?.imageDataUrl) {
    entry.imageDataUrl = prev.imageDataUrl;
  }

  const next: AnnualCalendarsStore = {
    calendars: { ...store.calendars, [key]: entry },
    updatedAt: new Date().toISOString(),
  };
  writeStore(next);
  return next;
}

export function getAnnualCalendarYear(year: number): AnnualCalendarYear | undefined {
  return readStore().calendars[String(year)];
}
