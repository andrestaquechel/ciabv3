import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
} from "@/lib/anthropic";
import { resolveTopicResearchModel } from "@/lib/claude-models";
import { currentMonthCiabTopic } from "@/lib/annual-calendar-types";
import { loadAppSettingsFromDrive } from "@/lib/box-studio-drive-data";
import { loadAnnualCalendarsConfig } from "@/lib/db/annual-calendars";
import {
  applyPromptTemplate,
  resolveTopicResearchPrompts,
  type TopicCandidate,
  type TopicResearchPromptsConfig,
  type TopicResearchResult,
} from "@/lib/mini-box-topic-prompts";
import {
  validateAllTopicCandidates,
  validateTopicCandidateUrls,
} from "@/lib/topic-source-validation";

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

async function repairBrokenTopicLinks(
  candidates: TopicCandidate[],
  brokenById: Map<string, string[]>,
  model: string,
): Promise<TopicCandidate[]> {
  if (brokenById.size === 0) return candidates;

  const toFix = candidates
    .filter((c) => brokenById.has(c.id))
    .map((c) => ({
      ...c,
      brokenUrls: brokenById.get(c.id),
    }));

  const fixed = await anthropicJson<{ candidates: TopicCandidate[] }>({
    system: `You fix broken source URLs for Living Security Mini Box topic research. Return JSON only. Every replacement URL must be real — do not invent paths.`,
    user: `These topic candidates have source URLs that returned 404 or failed to load. Replace ONLY sourceLink and secondarySourceLink with working URLs to the same story (or the publication's verified article page).

Rules:
- Use exact, real article URLs you are confident exist.
- If the exact article cannot be found, use a working URL from the same publication that covers the same story, and update sourceName/sourceQuality accordingly.
- Never fabricate IC3 PSA numbers, Forbes slugs, or BleepingComputer paths.

Candidates to fix:
${JSON.stringify(toFix, null, 2)}

Return JSON: { "candidates": [ ...same ids with corrected links... ] }`,
    temperature: 0.2,
    maxTokens: 4096,
    model,
  });

  const fixedMap = new Map(
    (fixed.candidates || []).map((c) => [c.id, c] as const),
  );
  return candidates.map((c) => fixedMap.get(c.id) ?? c);
}

async function ensureValidTopicUrls(
  candidates: TopicCandidate[],
  model: string,
): Promise<{ candidates: TopicCandidate[]; note?: string }> {
  let current = candidates;
  let note: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const brokenById = await validateAllTopicCandidates(current);
    if (brokenById.size === 0) return { candidates: current };

    const brokenList = [...brokenById.entries()]
      .map(([id, urls]) => `#${id}: ${urls.join(", ")}`)
      .join("; ");

    console.warn(`Topic research: broken URLs (attempt ${attempt + 1}): ${brokenList}`);

    current = await repairBrokenTopicLinks(current, brokenById, model);

    const stillBroken = await validateAllTopicCandidates(current);
    if (stillBroken.size === 0) {
      note = "Some source links were auto-corrected after verification.";
      return { candidates: current, note };
    }
  }

  // Drop candidates whose primary link still fails; annotate survivors
  const validated: TopicCandidate[] = [];
  for (const c of current) {
    const { broken } = await validateTopicCandidateUrls(c);
    if (broken.includes(c.sourceLink)) continue;
    validated.push({
      ...c,
      sourceQuality: broken.length
        ? `${c.sourceQuality} (secondary link removed — could not verify)`
        : c.sourceQuality,
      secondarySourceLink: broken.includes(c.secondarySourceLink || "")
        ? undefined
        : c.secondarySourceLink,
      secondarySourceName: broken.includes(c.secondarySourceLink || "")
        ? undefined
        : c.secondarySourceName,
    });
  }

  note =
    validated.length < current.length
      ? "Some topics were removed because source URLs could not be verified."
      : "Some source links could not be verified and were corrected or removed.";

  return {
    candidates: validated.length >= 3 ? validated : current,
    note,
  };
}

export async function generateTopicCandidates({
  monthlyCiabTopic: ciabOverride,
  prompts: promptOverride,
  model,
}: {
  monthlyCiabTopic?: string;
  prompts?: TopicResearchPromptsConfig;
  model?: string;
} = {}): Promise<
  TopicResearchResult & {
    source: "anthropic" | "mock";
    note?: string;
    model?: string;
  }
> {
  let monthlyCiabTopic = ciabOverride;
  if (!monthlyCiabTopic) {
    try {
      const calendars = await loadAnnualCalendarsConfig();
      monthlyCiabTopic = currentMonthCiabTopic(calendars);
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

  const researchModel = resolveTopicResearchModel(model);

  const user = applyPromptTemplate(prompts.topicResearchUser, {
    monthlyCiabTopic: monthlyCiabTopic || "(not set — upload annual calendar in Knowledge Base or Slack)",
  });

  const parsed = await anthropicJson<{ candidates: TopicCandidate[] }>({
    system: prompts.topicResearchSystem,
    user,
    temperature: 0.4,
    maxTokens: 8192,
    model: researchModel,
  });

  let candidates = (parsed.candidates || []).slice(0, 6).map((c, i) => ({
    ...c,
    id: c.id || String(i + 1),
  }));

  const { candidates: validated, note: urlNote } = await ensureValidTopicUrls(
    candidates,
    researchModel,
  );
  candidates = validated;

  return {
    source: "anthropic",
    monthlyCiabTopic,
    candidates,
    model: researchModel,
    note: urlNote,
  };
}
