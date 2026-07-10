/** Builder sections that call Claude */
export type AiSectionId =
  | "title"
  | "welcome"
  | "onePagerP1"
  | "onePagerP2"
  | "chat";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";

export const CLAUDE_MODEL_OPTIONS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-3-5-haiku-20241022", label: "Claude Haiku 3.5 (fast)" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 3.5" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODEL_OPTIONS)[number]["id"];

export function isValidClaudeModel(model: string): boolean {
  return CLAUDE_MODEL_OPTIONS.some((option) => option.id === model);
}

export function resolveClaudeModel(
  preferred?: string,
  envDefault?: string,
): string {
  if (preferred && isValidClaudeModel(preferred)) return preferred;
  const fromEnv = envDefault?.trim();
  if (fromEnv && isValidClaudeModel(fromEnv)) return fromEnv;
  return DEFAULT_CLAUDE_MODEL;
}

export function claudeModelLabel(modelId: string): string {
  return (
    CLAUDE_MODEL_OPTIONS.find((option) => option.id === modelId)?.label ??
    modelId
  );
}
