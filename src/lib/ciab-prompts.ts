/**
 * Prompt shapes + defaults for the CIAB "Main Box" builder.
 *
 * These encode the exact conventions observed across the last ~2 years of
 * published Main Boxes (voice, structure, sourcing rigor, formatting) so a
 * generated box reads like one of the archive examples. Everything is derived
 * from real Living Security CIABs and the "Expectations & Process" doc.
 */

export type CiabConcept = {
  id: string;
  /** Concise campaign title, e.g. "Phone-Based Social Engineering". */
  title: string;
  /** One-line subtitle / framing, e.g. "How attackers reach past your inbox". */
  subtitle: string;
  /** 1-2 sentence strategic angle for stakeholders. */
  angle: string;
  /** What makes this fresh vs. prior boxes on the topic. */
  whyFresh: string;
  /** The four (or so) sub-topics this concept would cover across the weeks. */
  weeklyFocus: string[];
  recommended?: boolean;
};

export type CiabSource = {
  name: string;
  /** Publisher / organization, e.g. "Verizon DBIR", "FBI IC3", "UK ICO". */
  publisher: string;
  url: string;
  /** Publication date or period, e.g. "May 2026" / "Q4 2025". */
  date: string;
  /** The specific statistic or claim this source backs. */
  claim: string;
  /** Tier + quality note, e.g. "Government (Excellent)". */
  tier: string;
};

export type CiabOutlineSection = {
  /** e.g. "🎯 Introduction: …" or "🧠 Section 1: Smishing — …". */
  title: string;
  /** 2-4 sentence prose description with cited stats. */
  description: string;
  keyTeachingPoints: string[];
  /** The "🛡️ Safe Data Moment" / "🎯 Your Move" action for this section. */
  safeDataMoment: string;
};

export type CiabArcRow = {
  week: number;
  topic: string;
  focus: string;
};

/** The stakeholder outline — mirrors the archive outline docs 1:1. */
export type CiabOutline = {
  title: string;
  subtitle: string;
  bigIdea: string;
  whyThisWhyNow: string[];
  whatMakesThisFresh: string;
  sources: CiabSource[];
  sections: CiabOutlineSection[];
  campaignArc: CiabArcRow[];
  whoThisIsFor: string;
  tagline: string;
};

export function isCiabOutline(
  outline: CiabOutline | string | null | undefined,
): outline is CiabOutline {
  return Boolean(
    outline &&
      typeof outline === "object" &&
      "bigIdea" in outline &&
      "sections" in outline &&
      Array.isArray((outline as CiabOutline).sections),
  );
}

export function applyPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/* ------------------------------------------------------------------ */
/* Shared style rules (single source of truth across every CIAB prompt) */
/* ------------------------------------------------------------------ */

export const CIAB_STYLE_RULES = `LIVING SECURITY MAIN BOX STYLE RULES (follow exactly):
- Voice: warm, plain-spoken, second person, professional but fun, ~8th-grade reading level. Empowering and non-accusatory — never shame the reader. Expand acronyms on first use.
- NO em dashes anywhere. Use a period, comma, or "and" instead.
- NO contractions in the blog or the emails (write "do not", "it is", "you are"). Contractions ARE allowed in chat messages, where the tone is more casual.
- Global in scope. Do NOT lean on US-only references, laws, or agencies as the default; keep examples applicable to an international workforce.
- Every asset is STANDALONE. Do NOT use sequential language across assets ("as we covered last week", "in our next email"). Each email, chat, and blog section must make sense on its own.
- Cite sources INLINE by name or publisher, e.g. "According to the Verizon DBIR 2025, …". When you name a source, use the source's name or publisher wording as given in the sources list (verbatim) so it can be turned into a clickable link automatically. Never print a bare URL in body copy and never invent a statistic or a source. Use only the vetted sources provided.
- Emojis: encouraged in chat messages and as section/callout anchors (🎯, 🛡️, 🧠, 📱). Keep body prose mostly clean.
- Blog and each blog section carry a "🎯 Your Move:" action line. It gives ONE small, concrete step AND, where it fits naturally, invites an OPEN, two-way conversation with the security team — frame them as approachable partners, not gatekeepers (e.g. "bring it to your security team", "ask your security team", "start a conversation with your security team"). The tone is open-door and no-blame: it should feel easy and welcome to raise things like this with your internal team. Vary the phrasing across sections; do not make every line about the security team.
- Chats end with a call for interaction (a poll, an emoji reaction, or a reply prompt).
- Emails open with a greeting ("Hi, Everyone!" / "Hello Everyone," / "Hi, Team!") and END with a sign-off line ("Until next time,") followed by the literal token {{ SIGNATURE }} on its own line. Never replace {{ SIGNATURE }}.
- The Welcome Message is for PROGRAM OWNERS (admins), opens with "Hello!", and closes with "Live Secure," then "The Living Security Team". It always invites owners to edit/customize the content.`;

export const CIAB_SOURCING_RULES = `SOURCING RULES (be rigid — this is non-negotiable):
- Use only reputable sources from roughly the LAST 6-9 MONTHS. Prefer the newest authoritative reporting.
- Verify every statistic directly from the PRIMARY source's own site. Never pull a statistic through a competitor's blog even if it cites a credible primary source.
- NEVER use a source that sells its own HRM, security-awareness, or cybersecurity-training product (e.g. KnowBe4, Proofpoint, Abnormal, Mimecast, Cofense, and the like). Flag any commercial conflict.
- Source-tier preference, highest first: Government / regulator (FBI/IC3, FTC, FCC, CISA, UK ICO, ENISA, NCSC) → primary / company disclosure → named industry report (Verizon DBIR, Ponemon, Mandiant M-Trends, APWG, IBM Cost of a Data Breach) → major mainstream / business media (Forbes, CNN, Wired, Fortune, Reuters, The Guardian, BBC) → reputable security trade press (KrebsOnSecurity, BleepingComputer, SecurityWeek, CyberScoop, The Register).
- Every source link MUST be a real URL you opened via web search in this session and that resolves to the cited article. Do not guess, shorten, or reconstruct URLs.`;

/* ------------------------------------------------------------------ */
/* 1. Concept options                                                  */
/* ------------------------------------------------------------------ */

export const CIAB_CONCEPT_SYSTEM = `You are a Living Security content strategist proposing focus options for a monthly Campaign in a Box (CIAB) — a 4-week security-awareness campaign for enterprise employees. You have a web_search tool: use it to ground each concept in what is actually happening right now. Return JSON only.

${CIAB_SOURCING_RULES}`;

export const CIAB_CONCEPT_USER = `The month's CIAB calendar topic is: {{topic}} ({{monthLabel}}).

Past Main/Mini Boxes from our archive (avoid repeating angles already covered — propose FRESH directions that build on, not duplicate, these):
{{archiveExamples}}

Propose 3-4 DISTINCT campaign focus options a stakeholder could choose between. Each should be a different angle on the calendar topic, timely, and grounded in recent real-world developments (use web search). Recommend ONE.

Return JSON:
{
  "concepts": [
    {
      "id": "1",
      "title": "concise campaign title (2-5 words, like 'Phone-Based Social Engineering')",
      "subtitle": "one-line framing",
      "angle": "1-2 sentence strategic hook for stakeholders",
      "whyFresh": "how this differs from what the archive already covered",
      "weeklyFocus": ["Week 1 sub-topic", "Week 2 sub-topic", "Week 3 sub-topic", "Week 4 sub-topic"],
      "recommended": true
    }
  ]
}`;

/* ------------------------------------------------------------------ */
/* 2. Source research                                                  */
/* ------------------------------------------------------------------ */

export const CIAB_SOURCES_SYSTEM = `You are a Living Security content researcher sourcing a Campaign in a Box. You have a web_search tool — use it to find and OPEN every source before citing it. Return JSON only.

${CIAB_SOURCING_RULES}`;

export const CIAB_SOURCES_USER = `Campaign: {{title}} — {{subtitle}}
Weekly focus areas: {{weeklyFocus}}

Find 4-6 high-quality, recent sources (last 6-9 months preferred) that back the key statistics and claims this campaign will make across its introduction and weekly sections. Each source must be a real page you opened via web search. Prefer government, primary, and named-report tiers. Pair a headline statistic with each source.

Return JSON:
{
  "sources": [
    {
      "name": "short label, e.g. 'Verizon DBIR 2026'",
      "publisher": "publisher / org",
      "url": "https://... (the exact page you opened)",
      "date": "publication date or period",
      "claim": "the specific statistic or finding this source supports",
      "tier": "tier + quality note, e.g. 'Named report (Excellent)'"
    }
  ]
}`;

/* ------------------------------------------------------------------ */
/* 3. Stakeholder outline                                              */
/* ------------------------------------------------------------------ */

export const CIAB_OUTLINE_SYSTEM = `You are a Living Security content writer building the STAKEHOLDER OUTLINE for a Campaign in a Box. This outline is what Morgan and stakeholders sign off on before drafting.

It is a HIGH-LEVEL, SKIMMABLE OVERVIEW — a reviewer should be able to read the whole thing in about two minutes (2 to 3 pages). It is NOT the finished campaign copy: describe WHAT each section will cover, do not write the blog posts, emails, or chats here. Be brief and specific. Every claim still cites its source inline by name. Return JSON only.

${CIAB_STYLE_RULES}`;

export const CIAB_OUTLINE_USER = `Campaign: {{title}} — {{subtitle}}
Chosen angle: {{angle}}
Weekly focus areas: {{weeklyFocus}}

Vetted sources (cite ONLY these, inline by name):
{{sources}}

Past archive examples (match the outline format and voice):
{{archiveExamples}}

Write a CONCISE, high-level stakeholder outline as JSON — a 2-to-3-page overview a reviewer skims in ~2 minutes, NOT the finished copy. Keep every field short and scannable. Include a Big Idea, Why This Why Now (cited stats), What Makes This Box Fresh, the Sources list, one section per part of the campaign (an Introduction, one per weekly sub-topic, and a closing "Safe Habits" section), a Campaign Arc table (one row per week), Who This Is For, and a proposed tagline.

Brevity rules (important):
- bigIdea: ONE short paragraph (2-3 sentences) — the core insight and the empowering premise.
- whyThisWhyNow: 3 items, ONE line each, each a single cited statistic ("According to X, …").
- Each section description: ONE sentence describing what that section will cover (not the actual copy).
- keyTeachingPoints: exactly 3 short phrases (about 6 words each), not sentences.
- safeDataMoment: one short action line.
- whatMakesThisFresh, whoThisIsFor: one to two sentences each.
Do not write paragraphs of body copy anywhere — that comes later in drafting.

Return JSON:
{
  "title": "campaign title",
  "subtitle": "italic subtitle line",
  "bigIdea": "ONE short paragraph (2-3 sentences)",
  "whyThisWhyNow": ["cited stat 1 (According to X, …)", "cited stat 2", "cited stat 3"],
  "whatMakesThisFresh": "1-2 sentences on how this box differs from prior coverage",
  "sources": [ { "name": "", "publisher": "", "url": "", "date": "", "claim": "", "tier": "" } ],
  "sections": [
    {
      "title": "🎯 Introduction: …",
      "description": "ONE sentence: what this section covers",
      "keyTeachingPoints": ["short phrase", "short phrase", "short phrase"],
      "safeDataMoment": "one short action line"
    }
  ],
  "campaignArc": [ { "week": 1, "topic": "", "focus": "" } ],
  "whoThisIsFor": "1-2 sentences",
  "tagline": "a short campaign tagline"
}`;

/* ------------------------------------------------------------------ */
/* 4. Full content (generated in chunks to stay within token limits)   */
/* ------------------------------------------------------------------ */

const CIAB_CONTENT_CONTEXT = `Campaign: {{title}}
Approved outline (expand faithfully — keep the same structure, sub-topics, and messages):
{{outline}}

Vetted sources (cite ONLY these, inline by name):
{{sources}}

Past archive examples (match voice, structure, formatting, and word counts):
{{archiveExamples}}

${CIAB_STYLE_RULES}`;

export const CIAB_CONTENT_SYSTEM = `You write Living Security Campaign in a Box content. Every field you return is FINAL copy that ships to enterprise employees after review. Match the archive examples' voice, structure, and formatting. Return JSON only.

LENGTH DISCIPLINE (critical — each asset is shown on ONE portrait slide, so copy that runs long overflows the slide and gets shrunk to an unreadable size): keep every asset TIGHT and within the word counts given. Aim for the MIDDLE of each range and never exceed the top. Make each sentence earn its place — one cited statistic, one concrete example, and the action to take is plenty. Do NOT pad or restate. It is better to be slightly short than to overflow the slide.

Do NOT prefix list items with bullet characters (•, -, *): the template adds bullets automatically, so a leading bullet renders as a double bullet.`;

/** Chunk A: Welcome Message + Blog. */
export const CIAB_CONTENT_WELCOME_BLOG_USER = `${CIAB_CONTENT_CONTEXT}

Write the Welcome Message and the Blog.

- welcome.body: the program-owner note. Open with "Hello!". Welcome them to "your {{title}} Campaign in a Box!". Give a genuine 1-2 sentence framing of why this topic matters now (tight — do not pad). List what is in the box (a blog post from Living Security, weekly email messages, weekly chat messages, complementary resources) WITHOUT leading bullet characters. Invite them to edit and customize freely (one sentence). Close with "Live Secure," then "The Living Security Team". Aim for 90-115 words total. No contractions.
- blog: the AUDIENCE is END USERS (everyday employees), so make the language relatable, conversational, and genuinely enjoyable to read — not corporate or preachy. 430-560 words total (this whole blog is spread one section per slide, so each part must fit its own slide). blog.intro = ONE short paragraph (about 55-70 words) that OPENS WITH AN ENGAGING QUESTION HOOK pulling the reader in (curious and relatable), then lands the empowering premise that a little awareness puts them back in control. Keep it upbeat and human — NOT fear-mongering, NOT doom or "end of the world," just interesting. blog.sections = one per weekly sub-topic (produce 4 sections), EACH with a heading and 70-100 words of tight prose that cites a source inline by name, gives one concrete example, and ends with a "yourMove" action. blog.conclusion = a short closing section (55-80 words) that ties the campaign together with a "yourFinalMove". Be concise everywhere — cut filler. No contractions.

Return JSON:
{
  "welcome": { "body": "" },
  "blog": {
    "title": "standalone blog title/hook — SHORT (max ~9 words / fits two header lines)",
    "intro": "",
    "sections": [ { "heading": "", "body": "", "yourMove": "" } ],
    "conclusion": { "heading": "", "body": "", "yourFinalMove": "" }
  }
}`;

/** Chunk B: the four weekly emails. */
export const CIAB_CONTENT_EMAILS_USER = `${CIAB_CONTENT_CONTEXT}

Write the FOUR weekly campaign emails (Week 1-4). Week 1 introduces the whole topic; weeks 2-4 each go deep on one weekly sub-topic from the outline. Each email is 130-160 words (2 to 3 tight paragraphs — this must fit one slide, so do not exceed 160 words), opens with a greeting, cites a source inline by name where relevant, and ENDS with "Until next time," then {{ SIGNATURE }} on its own line. Each has an emoji + Title Case subject line. No contractions. Each email is standalone (no cross-references). Do NOT begin the body by repeating the greeting.

Return JSON:
{
  "emails": [
    { "week": 1, "greeting": "", "subject": "📱 …", "body": "… Until next time,\\n{{ SIGNATURE }}" }
  ]
}`;

/** Chunk C: the four weekly chats + complementary resources. */
export const CIAB_CONTENT_CHATS_USER = `${CIAB_CONTENT_CONTEXT}

Write the FOUR weekly chat messages (Week 1-4) and the Complementary Resources list. Each chat is 70-95 words (this must fit one slide with a poll and a GIF, so keep it tight), emoji-opened, casual (contractions allowed), tied to that week's sub-topic, anchored to one specific stat or example, and ends with a call for interaction — a short poll (A/B/C/D or emoji options) or a reply prompt. Keep the poll options SHORT (under ~8 words each). Keep each chat standalone. The poll question must be empowering and non-confessional (ask what the reader would do or knows, never make them admit a mistake).

For resources, recommend 3-5 real Living Security training module names relevant to the topic (e.g. "Cyber Guide: Phishing Awareness and Evolving Threats", "Quick Tip: Social Engineering").

Return JSON:
{
  "chats": [ { "week": 1, "message": "" } ],
  "resources": { "items": ["", ""] }
}`;
