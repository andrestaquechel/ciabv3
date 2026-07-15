import type { MiniBoxDocument, SourceArticle, GeneratedMiniBoxSections } from "@/lib/mini-box";
import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
  resolveAnthropicModel,
} from "@/lib/anthropic";
import {
  applyPromptTemplate,
  articleContext,
  type GenerationPromptsConfig,
  type MiniBoxOutline,
  outlineToContextText,
  resolveGenerationPrompts,
} from "@/lib/mini-box-prompts";
import { loadAppSettingsFromDrive } from "@/lib/box-studio-drive-data";

export type { GeneratedMiniBoxSections } from "@/lib/mini-box";

export async function loadGenerationPrompts(): Promise<Required<GenerationPromptsConfig>> {
  try {
    const settings = await loadAppSettingsFromDrive();
    return resolveGenerationPrompts(settings?.generationPrompts);
  } catch {
    return resolveGenerationPrompts(null);
  }
}

function mockOutline(topic: string): MiniBoxOutline {
  return {
    angle: `Help employees understand ${topic} and take one safer action today.`,
    audience: "All employees",
    keyMessages: [
      `${topic} creates risk when tools bypass IT oversight`,
      "Sensitive data can leave approved channels",
      "When unsure, pause and ask security",
    ],
    welcomeFocus: `Why ${topic} matters now and what is in this box`,
    onePagerHook: `Subject: 👤 ${topic} — what you need to know`,
    onePagerStructure:
      "Open with the trend, explain the risk, define the term, close with clear do/don't guidance",
    chatScenario: `Quick poll: what would you do if ${topic} showed up in your workflow?`,
    habitToReinforce: "Check with IT before using unapproved tools",
  };
}

function mockFullBox(topic: string, outline: MiniBoxOutline | null): GeneratedMiniBoxSections {
  const hook = outline?.onePagerHook || `Subject: 👤 ${topic}`;
  return {
    welcome: {
      intro: `Welcome to your Mini Box on ${topic}. ${outline?.welcomeFocus || "Help your users understand the risk and build one clear habit."}`,
      contents: `In this topical mini box, you'll find:\n1. A one-pager explaining ${topic} and why it matters.\n2. A chat message with a quick scenario to reinforce one habit.`,
      closing: "The Living Security Team",
    },
    onePager: {
      greeting: "Hey, Team!",
      subjectLine: hook,
      bodyPart1: `${outline?.angle || topic} is showing up across organizations faster than policies can keep up. ${outline?.onePagerStructure || ""}`,
      callout: `${topic}: unapproved tools or practices that bypass IT oversight.`,
      bodyPart2: `This is both a security and legal issue. Never use tools that have not been pre-approved by IT. If you're not sure, ask.\n\nAll the best,\n{{ SIGNATURE }}`,
    },
    chat: {
      message: outline?.chatScenario ||
        `💡 Quick scenario on ${topic}\n\nWhat is your move when something feels off?\nA. Ignore it\nB. Handle it yourself\nC. Pause and ask security\n\nReply with your answer! 👇`,
    },
  };
}

export async function generateOutline({
  topic,
  notes = "",
  articles = [],
  prompts: promptOverride,
  model,
}: {
  topic: string;
  notes?: string;
  articles?: SourceArticle[];
  prompts?: GenerationPromptsConfig;
  model?: string;
}) {
  const prompts = promptOverride
    ? resolveGenerationPrompts(promptOverride)
    : await loadGenerationPrompts();

  if (!anthropicConfigured()) {
    return {
      source: "mock" as const,
      outline: mockOutline(topic),
      note: anthropicMissingKeyMessage(),
    };
  }

  const user = applyPromptTemplate(prompts.outlineUser, {
    topic,
    notes: notes.trim() || "(none)",
    articles: articleContext(articles),
  });

  const outline = await anthropicJson<MiniBoxOutline>({
    system: prompts.outlineSystem,
    user,
    temperature: 0.5,
    model: model || (await resolveAnthropicModel()),
  });

  return { source: "anthropic" as const, outline, model };
}

export async function generateFullMiniBox({
  topic,
  notes = "",
  outline,
  articles = [],
  prompts: promptOverride,
  model,
}: {
  topic: string;
  notes?: string;
  outline?: MiniBoxOutline | string | null;
  articles?: SourceArticle[];
  prompts?: GenerationPromptsConfig;
  model?: string;
}) {
  const prompts = promptOverride
    ? resolveGenerationPrompts(promptOverride)
    : await loadGenerationPrompts();

  if (!anthropicConfigured()) {
    const parsed =
      typeof outline === "object" && outline ? outline : mockOutline(topic);
    return {
      source: "mock" as const,
      sections: mockFullBox(topic, parsed),
      note: anthropicMissingKeyMessage(),
    };
  }

  const user = applyPromptTemplate(prompts.generateFullUser, {
    topic,
    notes: notes.trim() || "(none)",
    outline: outlineToContextText(outline),
    articles: articleContext(articles),
  });

  const sections = await anthropicJson<GeneratedMiniBoxSections>({
    system: prompts.generateSystem,
    user,
    temperature: 0.7,
    model: model || (await resolveAnthropicModel()),
  });

  return {
    source: "anthropic" as const,
    sections,
    model: model || (await resolveAnthropicModel()),
  };
}
