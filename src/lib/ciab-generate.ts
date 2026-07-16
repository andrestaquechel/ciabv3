import {
  anthropicConfigured,
  anthropicJson,
  anthropicMissingKeyMessage,
  resolveAnthropicModel,
} from "@/lib/anthropic";
import { resolveTopicResearchModel } from "@/lib/claude-models";
import { retrieveArchiveExamples } from "@/lib/knowledge-retrieval";
import { checkSourceUrl } from "@/lib/topic-source-validation";
import {
  applyPromptTemplate,
  CIAB_CONCEPT_SYSTEM,
  CIAB_CONCEPT_USER,
  CIAB_CONTENT_CHATS_USER,
  CIAB_CONTENT_EMAILS_USER,
  CIAB_CONTENT_SYSTEM,
  CIAB_CONTENT_WELCOME_BLOG_USER,
  CIAB_OUTLINE_SYSTEM,
  CIAB_OUTLINE_USER,
  CIAB_SOURCES_SYSTEM,
  CIAB_SOURCES_USER,
  type CiabConcept,
  type CiabOutline,
  type CiabSource,
} from "@/lib/ciab-prompts";
import {
  CIAB_RESOURCES_INTRO,
  type CiabChat,
  type CiabEmail,
  type CiabGeneratedContent,
  type CiabWeek,
} from "@/lib/ciab";

/* ------------------------------------------------------------------ */
/* Context serializers                                                 */
/* ------------------------------------------------------------------ */

function sourcesContext(sources: CiabSource[]): string {
  if (!sources.length) return "(no vetted sources — do not invent statistics)";
  return sources
    .map(
      (s, i) =>
        `${i + 1}. ${s.name} (${s.publisher}, ${s.date}) — ${s.claim} [${s.url}] · ${s.tier}`,
    )
    .join("\n");
}

function outlineContext(outline: CiabOutline): string {
  return JSON.stringify(outline, null, 2);
}

/* ------------------------------------------------------------------ */
/* 1. Concept options                                                  */
/* ------------------------------------------------------------------ */

function mockConcepts(topic: string): CiabConcept[] {
  return [
    {
      id: "1",
      title: topic,
      subtitle: "A fresh, employee-facing angle on this month's theme",
      angle: `Help employees recognize ${topic} in the moment and act with confidence.`,
      whyFresh: "Focuses on recent, real-world developments rather than evergreen basics.",
      weeklyFocus: ["Introduction", "Sub-topic A", "Sub-topic B", "Habits & recap"],
      recommended: true,
    },
    {
      id: "2",
      title: `${topic}: The Human Angle`,
      subtitle: "Why good employees are the best defense",
      angle: `Reframe ${topic} around empowering, non-accusatory habits.`,
      whyFresh: "Leads with behavior change rather than fear.",
      weeklyFocus: ["The premise", "Everyday risks", "The overlooked risk", "Your checklist"],
    },
  ];
}

export async function generateCiabConceptOptions({
  topic,
  monthLabel,
  model,
}: {
  topic: string;
  monthLabel: string;
  model?: string;
}): Promise<{ concepts: CiabConcept[]; source: "anthropic" | "mock"; note?: string; model?: string }> {
  if (!anthropicConfigured()) {
    return { concepts: mockConcepts(topic), source: "mock", note: anthropicMissingKeyMessage() };
  }

  const archiveExamples = await retrieveArchiveExamples({ topic, boxType: "ciab" });
  const researchModel = resolveTopicResearchModel(model);
  const user = applyPromptTemplate(CIAB_CONCEPT_USER, {
    topic,
    monthLabel,
    archiveExamples,
  });

  const parsed = await anthropicJson<{ concepts: CiabConcept[] }>({
    system: CIAB_CONCEPT_SYSTEM,
    user,
    temperature: 0.6,
    maxTokens: 4096,
    model: researchModel,
    webSearch: true,
    webSearchMaxUses: 6,
  });

  const concepts = (parsed.concepts || []).slice(0, 4).map((c, i) => ({
    ...c,
    id: c.id || String(i + 1),
  }));

  return { concepts, source: "anthropic", model: researchModel };
}

/* ------------------------------------------------------------------ */
/* 2. Source research                                                  */
/* ------------------------------------------------------------------ */

function mockSources(): CiabSource[] {
  return [
    {
      name: "Verizon DBIR 2025",
      publisher: "Verizon",
      url: "https://www.verizon.com/business/resources/reports/dbir/",
      date: "May 2025",
      claim: "The human element was present in a majority of breaches.",
      tier: "Named report (Excellent) — mock data",
    },
    {
      name: "FBI IC3 2024 Annual Report",
      publisher: "FBI IC3",
      url: "https://www.ic3.gov/",
      date: "April 2025",
      claim: "Total reported cybercrime losses exceeded $16.6 billion.",
      tier: "Government (Excellent) — mock data",
    },
  ];
}

/** Drop sources whose URLs do not resolve so the box never cites a dead link. */
async function pruneBrokenSources(
  sources: CiabSource[],
): Promise<{ sources: CiabSource[]; dropped: number }> {
  const checked = await Promise.all(
    sources.map(async (s) => ({ s, ok: (await checkSourceUrl(s.url)).ok })),
  );
  const kept = checked.filter((c) => c.ok).map((c) => c.s);
  return { sources: kept, dropped: sources.length - kept.length };
}

export async function generateCiabSources({
  concept,
  model,
}: {
  concept: CiabConcept;
  model?: string;
}): Promise<{ sources: CiabSource[]; source: "anthropic" | "mock"; note?: string; model?: string }> {
  if (!anthropicConfigured()) {
    return { sources: mockSources(), source: "mock", note: anthropicMissingKeyMessage() };
  }

  const researchModel = resolveTopicResearchModel(model);
  const user = applyPromptTemplate(CIAB_SOURCES_USER, {
    title: concept.title,
    subtitle: concept.subtitle,
    weeklyFocus: (concept.weeklyFocus || []).join("; "),
  });

  const parsed = await anthropicJson<{ sources: CiabSource[] }>({
    system: CIAB_SOURCES_SYSTEM,
    user,
    temperature: 0.3,
    maxTokens: 4096,
    model: researchModel,
    webSearch: true,
    webSearchMaxUses: 10,
  });

  const raw = (parsed.sources || []).filter((s) => s.url?.trim());
  const { sources, dropped } = await pruneBrokenSources(raw);

  return {
    sources: sources.length ? sources : raw,
    source: "anthropic",
    model: researchModel,
    note: dropped
      ? `${dropped} source link${dropped > 1 ? "s" : ""} could not be verified and ${dropped > 1 ? "were" : "was"} removed.`
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Stakeholder outline                                              */
/* ------------------------------------------------------------------ */

function mockOutline(concept: CiabConcept, sources: CiabSource[]): CiabOutline {
  return {
    title: concept.title,
    subtitle: concept.subtitle,
    bigIdea: concept.angle,
    whyThisWhyNow: sources.slice(0, 3).map((s) => `According to ${s.name}, ${s.claim}`),
    whatMakesThisFresh: concept.whyFresh,
    sources,
    sections: (concept.weeklyFocus || []).map((f, i) => ({
      title: `${i === 0 ? "🎯 Introduction" : `Section ${i}`}: ${f}`,
      description: `This section covers ${f}.`,
      keyTeachingPoints: [`Key point about ${f}`, "What it means for employees", "The action to take"],
      safeDataMoment: `🎯 Your Move: pause and verify before acting on ${f}.`,
    })),
    campaignArc: (concept.weeklyFocus || []).map((f, i) => ({
      week: i + 1,
      topic: f,
      focus: f,
    })),
    whoThisIsFor: "Every employee at the organization.",
    tagline: concept.subtitle,
  };
}

export async function generateCiabOutline({
  concept,
  sources,
  model,
}: {
  concept: CiabConcept;
  sources: CiabSource[];
  model?: string;
}): Promise<{ outline: CiabOutline; source: "anthropic" | "mock"; note?: string; model?: string }> {
  if (!anthropicConfigured()) {
    return { outline: mockOutline(concept, sources), source: "mock", note: anthropicMissingKeyMessage() };
  }

  const archiveExamples = await retrieveArchiveExamples({ topic: concept.title, boxType: "ciab" });
  const resolvedModel = model || (await resolveAnthropicModel());
  const user = applyPromptTemplate(CIAB_OUTLINE_USER, {
    title: concept.title,
    subtitle: concept.subtitle,
    angle: concept.angle,
    weeklyFocus: (concept.weeklyFocus || []).join("; "),
    sources: sourcesContext(sources),
    archiveExamples,
  });

  const outline = await anthropicJson<CiabOutline>({
    system: CIAB_OUTLINE_SYSTEM,
    user,
    temperature: 0.5,
    maxTokens: 8192,
    model: resolvedModel,
  });

  // Preserve the vetted sources verbatim (the model can paraphrase, but the
  // links must stay exactly as verified).
  if (!outline.sources?.length) outline.sources = sources;
  if (!outline.title) outline.title = concept.title;

  return { outline, source: "anthropic", model: resolvedModel };
}

/* ------------------------------------------------------------------ */
/* 4. Full content (chunked)                                           */
/* ------------------------------------------------------------------ */

function mockContent(outline: CiabOutline): CiabGeneratedContent {
  const weeks: CiabWeek[] = [1, 2, 3, 4];
  return {
    topic: outline.title,
    tagline: outline.tagline,
    welcome: {
      body: `Hello!\n\nWelcome to your ${outline.title} Campaign in a Box! ${outline.bigIdea}\n\nIn this month's box you will find: a blog post from Living Security, weekly email messages, weekly chat messages, and complementary resources.\n\nYou are absolutely free to edit and customize the content we send as you see fit. Make this campaign your own!\n\nLive Secure,\nThe Living Security Team`,
    },
    blog: {
      title: outline.title,
      intro: outline.bigIdea,
      sections: outline.sections.slice(1).map((s) => ({
        heading: s.title,
        body: s.description,
        yourMove: s.safeDataMoment,
      })),
      conclusion: {
        heading: "Verification: Your Defense",
        body: "Pause before you act. When something feels off, report it to your security team.",
        yourFinalMove: "🎯 Your Final Move: share what you learned with a colleague.",
      },
    },
    emails: weeks.map((w) => ({
      week: w,
      greeting: "Hi, Everyone!",
      subject: `📌 Week ${w}`,
      body: `${outline.sections[w - 1]?.description || outline.bigIdea}\n\nUntil next time,\n{{ SIGNATURE }}`,
    })),
    chats: weeks.map((w) => ({
      week: w,
      message: `💡 Quick one for week ${w}: ${outline.sections[w - 1]?.safeDataMoment || outline.tagline}\n\nWhat would you do? Reply below! 👇`,
    })),
    resources: {
      intro: CIAB_RESOURCES_INTRO,
      items: ["Cyber Guide: Security Awareness", "Quick Tip: Staying Safe"],
    },
  };
}

export async function generateFullCiab({
  outline,
  sources,
  model,
}: {
  outline: CiabOutline;
  sources: CiabSource[];
  model?: string;
}): Promise<{ content: CiabGeneratedContent; source: "anthropic" | "mock"; note?: string; model?: string }> {
  if (!anthropicConfigured()) {
    return { content: mockContent(outline), source: "mock", note: anthropicMissingKeyMessage() };
  }

  const archiveExamples = await retrieveArchiveExamples({ topic: outline.title, boxType: "ciab" });
  const resolvedModel = model || (await resolveAnthropicModel());

  const baseVars = {
    title: outline.title,
    outline: outlineContext(outline),
    sources: sourcesContext(sources),
    archiveExamples,
  };

  // Generate in three chunks so no single response has to hold the entire box
  // (welcome + blog + 4 emails + 4 chats would blow past the token budget and
  // hurt quality). Each chunk shares the same approved outline + sources.
  const [welcomeBlog, emailsChunk, chatsChunk] = await Promise.all([
    anthropicJson<Pick<CiabGeneratedContent, "welcome" | "blog">>({
      system: CIAB_CONTENT_SYSTEM,
      user: applyPromptTemplate(CIAB_CONTENT_WELCOME_BLOG_USER, baseVars),
      temperature: 0.7,
      maxTokens: 8192,
      model: resolvedModel,
    }),
    anthropicJson<{ emails: CiabEmail[] }>({
      system: CIAB_CONTENT_SYSTEM,
      user: applyPromptTemplate(CIAB_CONTENT_EMAILS_USER, baseVars),
      temperature: 0.7,
      maxTokens: 8192,
      model: resolvedModel,
    }),
    anthropicJson<{ chats: CiabChat[]; resources: { items: string[] } }>({
      system: CIAB_CONTENT_SYSTEM,
      user: applyPromptTemplate(CIAB_CONTENT_CHATS_USER, baseVars),
      temperature: 0.75,
      maxTokens: 4096,
      model: resolvedModel,
    }),
  ]);

  const content: CiabGeneratedContent = {
    topic: outline.title,
    tagline: outline.tagline,
    welcome: welcomeBlog.welcome,
    blog: welcomeBlog.blog,
    emails: (emailsChunk.emails || []).slice(0, 4),
    chats: (chatsChunk.chats || []).slice(0, 4),
    resources: {
      intro: CIAB_RESOURCES_INTRO,
      items: chatsChunk.resources?.items || [],
    },
  };

  return { content, source: "anthropic", model: resolvedModel };
}
