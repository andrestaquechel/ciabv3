import type { TopicCandidate } from "@/lib/mini-box-topic-prompts";

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
    {
      type: "section",
      text: { type: "mrkdwn", text: outlineText },
    },
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
    {
      type: "section",
      text: { type: "mrkdwn", text: slidePreview },
    },
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
