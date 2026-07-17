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
      type: "actions",
      block_id: `newbox_calendar_upload_${workflowId}`,
      elements: [
        {
          type: "button",
          action_id: `newbox_check_upload:${workflowId}`,
          text: { type: "plain_text", text: "Process my upload", emoji: true },
          style: "primary",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Waiting for calendar · workflow \`${workflowId.slice(0, 8)}…\` · or click *Process my upload* after attaching a photo_`,
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
  workflowId: string,
  monthLabel: string,
  ciabTopic: string | undefined,
  calendarTopics: string[],
) {
  const lines = [
    `*Main CIAB — ${monthLabel}*`,
    ciabTopic ? `Calendar CIAB topic: *${ciabTopic}*` : "_No CIAB topic on calendar for this month._",
  ];
  if (calendarTopics.length) {
    lines.push(`Related Mini Box themes: ${calendarTopics.join(", ")}`);
  }
  lines.push(
    "\nI'll research 3-4 fresh campaign focus options grounded in recent news, then walk through outline → full draft → review.",
  );
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    },
    {
      type: "actions",
      block_id: `ciab_start_${workflowId}`,
      elements: [
        {
          type: "button",
          action_id: `ciab_start:${workflowId}`,
          text: { type: "plain_text", text: "Research concept options →", emoji: true },
          style: "primary",
        },
      ],
    },
  ];
}

/** 3-4 stakeholder concept options with a Select button per option. */
export function ciabConceptBlocks(
  workflowId: string,
  concepts: import("@/lib/ciab-prompts").CiabConcept[],
  monthLabel?: string,
) {
  const header = monthLabel
    ? `*Main CIAB concept options — ${monthLabel}*\nShare with stakeholders, then pick one to build:`
    : "*Main CIAB concept options*\nPick one to build:";

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: header } },
  ];

  for (const c of concepts) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${c.id}. ${c.title}*${c.recommended ? " ⭐ _recommended_" : ""}`,
          c.subtitle ? `_${c.subtitle}_` : "",
          c.angle,
          c.whyFresh ? `*Why it's fresh:* ${c.whyFresh}` : "",
          c.weeklyFocus?.length ? `*Weekly focus:* ${c.weeklyFocus.join(" · ")}` : "",
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
          action_id: `select_concept:${workflowId}:${c.id}`,
          text: { type: "plain_text", text: `Build #${c.id}`, emoji: true },
          value: c.id,
          style: c.recommended ? "primary" : undefined,
        },
      ],
    });
    blocks.push({ type: "divider" });
  }

  return blocks;
}

/** Outline review with approve / regenerate buttons + a link to the Doc. */
export function ciabOutlineReviewBlocks(
  workflowId: string,
  outlineSections: Array<{ type: "section"; text: { type: "mrkdwn"; text: string } }>,
  docUrl?: string,
) {
  const blocks: unknown[] = [...outlineSections];
  if (docUrl) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📄 <${docUrl}|Open the outline in Google Docs to review & comment>` },
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: `approve_ciab_outline:${workflowId}`,
        text: { type: "plain_text", text: "Approve outline → draft full box", emoji: true },
        style: "primary",
      },
      {
        type: "button",
        action_id: `regenerate_ciab_outline:${workflowId}`,
        text: { type: "plain_text", text: "Regenerate outline", emoji: true },
      },
    ],
  });
  return blocks;
}

/** Final "full box drafted" message with the branded deck + reviewable Doc links. */
export function ciabBoxReadyBlocks(
  boxName: string,
  docUrl: string | undefined,
  previewSections: Array<{ type: "section"; text: { type: "mrkdwn"; text: string } }>,
  csmMentions?: string,
  deckUrl?: string,
) {
  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Full Main Box drafted:* ${boxName}` },
    },
    ...previewSections,
  ];
  if (deckUrl) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📊 <${deckUrl}|Main Box: CIAB to Review>` },
    });
  }
  if (docUrl) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📄 <${docUrl}|Outline: CIAB>` },
    });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: csmMentions
          ? `${csmMentions} — please review and reply in this thread with changes.`
          : "Review the Doc and reply in this thread with changes.",
      },
    ],
  });
  return blocks;
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

  const coverageMark = (c: (typeof candidates)[number]) =>
    c.priorCoverage === "duplicate"
      ? "⛔"
      : c.priorCoverage === "related"
        ? "↑"
        : "  ";

  const tableHeader = "```\n#  Prior Topic hook                     Align  Source\n";
  const tableRows = candidates
    .map((c) => {
      const hook = c.topicHook.slice(0, 32).padEnd(32);
      const align = (c.alignsWithCiab || "?").slice(0, 5).padEnd(5);
      const src = (c.sourceName || "?").slice(0, 18);
      return `${String(c.id).padEnd(2)} ${coverageMark(c)}   ${hook} ${align} ${src}`;
    })
    .join("\n");
  const tableFooter =
    "\n```\n_⛔ = repeats a Mini Box from the last 2 years (deprioritized) · ↑ = builds on a past topic (OK)_";

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
    const coverageLine =
      c.priorCoverage === "duplicate"
        ? `⛔ *Repeats a past Mini Box* (${c.priorCoverageRef ?? "last 2 years"})${c.priorCoverageNote ? ` — ${c.priorCoverageNote}` : ""}`
        : c.priorCoverage === "related"
          ? `↑ *Builds on* ${c.priorCoverageRef ?? "a past Mini Box"}${c.priorCoverageNote ? ` — ${c.priorCoverageNote}` : ""}`
          : null;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${c.id}. ${c.topicHook}*`,
          c.whatHappened,
          `*For employees:* ${c.endUserMeaning}`,
          `*CIAB:* ${c.alignsWithCiab} · *Source:* <${c.sourceLink}|${c.sourceName}>`,
          coverageLine,
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
          value: String(c.id),
        },
      ],
    });
  }

  return blocks;
}
