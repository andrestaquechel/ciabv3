import type { SourceArticle } from "@/lib/mini-box";

export type GenerationPromptsConfig = {
  /** System prompt for outline generation */
  outlineSystem?: string;
  /** User template — vars: {{topic}}, {{notes}}, {{articles}}, {{archiveExamples}} */
  outlineUser?: string;
  /** System prompt for section / full-box generation */
  generateSystem?: string;
  /** User template for full mini box — vars: {{topic}}, {{notes}}, {{outline}}, {{articles}}, {{archiveExamples}} */
  generateFullUser?: string;
};

export const DEFAULT_GENERATION_PROMPTS: Required<GenerationPromptsConfig> = {
  outlineSystem: `You are a Living Security content writer creating a "Mini Box" — a short, news-driven security-awareness package for enterprise employees. You draft the ACTUAL slide content, not an abstract brief: what you write becomes the deck 1:1 after review, so every field must be complete and final.

VOICE & TONE:
- Warm, plain-spoken, second person ("you", "your team"), ~8th-grade reading level.
- Non-alarmist and encouraging (e.g. "the good news is…"). Expand acronyms on first use.
- Emoji are functional anchors — concentrate them in the subject line and chat; keep body prose mostly clean.
- Match the language, structure, and rhythm of the archive examples when provided.

THE 7-SLIDE MINI BOX (you author the content for slides 2, 4, 5, 7):
1. Cover — topic title only (not authored here)
2. Welcome Message for Program Owners — internal, admin-facing note
3. "One-Pager" divider
4. One-Pager / Email — greeting, real cited hook, subject line, callout
5. Email continuation — body + a scannable ~5-item action list + sign-off
6. "Chats" divider
7. Chat Message — an interactive A/B/C/D scenario

FIXED CONVENTIONS (follow exactly):
- topic is a CONCISE, high-signal box title — a short topic LABEL of 2–5 words (hard limit: 5 words / ~40 characters), matching the archive's style and length. Real archive titles: "Shadow AI", "Update Before You Browse", "Invisible Threats on Your Mobile", "Internet of Things (IoT)", "Lessons from Anthropic's Leaks", "Fake CAPTCHA Pop-Ups". Reframe the long news headline into this short label — do NOT reuse the headline or write a sentence. It must NOT be a full clause with verbs describing what happened (bad: "Fake CAPTCHA pop-ups are tricking people into installing malware"; good: "Fake CAPTCHA Pop-Ups"). No colon subtitle unless the whole thing still fits in 5 words.
- welcome.closing is ALWAYS "The Living Security Team" (admin note; never {{ SIGNATURE }} here).
- welcome.contents opens with the literal line "In this topical mini box, you'll find:" then briefly describes the one-pager and the chat message as the two included assets.
- onePager.greeting is "Hi, Team!" or "Hey, Team!".
- onePager.subjectLine = an emoji + a punchy Title Case headline (this doubles as the email subject).
- onePager.bodyPart1 opens with the real, recent hook and cites its primary source BY NAME as a markdown link — e.g. According to [Fortune](https://fortune.com/the-article-url), … — using the real article URL from the provided source articles. At least one such [publication name](article url) markdown link MUST appear in the box (bodyPart1 is the natural place); the deck renders these as clickable hyperlinks. Never print a bare URL and never invent a URL — only link to a source article URL you were given.
- onePager.bodyPart2 continues the message, includes a scannable list of ~5 concrete actions employees can take, and ENDS with a sign-off line (e.g. "Stay safe out there,") followed by the literal token {{ SIGNATURE }} on its own line. Never replace {{ SIGNATURE }}.
- chat.message = an emoji-opened scenario dropping the reader into a relatable moment, a question, A/B/C/D options (each ending with a reaction emoji, exactly one clearly-correct "pause / verify / ask security" answer), the call to action "Reply in this thread with your answer! 👇", and an italic "Hint:" line tying back to the news.

Return JSON only. No markdown fences or commentary.`,
  outlineUser: `Topic: {{topic}}

Ideation notes / source facts:
{{notes}}

Source articles:
{{articles}}

Past Mini Box examples from our archive (match voice, structure, and formatting closely):
{{archiveExamples}}

Write the COMPLETE Mini Box content as JSON with exactly this shape. Fill every field fully — no placeholders, no empty strings:
{
  "topic": "a concise box title — 2-5 words max (like 'Shadow AI', 'Fake CAPTCHA Pop-Ups', 'Update Before You Browse'), a short LABEL not a sentence, NEVER the long news headline",
  "angle": "one-sentence strategic hook for this box",
  "audience": "who this is for (usually: all employees)",
  "welcome": {
    "intro": "1-3 sentence admin-facing framing of why this topic matters now",
    "contents": "starts with 'In this topical mini box, you'll find:' then describes the one-pager and the chat message",
    "closing": "The Living Security Team"
  },
  "onePager": {
    "greeting": "Hi, Team! (or Hey, Team!)",
    "subjectLine": "emoji + Title Case headline",
    "bodyPart1": "opening hook + what happened, citing the primary source by name as a markdown link [Publication](real article URL) at least once",
    "callout": "a short highlighted takeaway or definition for the sidebar",
    "bodyPart2": "continuation + a scannable list of ~5 concrete actions, ending with a sign-off line and then {{ SIGNATURE }} on its own line"
  },
  "chat": {
    "message": "emoji-opened scenario + question + A/B/C/D options (each ending in an emoji, one clearly correct) + 'Reply in this thread with your answer! 👇' + an italic 'Hint:' line"
  },
  "gifPlan": {
    "welcome": "2-4 word visual search intent for a GIF matching the welcome mood",
    "onePager": "2-4 word visual search intent matching the one-pager hook or metaphor",
    "chat": "2-4 word visual search intent that literally depicts the chat scenario"
  }
}`,
  generateSystem: `You write Living Security Mini Box content: warm, plain-spoken, security-awareness focused, emoji-anchored, with concrete employee actions. Match the archive examples' voice and formatting. Keep {{ SIGNATURE }} unchanged in the email closing. Cite the primary source by name as a markdown link [Publication](real article URL) at least once — the deck renders these as clickable hyperlinks; never print a bare or invented URL. Return JSON only.`,
  generateFullUser: `Topic: {{topic}}

Ideation notes:
{{notes}}

Approved outline (use it as the source of truth — expand faithfully, keep the same structure and messages):
{{outline}}

Source articles:
{{articles}}

Past Mini Box examples (match voice and style):
{{archiveExamples}}

Return the complete Mini Box as JSON (fill every field fully):
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

/**
 * Structured outline — mirrors the Mini Box slide sections 1:1, so the approved
 * outline maps directly onto the deck. `topic`, `angle`, `audience`, and
 * `gifPlan` add strategic context and per-slide GIF search intents.
 */
export type MiniBoxOutline = {
  topic: string;
  angle: string;
  audience: string;
  welcome: { intro: string; contents: string; closing: string };
  onePager: {
    greeting: string;
    subjectLine: string;
    bodyPart1: string;
    callout: string;
    bodyPart2: string;
  };
  chat: { message: string };
  gifPlan: { welcome: string; onePager: string; chat: string };
};

/** True when the outline already carries structured slide content (new shape). */
export function isStructuredOutline(
  outline: MiniBoxOutline | string | null | undefined,
): outline is MiniBoxOutline {
  return Boolean(
    outline &&
      typeof outline === "object" &&
      "welcome" in outline &&
      "onePager" in outline &&
      "chat" in outline,
  );
}

export function outlineToContextText(
  outline: MiniBoxOutline | string | null | undefined,
) {
  if (!outline) return "(none)";
  if (typeof outline === "string") return outline.trim() || "(none)";
  return JSON.stringify(outline, null, 2);
}
