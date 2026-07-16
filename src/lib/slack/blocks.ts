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

export function formatOutlineSlack(
  topic: string,
  outline: import("@/lib/mini-box-prompts").MiniBoxOutline,
) {
  return [
    `*Mini Box outline:* ${topic}`,
    `*Angle:* ${outline.angle}`,
    `*Audience:* ${outline.audience}`,
    `*Key messages:*`,
    ...outline.keyMessages.map((m) => `• ${m}`),
    `*Welcome focus:* ${outline.welcomeFocus}`,
    `*One-pager hook:* ${outline.onePagerHook}`,
    `*One-pager structure:* ${outline.onePagerStructure}`,
    `*Chat scenario:* ${outline.chatScenario}`,
    `*Habit to reinforce:* ${outline.habitToReinforce}`,
  ].join("\n");
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
) {
  const header = csmMentions
    ? `${csmMentions}\n\nPlease review this Mini Box draft. Reply in this thread with changes.`
    : "Please review this Mini Box draft. Reply in this thread with changes.";

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: header },
    },
    ...mrkdwnSections(slidePreview),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "PowerPoint attached below ↑ — Morgan can click *Apply CSM feedback* when ready.",
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
  ];
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
