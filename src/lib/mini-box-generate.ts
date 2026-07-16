import type { SourceArticle, GeneratedMiniBoxSections } from "@/lib/mini-box";
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
  isStructuredOutline,
  outlineToContextText,
  resolveGenerationPrompts,
} from "@/lib/mini-box-prompts";
import { loadAppSettingsFromDrive } from "@/lib/box-studio-drive-data";
import { retrieveArchiveExamples } from "@/lib/knowledge-retrieval";

export type { GeneratedMiniBoxSections } from "@/lib/mini-box";

const TEAM_SIGNOFF = "The Living Security Team";

export type FullBoxResult = {
  source: "outline" | "anthropic" | "mock";
  sections: GeneratedMiniBoxSections;
  note?: string;
  model?: string;
};

/** Map a structured outline (the approved slide content) onto the deck 1:1. */
export function outlineToSections(outline: MiniBoxOutline): GeneratedMiniBoxSections {
  return {
    welcome: {
      intro: outline.welcome?.intro ?? "",
      contents: outline.welcome?.contents ?? "",
      closing: outline.welcome?.closing?.trim() || TEAM_SIGNOFF,
    },
    onePager: {
      greeting: outline.onePager?.greeting ?? "",
      subjectLine: outline.onePager?.subjectLine ?? "",
      bodyPart1: outline.onePager?.bodyPart1 ?? "",
      callout: outline.onePager?.callout ?? "",
      bodyPart2: outline.onePager?.bodyPart2 ?? "",
    },
    chat: { message: outline.chat?.message ?? "" },
  };
}

/** Per-slide GIF search intents derived from the outline (plan first, else content). */
export function gifPlanFromOutline(outline: MiniBoxOutline) {
  return {
    welcome: outline.gifPlan?.welcome || outline.welcome?.intro || outline.topic || "",
    onePager: outline.gifPlan?.onePager || outline.onePager?.subjectLine || outline.topic || "",
    chat: outline.gifPlan?.chat || outline.chat?.message || outline.topic || "",
  };
}

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
    topic,
    angle: `Help employees recognize ${topic} and take one safer action today.`,
    audience: "All employees",
    welcome: {
      intro: `Welcome to your Mini Box on ${topic}. This one is worth a look — we break down what's happening and the simple habits that keep your team safe.`,
      contents: `In this topical mini box, you'll find:\n1. A one-pager explaining ${topic} and why it matters right now.\n2. A chat message with a quick scenario to reinforce one clear habit.`,
      closing: TEAM_SIGNOFF,
    },
    onePager: {
      greeting: "Hi, Team!",
      subjectLine: `🔒 ${topic}: What You Need to Know`,
      bodyPart1: `${topic} has been in the news, and it's worth a quick look. Here's what happened and why it matters to you.`,
      callout: `${topic}: when something feels urgent, pause and verify before you act.`,
      bodyPart2: `The good news is a few simple habits go a long way:\n🔍 Slow down on urgent or unusual requests.\n📄 Verify through a second, known channel.\n⚠️ Report anything that feels off to security.\n✅ Stick to approved tools and links.\n🙋 Ask when you're unsure — better safe than sorry.\n\nStay safe out there,\n{{ SIGNATURE }}`,
    },
    chat: {
      message: `💡 Quick scenario on ${topic}\n\nSomething feels off — what's your move?\nA. Ignore it 🤷\nB. Handle it yourself 🛠️\nC. Pause and verify 🛑\nD. Ask security 🙋\n\nReply in this thread with your answer! 👇\n\n_Hint: when something pressures you to act fast, that pressure is itself the red flag._`,
    },
    gifPlan: {
      welcome: `${topic} awareness`,
      onePager: `${topic} warning`,
      chat: "thinking decision choice",
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

  const archiveExamples = await retrieveArchiveExamples({ topic, boxType: "mini-box" });

  const user = applyPromptTemplate(prompts.outlineUser, {
    topic,
    notes: notes.trim() || "(none)",
    articles: articleContext(articles),
    archiveExamples,
  });

  const outline = await anthropicJson<MiniBoxOutline>({
    system: prompts.outlineSystem,
    user,
    temperature: 0.5,
    maxTokens: 8192,
    model: model || (await resolveAnthropicModel()),
  });

  if (!outline.topic) outline.topic = topic;

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
}): Promise<FullBoxResult> {
  // A structured outline already holds the approved slide content — the box IS
  // that outline, so map it 1:1 with no second (drift-prone) model pass.
  if (isStructuredOutline(outline)) {
    return { source: "outline", sections: outlineToSections(outline) };
  }

  const prompts = promptOverride
    ? resolveGenerationPrompts(promptOverride)
    : await loadGenerationPrompts();

  if (!anthropicConfigured()) {
    return {
      source: "mock",
      sections: outlineToSections(mockOutline(topic)),
      note: anthropicMissingKeyMessage(),
    };
  }

  const archiveExamples = await retrieveArchiveExamples({ topic, boxType: "mini-box" });

  const user = applyPromptTemplate(prompts.generateFullUser, {
    topic,
    notes: notes.trim() || "(none)",
    outline: outlineToContextText(outline),
    articles: articleContext(articles),
    archiveExamples,
  });

  const resolvedModel = model || (await resolveAnthropicModel());
  const sections = await anthropicJson<GeneratedMiniBoxSections>({
    system: prompts.generateSystem,
    user,
    temperature: 0.7,
    maxTokens: 8192,
    model: resolvedModel,
  });

  return { source: "anthropic", sections, model: resolvedModel };
}
