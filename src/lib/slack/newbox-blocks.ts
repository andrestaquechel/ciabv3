import {
  buildMonthDropdownOptions,
  type AnnualCalendarsConfig,
} from "@/lib/annual-calendar-types";

export function newboxTypeBlocks(workflowId: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*New box wizard* — What are you creating?\n_Shortcuts: `/newbox mini-box july` · `/newbox ciab march`_",
      },
    },
    {
      type: "actions",
      block_id: `newbox_type_${workflowId}`,
      elements: [
        {
          type: "button",
          action_id: `newbox_type:${workflowId}:mini-box`,
          text: { type: "plain_text", text: "Mini Box", emoji: true },
          style: "primary",
        },
        {
          type: "button",
          action_id: `newbox_type:${workflowId}:ciab`,
          text: { type: "plain_text", text: "CIAB", emoji: true },
        },
      ],
    },
  ];
}

export function calendarUploadPromptBlocks(
  workflowId: string,
  boxType: "mini-box" | "ciab",
) {
  const label = boxType === "ciab" ? "CIAB" : "Mini Box";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${label}* — I don't have this year's *annual topic calendar* yet.`,
          "",
          "Please reply in this thread with either:",
          "• 📷 *Photo* — attach a screenshot or photo of the calendar (PNG, JPG, HEIC, etc.)",
          "• 📝 *List* — paste the month → topic list as text",
          "",
          "I'll read it, save it, and show the month picker with topics like *July - Emerging Threats*.",
        ].join("\n"),
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Waiting for calendar · workflow \`${workflowId.slice(0, 8)}…\`_`,
        },
      ],
    },
  ];
}

export function newboxMonthBlocks(
  workflowId: string,
  boxType: "mini-box" | "ciab",
  calendars?: AnnualCalendarsConfig,
  defaultMonth = new Date().getMonth() + 1,
  year = new Date().getFullYear(),
) {
  const label = boxType === "ciab" ? "CIAB" : "Mini Box";
  const options = buildMonthDropdownOptions(calendars, boxType, year);
  const defaultOption = options[defaultMonth - 1];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${label}* — Which month is this for? Each option shows the calendar topic.`,
      },
    },
    {
      type: "actions",
      block_id: `newbox_month_${workflowId}`,
      elements: [
        {
          type: "static_select",
          action_id: `newbox_month:${workflowId}`,
          placeholder: { type: "plain_text", text: "Select month" },
          initial_option: {
            text: { type: "plain_text", text: defaultOption.label },
            value: String(defaultMonth),
          },
          options: options.map((o) => ({
            text: { type: "plain_text", text: o.label },
            value: String(o.monthNumber),
          })),
        },
      ],
    },
  ];
}

export function ciabMonthReadyBlocks(
  monthLabel: string,
  ciabTopic: string | undefined,
  calendarTopics: string[],
) {
  const lines = [
    `*CIAB — ${monthLabel}*`,
    ciabTopic ? `Calendar CIAB topic: *${ciabTopic}*` : "_No CIAB topic on calendar for this month._",
  ];
  if (calendarTopics.length) {
    lines.push(`Related Mini Box themes: ${calendarTopics.join(", ")}`);
  }
  lines.push(
    "\n_Full CIAB generation from Slack is coming next. For now, open Box Studio to build the CIAB deck._",
  );
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    },
  ];
}

export function topicCandidatesTableBlocks(
  workflowId: string,
  candidates: import("@/lib/mini-box-topic-prompts").TopicCandidate[],
  monthlyCiabTopic?: string,
  monthLabel?: string,
) {
  const headerParts = ["*6 Mini Box topic candidates*"];
  if (monthLabel) headerParts.push(`(${monthLabel})`);
  if (monthlyCiabTopic) headerParts.push(`— CIAB theme: *${monthlyCiabTopic}*`);

  const tableHeader = "```\n#  Topic hook                         Align  Source\n";
  const tableRows = candidates
    .map((c) => {
      const hook = c.topicHook.slice(0, 34).padEnd(34);
      const align = (c.alignsWithCiab || "?").slice(0, 5).padEnd(5);
      const src = (c.sourceName || "?").slice(0, 18);
      return `${String(c.id).padEnd(2)} ${hook} ${align} ${src}`;
    })
    .join("\n");
  const tableFooter = "\n```";

  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${headerParts.join(" ")}\nPick one to start the workflow:${tableHeader}${tableRows}${tableFooter}`,
      },
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
          `*CIAB:* ${c.alignsWithCiab} · *Source:* <${c.sourceLink}|${c.sourceName}>`,
        ].join("\n"),
      },
    });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: `select_topic:${workflowId}:${c.id}`,
          text: { type: "plain_text", text: `Select #${c.id}`, emoji: true },
          value: String(c.id),
        },
      ],
    });
  }

  return blocks;
}
