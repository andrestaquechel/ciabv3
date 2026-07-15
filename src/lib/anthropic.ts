import { resolveClaudeModel } from "@/lib/claude-models";
import { loadAppSettingsFromDrive } from "@/lib/box-studio-drive-data";

export async function resolveAnthropicModel(
  preferred?: string,
): Promise<string> {
  try {
    const settings = await loadAppSettingsFromDrive();
    return resolveClaudeModel(
      preferred,
      settings?.claudeModel ?? process.env.ANTHROPIC_MODEL,
    );
  } catch {
    return resolveClaudeModel(preferred, process.env.ANTHROPIC_MODEL);
  }
}

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

  const resolvedModel = model
    ? resolveClaudeModel(model, process.env.ANTHROPIC_MODEL)
    : await resolveAnthropicModel();

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

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type AnthropicVisionParams = {
  system: string;
  userText: string;
  imageBase64: string;
  mediaType: ImageMediaType;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

function parseDataUrl(dataUrl: string): { mediaType: ImageMediaType; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const rawType = match[1].toLowerCase();
  const allowed: ImageMediaType[] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const mediaType = allowed.includes(rawType as ImageMediaType)
    ? (rawType as ImageMediaType)
    : "image/png";
  return { mediaType, base64: match[2] };
}

export async function anthropicVisionJson<T>({
  system,
  userText,
  imageBase64,
  mediaType,
  temperature = 0.2,
  maxTokens = 4096,
  model,
}: AnthropicVisionParams): Promise<T> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error(anthropicMissingKeyMessage());

  const resolvedModel = model
    ? resolveClaudeModel(model, process.env.ANTHROPIC_MODEL)
    : await resolveAnthropicModel();

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
      system: `${system}\n\nRespond with valid JSON only. No markdown fences or commentary.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic vision error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic vision returned an empty response.");
  return parseJsonFromModelText<T>(text);
}

export async function anthropicVisionJsonFromDataUrl<T>(
  params: Omit<AnthropicVisionParams, "imageBase64" | "mediaType"> & {
    dataUrl: string;
  },
): Promise<T> {
  const parsed = parseDataUrl(params.dataUrl);
  if (!parsed) throw new Error("Invalid image data URL.");
  return anthropicVisionJson<T>({
    ...params,
    imageBase64: parsed.base64,
    mediaType: parsed.mediaType,
  });
}
