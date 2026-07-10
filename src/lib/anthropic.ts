import {
  DEFAULT_CLAUDE_MODEL,
  resolveClaudeModel,
} from "@/lib/claude-models";

export {
  DEFAULT_CLAUDE_MODEL,
  CLAUDE_MODEL_OPTIONS,
  type AiSectionId,
  type ClaudeModelId,
} from "@/lib/claude-models";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function getAnthropicModel(): string {
  return resolveClaudeModel(undefined, process.env.ANTHROPIC_MODEL);
}

export function anthropicConfigured(): boolean {
  return Boolean(getAnthropicApiKey());
}

export function anthropicMissingKeyMessage(): string {
  return "Add ANTHROPIC_API_KEY to .env.local (local) or Vercel Environment Variables (production).";
}

type AnthropicMessageParams = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

export async function anthropicText({
  system,
  user,
  temperature = 0.7,
  maxTokens = 4096,
  model,
}: AnthropicMessageParams): Promise<string> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(anthropicMissingKeyMessage());
  }

  const resolvedModel = resolveClaudeModel(model, process.env.ANTHROPIC_MODEL);

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = data.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }

  return text;
}

export function parseJsonFromModelText<T>(text: string): T {
  const trimmed = text.trim();
  const fenced =
    trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  return JSON.parse(fenced) as T;
}

export async function anthropicJson<T>(
  params: AnthropicMessageParams,
): Promise<T> {
  const text = await anthropicText({
    ...params,
    system: `${params.system}\n\nRespond with valid JSON only. No markdown fences or commentary.`,
  });
  return parseJsonFromModelText<T>(text);
}
