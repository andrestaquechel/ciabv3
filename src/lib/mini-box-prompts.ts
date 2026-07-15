import type { SourceArticle } from "@/lib/mini-box";

export type GenerationPromptsConfig = {
  /** System prompt for outline generation */
  outlineSystem?: string;
  /** User template — vars: {{topic}}, {{notes}}, {{articles}} */
  outlineUser?: string;
  /** System prompt for section / full-box generation */
  generateSystem?: string;
  /** User template for full mini box — vars: {{topic}}, {{notes}}, {{outline}}, {{articles}} */
  generateFullUser?: string;
};

export const DEFAULT_GENERATION_PROMPTS: Required<GenerationPromptsConfig> = {
  outlineSystem: `You plan Living Security Mini Box campaigns for employees. Return practical, security-awareness focused briefs. JSON only.`,
  outlineUser: `Topic: {{topic}}

Ideation notes:
{{notes}}

Source articles:
{{articles}}

Return JSON:
{
  "angle": "one sentence hook",
  "audience": "who this is for",
  "keyMessages": ["3-5 bullet strings"],
  "welcomeFocus": "what the welcome slide should emphasize",
  "onePagerHook": "email subject angle",
  "onePagerStructure": "paragraph plan for the one-pager",
  "chatScenario": "interactive chat scenario idea",
  "habitToReinforce": "one clear behavior employees should adopt"
}`,
  generateSystem: `You write Living Security Mini Box content: conversational, security-awareness focused, emoji-friendly, practical habits. Use the outline and source articles when provided. Keep tone warm and clear. Return JSON only. Leave {{ SIGNATURE }} unchanged in email closings.`,
  generateFullUser: `Topic: {{topic}}

Ideation notes:
{{notes}}

Outline:
{{outline}}

Source articles:
{{articles}}

Generate a complete Mini Box draft. Return JSON:
{
  "welcome": { "intro": string, "contents": string, "closing": string },
  "onePager": {
    "greeting": string,
    "subjectLine": string,
    "bodyPart1": string,
    "callout": string,
    "bodyPart2": string
  },
  "chat": { "message": string }
}`,
};

export function articleContext(articles?: SourceArticle[]) {
  if (!articles?.length) return "(none)";
  return articles
    .map(
      (a, i) =>
        `${i + 1}. ${a.title || "Untitled"}${a.url ? ` (${a.url})` : ""}${a.notes ? ` — ${a.notes}` : ""}`,
    )
    .join("\n");
}

export function applyPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function resolveGenerationPrompts(
  stored?: GenerationPromptsConfig | null,
): Required<GenerationPromptsConfig> {
  return {
    outlineSystem:
      stored?.outlineSystem?.trim() || DEFAULT_GENERATION_PROMPTS.outlineSystem,
    outlineUser:
      stored?.outlineUser?.trim() || DEFAULT_GENERATION_PROMPTS.outlineUser,
    generateSystem:
      stored?.generateSystem?.trim() || DEFAULT_GENERATION_PROMPTS.generateSystem,
    generateFullUser:
      stored?.generateFullUser?.trim() || DEFAULT_GENERATION_PROMPTS.generateFullUser,
  };
}

export type MiniBoxOutline = {
  angle: string;
  audience: string;
  keyMessages: string[];
  welcomeFocus: string;
  onePagerHook: string;
  onePagerStructure: string;
  chatScenario: string;
  habitToReinforce: string;
};

export function outlineToContextText(outline: MiniBoxOutline | string | null | undefined) {
  if (!outline) return "(none)";
  if (typeof outline === "string") return outline.trim() || "(none)";
  return JSON.stringify(outline, null, 2);
}
