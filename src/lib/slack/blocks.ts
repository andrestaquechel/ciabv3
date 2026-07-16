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

export function outlineReviewBlocks(workflowId: string, outlineText: string) {
  return [
    ...mrkdwnSections(outlineText),
    {
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
    },
  ];
}

export function fullBoxReadyBlocks(
  topic: string,
  openUrl: string,
  welcomePreview: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Full Mini Box generated:* ${topic}\n\n*Welcome preview:*\n${welcomePreview}${welcomePreview.length >= 280 ? "…" : ""}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${openUrl}|Open in Box Studio>`,
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

export function finalDraftBlocks(topic: string, openUrl: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Final Mini Box:* ${topic}\nCSM feedback applied. Final PPTX attached above.\n<${openUrl}|Open in Box Studio to publish>`,
      },
    },
  ];
}
