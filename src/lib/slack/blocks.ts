import type { TopicCandidate } from "@/lib/mini-box-topic-prompts";

/** Slack rejects any section whose text exceeds 3000 chars with invalid_blocks.
 *  Stay safely under that. */
const SLACK_SECTION_LIMIT = 2900;

/**
 * Split long mrkdwn text into multiple section blocks that each stay under
 * Slack's 3000-char-per-section limit. Splits on line boundaries and
 * hard-splits any single line that is itself too long, so a long outline or
 * slide preview posts as several blocks instead of failing the whole message.
 */
export function mrkdwnSections(
  text: string,
): Array<{ type: "section"; text: { type: "mrkdwn"; text: string } }> {
  const safe = (text || "").trim();
  const chunks: string[] = [];
  let current = "";

  for (const line of safe.split("\n")) {
    if (line.length > SLACK_SECTION_LIMIT) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += SLACK_SECTION_LIMIT) {
        chunks.push(line.slice(i, i + SLACK_SECTION_LIMIT));
      }
      continue;
    }
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > SLACK_SECTION_LIMIT) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  if (!chunks.length) chunks.push("(empty)");

  return chunks.map((c) => ({
    type: "section" as const,
    text: { type: "mrkdwn" as const, text: c },
  }));
}

export function topicCandidatesBlocks(
  workflowId: string,
  candidates: TopicCandidate[],
  monthlyCiabTopic?: string,
) {
  const header = monthlyCiabTopic
    ? `*6 Mini Box topic candidates* (CIAB this month: *${monthlyCiabTopic}*)\nPick one to start the workflow:`
    : "*6 Mini Box topic candidates*\nPick one to start the workflow:";

  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: header },
    },
  ];

  for (const c of candidates) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${c.id}. ${c.topicHook}*`,
          c.whatHappened,
          `*For employees:* ${c.endUserMeaning}`,
          `*CIAB align:* ${c.alignsWithCiab} · *Source:* <${c.sourceLink}|${c.sourceName}> (${c.sourceType}) — ${c.sourceQuality}`,
          c.secondarySourceLink
            ? `*Alt source:* <${c.secondarySourceLink}|${c.secondarySourceName || "link"}>`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: `select_topic:${workflowId}:${c.id}`,
          text: { type: "plain_text", text: `Select #${c.id}`, emoji: true },
          value: c.id,
        },
      ],
    });
    blocks.push({ type: "divider" });
  }

  return blocks;
}

export function calendarParsedBlocks(
  year: number,
  summary: string,
  monthlyCiabTopic?: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${year} topic calendar saved* ✅\n${monthlyCiabTopic ? `This month's CIAB topic: *${monthlyCiabTopic}*\n` : ""}\n${summary}`,
      },
    },
  ];
}

/**
 * Render the structured outline (the actual slide content, shown 1:1 for
 * review). Falls back to a plain string, and to the legacy strategic-brief
 * shape for outlines saved before the 1:1 change.
 */
export function formatOutlineSlack(
  topic: string,
  outline: import("@/lib/mini-box-prompts").MiniBoxOutline | string,
) {
  if (typeof outline === "string") return outline;

  if (outline && typeof outline === "object" && "welcome" in outline && outline.welcome) {
    const o = outline;
    return [
      `*Mini Box outline — ${o.topic || topic}*`,
      o.angle ? `_${o.angle}_` : "",
      "",
      "*Welcome (for Program Owners)*",
      o.welcome?.intro || "",
      o.welcome?.contents || "",
      o.welcome?.closing || "",
      "",
      "*One-Pager / Email*",
      o.onePager?.subjectLine ? `*Subject:* ${o.onePager.subjectLine}` : "",
      o.onePager?.greeting || "",
      o.onePager?.bodyPart1 || "",
      o.onePager?.callout ? `*Callout:* ${o.onePager.callout}` : "",
      o.onePager?.bodyPart2 || "",
      "",
      "*Chat Message*",
      o.chat?.message || "",
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  // Legacy strategic-brief outline (pre-1:1) — best-effort render.
  const legacy = outline as unknown as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return [
    `*Mini Box outline:* ${topic}`,
    s(legacy.angle) ? `*Angle:* ${s(legacy.angle)}` : "",
    s(legacy.audience) ? `*Audience:* ${s(legacy.audience)}` : "",
    ...(list(legacy.keyMessages).length
      ? ["*Key messages:*", ...list(legacy.keyMessages).map((m) => `• ${m}`)]
      : []),
    s(legacy.welcomeFocus) ? `*Welcome focus:* ${s(legacy.welcomeFocus)}` : "",
    s(legacy.onePagerHook) ? `*One-pager hook:* ${s(legacy.onePagerHook)}` : "",
    s(legacy.onePagerStructure) ? `*One-pager structure:* ${s(legacy.onePagerStructure)}` : "",
    s(legacy.chatScenario) ? `*Chat scenario:* ${s(legacy.chatScenario)}` : "",
    s(legacy.habitToReinforce) ? `*Habit to reinforce:* ${s(legacy.habitToReinforce)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** One-paragraph summary of the outline for the Slack thread. The full outline
 *  lives in the linked "Mini Box Outline" doc. */
export function outlineSummarySlack(
  topic: string,
  outline: import("@/lib/mini-box-prompts").MiniBoxOutline | string,
): string {
  const firstSentences = (text: string, n = 2): string => {
    const parts = text.trim().replace(/\s+/g, " ").match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [];
    return parts.slice(0, n).join(" ").trim();
  };
  if (typeof outline === "object" && outline && "welcome" in outline && outline.welcome) {
    const summary = outline.angle?.trim() || firstSentences(outline.welcome.intro || "");
    return `*Mini Box outline — ${outline.topic || topic}*\n\n${summary}`;
  }
  const text = typeof outline === "string" ? outline : "";
  const summary = firstSentences(text) || "Outline ready.";
  return `*Mini Box outline — ${topic}*\n\n${summary}`;
}

/** Full outline rendered as HTML for the "Mini Box Outline" Google Doc. */
export function outlineToHtml(
  topic: string,
  outline: import("@/lib/mini-box-prompts").MiniBoxOutline | string,
): string {
  const esc = (v: unknown): string =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const p = (v: unknown): string => (String(v ?? "").trim() ? `<p>${esc(v)}</p>` : "");

  if (typeof outline === "object" && outline && "welcome" in outline && outline.welcome) {
    const o = outline;
    return [
      `<h1>Mini Box Outline — ${esc(o.topic || topic)}</h1>`,
      o.angle ? `<p><em>${esc(o.angle)}</em></p>` : "",
      `<h2>Welcome (for Program Owners)</h2>`,
      p(o.welcome?.intro),
      p(o.welcome?.contents),
      p(o.welcome?.closing),
      `<h2>One-Pager / Email</h2>`,
      o.onePager?.subjectLine ? `<p><strong>Subject:</strong> ${esc(o.onePager.subjectLine)}</p>` : "",
      p(o.onePager?.greeting),
      p(o.onePager?.bodyPart1),
      o.onePager?.callout ? `<p><strong>Callout:</strong> ${esc(o.onePager.callout)}</p>` : "",
      p(o.onePager?.bodyPart2),
      `<h2>Chat Message</h2>`,
      p(o.chat?.message),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `<h1>Mini Box Outline — ${esc(topic)}</h1><pre>${esc(outline)}</pre>`;
}

export function outlineReviewBlocks(
  workflowId: string,
  summaryText: string,
  docLink?: string,
) {
  const blocks: unknown[] = [...mrkdwnSections(summaryText)];
  if (docLink) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📄 <${docLink}|Mini Box Outline> — full outline` },
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: `approve_outline:${workflowId}`,
        text: { type: "plain_text", text: "Approve outline → generate full box", emoji: true },
        style: "primary",
      },
      {
        type: "button",
        action_id: `regenerate_outline:${workflowId}`,
        text: { type: "plain_text", text: "Regenerate outline", emoji: true },
      },
    ],
  });
  return blocks;
}

export function fullBoxReadyBlocks(topic: string, welcomePreview: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Full Mini Box generated:* ${topic}\n\n*Welcome preview:*\n${welcomePreview}${welcomePreview.length >= 280 ? "…" : ""}`,
      },
    },
  ];
}

export function csmReviewBlocks(
  workflowId: string,
  slidePreview: string,
  csmMentions: string,
  slidesLink?: string,
) {
  const header = csmMentions
    ? `${csmMentions}\n\nPlease review this Mini Box draft. Reply in this thread with changes.`
    : "Please review this Mini Box draft. Reply in this thread with changes.";

  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: header },
    },
    ...mrkdwnSections(slidePreview),
  ];

  if (slidesLink) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📊 <${slidesLink}|Open the Google Slides deck to review & comment>`,
      },
    });
  }

  blocks.push(
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: slidesLink
            ? "Comment directly on the Slides deck above — Morgan can click *Apply CSM feedback* when ready."
            : "Morgan can click *Apply CSM feedback* when ready.",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: `apply_csm_feedback:${workflowId}`,
          text: { type: "plain_text", text: "Apply CSM feedback → final draft", emoji: true },
          style: "primary",
        },
      ],
    },
  );

  return blocks;
}

export function finalDraftBlocks(topic: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Final Mini Box:* ${topic}\nCSM feedback applied. Final PPTX attached above.`,
      },
    },
  ];
}
