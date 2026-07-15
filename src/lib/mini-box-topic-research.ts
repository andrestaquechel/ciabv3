import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
} from "@/lib/anthropic";
import { currentMonthCiabTopic } from "@/lib/annual-calendar-types";
import { loadAppSettingsFromDrive } from "@/lib/box-studio-drive-data";
import {
  applyPromptTemplate,
  resolveTopicResearchPrompts,
  type TopicCandidate,
  type TopicResearchPromptsConfig,
  type TopicResearchResult,
} from "@/lib/mini-box-topic-prompts";

function mockCandidates(monthlyCiabTopic?: string): TopicCandidate[] {
  const base = monthlyCiabTopic || "security awareness";
  return [
    {
      id: "1",
      topicHook: "When AI Follows the Wrong Instructions",
      whatHappened:
        "Researchers showed how attackers can hide malicious instructions in documents that AI assistants read and act on.",
      endUserMeaning: `Employees should treat AI tools like any other software: don't paste sensitive data into unapproved tools, and verify outputs before acting. Aligns with ${base}.`,
      hrmCompetitor: "no",
      alignsWithCiab: monthlyCiabTopic ? "partial" : "no",
      sourceName: "Wired",
      sourceType: "mainstream",
      sourceLink: "https://www.wired.com/",
      sourceQuality: "Good — mainstream tier; mock data for dev",
    },
    {
      id: "2",
      topicHook: "Shadow AI at Work",
      whatHappened:
        "Employees adopt AI tools without IT approval, creating blind spots for security teams.",
      endUserMeaning:
        "Check with IT before using new AI tools. Unapproved tools can leak company data.",
      hrmCompetitor: "no",
      alignsWithCiab: "yes",
      sourceName: "TechCrunch",
      sourceType: "trade",
      sourceLink: "https://techcrunch.com/",
      sourceQuality: "Good — trade press; mock data",
    },
    {
      id: "3",
      topicHook: "Deepfake CEO Scams Keep Spreading",
      whatHappened:
        "Criminals use AI-generated voice and video to impersonate executives and request wire transfers.",
      endUserMeaning:
        "Verify unusual money or data requests through a second channel — call back on a known number.",
      hrmCompetitor: "no",
      alignsWithCiab: "partial",
      sourceName: "FBI IC3",
      sourceType: "gov",
      sourceLink: "https://www.ic3.gov/",
      sourceQuality: "Excellent — gov tier; mock data",
    },
    {
      id: "4",
      topicHook: "Password Managers Under Phishing Fire",
      whatHappened:
        "Attackers create fake login pages targeting password vault users.",
      endUserMeaning:
        "Use bookmarked URLs, enable MFA on your vault, and report suspicious login prompts.",
      hrmCompetitor: "no",
      alignsWithCiab: "yes",
      sourceName: "BleepingComputer",
      sourceType: "trade",
      sourceLink: "https://www.bleepingcomputer.com/",
      sourceQuality: "Good — trade press; mock data",
    },
    {
      id: "5",
      topicHook: "QR Code Scams in Parking Lots",
      whatHappened:
        "Fake QR stickers redirect people to credential-harvesting payment pages.",
      endUserMeaning:
        "Type official URLs manually instead of scanning unknown QR codes in public places.",
      hrmCompetitor: "no",
      alignsWithCiab: "no",
      sourceName: "FTC",
      sourceType: "gov",
      sourceLink: "https://www.ftc.gov/",
      sourceQuality: "Excellent — gov tier; mock data",
    },
    {
      id: "6",
      topicHook: "Mobile Malware Poses as Banking Apps",
      whatHappened:
        "Fake apps in unofficial stores steal login credentials from mobile users.",
      endUserMeaning:
        "Install apps only from official app stores and keep auto-updates on.",
      hrmCompetitor: "no",
      alignsWithCiab: "partial",
      sourceName: "CISA",
      sourceType: "gov",
      sourceLink: "https://www.cisa.gov/",
      sourceQuality: "Excellent — gov tier; mock data",
    },
  ];
}

export async function loadTopicResearchPrompts(): Promise<
  Required<import("@/lib/mini-box-topic-prompts").TopicResearchPromptsConfig>
> {
  try {
    const settings = await loadAppSettingsFromDrive();
    return resolveTopicResearchPrompts(settings?.topicResearchPrompts);
  } catch {
    return resolveTopicResearchPrompts(null);
  }
}

export async function generateTopicCandidates({
  monthlyCiabTopic: ciabOverride,
  prompts: promptOverride,
  model,
}: {
  monthlyCiabTopic?: string;
  prompts?: TopicResearchPromptsConfig;
  model?: string;
} = {}): Promise<TopicResearchResult & { source: "anthropic" | "mock"; note?: string }> {
  let monthlyCiabTopic = ciabOverride;
  if (!monthlyCiabTopic) {
    try {
      const settings = await loadAppSettingsFromDrive();
      monthlyCiabTopic = currentMonthCiabTopic(settings?.annualCalendars);
    } catch {
      monthlyCiabTopic = undefined;
    }
  }

  if (!anthropicConfigured()) {
    return {
      source: "mock",
      monthlyCiabTopic,
      candidates: mockCandidates(monthlyCiabTopic),
      note: anthropicMissingKeyMessage(),
    };
  }

  const prompts = promptOverride
    ? resolveTopicResearchPrompts(promptOverride)
    : await loadTopicResearchPrompts();

  const user = applyPromptTemplate(prompts.topicResearchUser, {
    monthlyCiabTopic: monthlyCiabTopic || "(not set — upload annual calendar in Knowledge Base or Slack)",
  });

  const parsed = await anthropicJson<{ candidates: TopicCandidate[] }>({
    system: prompts.topicResearchSystem,
    user,
    temperature: 0.5,
    maxTokens: 8192,
    model,
  });

  const candidates = (parsed.candidates || []).slice(0, 6).map((c, i) => ({
    ...c,
    id: c.id || String(i + 1),
  }));

  return { source: "anthropic", monthlyCiabTopic, candidates };
}
