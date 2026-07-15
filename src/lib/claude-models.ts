/** Builder sections that call Claude */
export type AiSectionId =
  | "title"
  | "welcome"
  | "onePagerP1"
  | "onePagerP2"
  | "chat";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

export const CLAUDE_MODEL_OPTIONS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
] as const;

/** Retired IDs still stored in localStorage or env — map to a current default. */
const LEGACY_MODEL_ALIASES: Record<string, string> = {
  "claude-sonnet-4-20250514": DEFAULT_CLAUDE_MODEL,
  "claude-opus-4-20250514": "claude-opus-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-3-5-sonnet-20241022": DEFAULT_CLAUDE_MODEL,
};

export type ClaudeModelId = (typeof CLAUDE_MODEL_OPTIONS)[number]["id"];

export function isValidClaudeModel(model: string): boolean {
  return CLAUDE_MODEL_OPTIONS.some((option) => option.id === model);
}

export function resolveClaudeModel(
  preferred?: string,
  envDefault?: string,
): string {
  const pick = (model?: string) => {
    const trimmed = model?.trim();
    if (!trimmed) return undefined;
    if (isValidClaudeModel(trimmed)) return trimmed;
    return LEGACY_MODEL_ALIASES[trimmed];
  };

  return (
    pick(preferred) ??
    pick(envDefault) ??
    DEFAULT_CLAUDE_MODEL
  );
}

export function claudeModelLabel(modelId: string): string {
  return (
    CLAUDE_MODEL_OPTIONS.find((option) => option.id === modelId)?.label ??
    modelId
  );
}
