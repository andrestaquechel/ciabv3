import { randomUUID } from "crypto";
import { parseAnnualCalendarImage } from "@/lib/annual-calendar-ocr";
import {
  currentMonthCiabTopic,
  formatCalendarSummary,
} from "@/lib/annual-calendar-types";
import { pickMiniBoxGifs } from "@/lib/giphy-search";
import { generateFullMiniBox, generateOutline } from "@/lib/mini-box-generate";
import { generateTopicCandidates } from "@/lib/mini-box-topic-research";
import type { TopicCandidate } from "@/lib/mini-box-topic-prompts";
import {
  loadSlackWorkflowFromDrive,
  registerSlackWorkflowThread,
  saveAnnualCalendarToDrive,
  saveGeneratedDraftToDrive,
  saveSlackWorkflowToDrive,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import { imageMediaType, slackDownloadFile, slackPostMessage } from "@/lib/slack/api";
import {
  calendarParsedBlocks,
  formatOutlineSlack,
  fullBoxReadyBlocks,
  outlineReviewBlocks,
  topicCandidatesBlocks,
} from "@/lib/slack/blocks";
import { topicCandidatesTableBlocks } from "@/lib/slack/newbox-blocks";
import {
  handleNewboxMonthSelect,
  handleNewboxTypeSelect,
} from "@/lib/slack/newbox-handlers";
import { startCsmReview } from "@/lib/slack/csm-review";
import { applyCsmFeedbackAndFinalize } from "@/lib/slack/morgan-review";
import {
  findSlackWorkflowIdByThread,
  loadAppSettingsFromDrive,
} from "@/lib/box-studio-drive-data";
import { monthCiabTopic, MONTH_LABELS } from "@/lib/annual-calendar-types";
import { resolveSlackReview } from "@/lib/slack/review-settings";

type SlackFile = { id: string; mimetype?: string; filetype?: string };
type SlackEvent = {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel: string;
    ts: string;
    thread_ts?: string;
    files?: SlackFile[];
    subtype?: string;
  };
};

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://ciabv2-gilt.vercel.app";
}

function topicNotes(candidate: TopicCandidate) {
  return [
    candidate.whatHappened,
    candidate.endUserMeaning,
    `Source: ${candidate.sourceName} ${candidate.sourceLink}`,
    candidate.secondarySourceLink
      ? `Alt: ${candidate.secondarySourceName || ""} ${candidate.secondarySourceLink}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function isTopicResearchCommand(text: string): boolean {
  const t = text.toLowerCase().replace(/<@[^>]+>/g, "").trim();
  return (
    /\b(topics?|topic ideas|suggest topics|mini box topics?|research topics?)\b/.test(t) ||
    t === "topics" ||
    t.endsWith(" topics")
  );
}

export function isCalendarCommand(text: string): boolean {
  const t = text.toLowerCase().replace(/<@[^>]+>/g, "").trim();
  return /\b(calendar|annual calendar|topic calendar|upload calendar)\b/.test(t);
}

export async function handleSlackEventPayload(payload: SlackEvent) {
  if (payload.type === "url_verification") return;

  const event = payload.event;
  if (!event) return;
  if (event.subtype && event.subtype !== "file_share") return;

  const channel = event.channel;
  const threadTs = event.thread_ts || event.ts;
  const text = event.text || "";

  const imageFile = event.files?.find((f) =>
    (f.mimetype || "").startsWith("image/"),
  );

  if (imageFile) {
    await handleCalendarImage({
      channel,
      threadTs,
      fileId: imageFile.id,
      userId: event.user,
    });
    return;
  }

  if (event.type === "app_mention" || event.type === "message") {
    const isDm = event.channel.startsWith("D");
    const inThread = Boolean(event.thread_ts);

    if (inThread && event.thread_ts && text.trim()) {
      await handleThreadReply({
        channel,
        threadTs: event.thread_ts,
        text,
        userId: event.user,
      });
      if (!isDm && event.type === "message") return;
    }

    if (event.type === "message" && !isDm && !inThread) return;

    if (isTopicResearchCommand(text)) {
      await runTopicResearch({ channel, threadTs, userId: event.user });
      return;
    }
    if (isCalendarCommand(text)) {
      await slackPostMessage({
        channel,
        threadTs,
        text: "Upload a photo of this year's topic calendar in this channel (attach to a message and @mention the bot).",
      });
    }
  }
}

export async function handleCalendarImage({
  channel,
  threadTs,
  fileId,
  userId,
}: {
  channel: string;
  threadTs: string;
  fileId: string;
  userId?: string;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: "Reading your topic calendar…",
  });

  const file = await slackDownloadFile(fileId);
  if (!file.mimeType.startsWith("image/")) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Please upload an image (PNG, JPG, or screenshot) of the annual topic calendar.",
    });
    return;
  }

  const calendar = await parseAnnualCalendarImage({
    imageBase64: file.buffer.toString("base64"),
    mediaType: imageMediaType(file.mimeType),
    source: "slack",
    sourceFileName: file.name,
  });

  await saveAnnualCalendarToDrive(calendar);
  const ciab = currentMonthCiabTopic({ [String(calendar.year)]: calendar });
  const summary = formatCalendarSummary(calendar);

  await slackPostMessage({
    channel,
    threadTs,
    text: `${calendar.year} topic calendar saved.`,
    blocks: calendarParsedBlocks(calendar.year, summary, ciab),
  });

  void userId;
}

export async function runTopicResearch({
  channel,
  threadTs,
  userId,
}: {
  channel: string;
  threadTs: string;
  userId?: string;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: "Researching 6 Mini Box topic candidates from recent news (this may take a minute)…",
  });

  const result = await generateTopicCandidates();
  const workflowId = randomUUID();
  const now = new Date().toISOString();

  const workflow: SlackWorkflowRecord = {
    id: workflowId,
    boxType: "mini-box",
    status: "topic_selection",
    slackChannel: channel,
    slackThreadTs: threadTs,
    topicCandidates: result.candidates,
    monthlyCiabTopic: result.monthlyCiabTopic,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  try {
    await saveSlackWorkflowToDrive(workflow);
    await registerSlackWorkflowThread(channel, threadTs, workflowId);
  } catch {
    // continue if Drive unavailable
  }

  await slackPostMessage({
    channel,
    threadTs,
    text: "Mini Box topic candidates ready.",
    blocks: topicCandidatesBlocks(
      workflowId,
      result.candidates,
      result.monthlyCiabTopic,
    ),
  });

  if (result.note) {
    await slackPostMessage({ channel, threadTs, text: result.note });
  }
}

export async function runTopicResearchForMonth({
  channel,
  threadTs,
  userId,
  workflowId: existingWorkflowId,
  monthNumber,
  monthLabel,
  year = new Date().getFullYear(),
}: {
  channel: string;
  threadTs?: string;
  userId?: string;
  workflowId?: string;
  monthNumber: number;
  monthLabel: string;
  year?: number;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: `Researching 6 Mini Box topics for *${monthLabel}* (this may take a minute)…`,
  });

  let monthlyCiabTopic: string | undefined;
  try {
    const settings = await loadAppSettingsFromDrive();
    monthlyCiabTopic = monthCiabTopic(settings?.annualCalendars, monthNumber, year);
  } catch {
    monthlyCiabTopic = undefined;
  }

  const result = await generateTopicCandidates({ monthlyCiabTopic });
  const workflowId = existingWorkflowId || randomUUID();
  const now = new Date().toISOString();

  const workflow: SlackWorkflowRecord = {
    id: workflowId,
    boxType: "mini-box",
    status: "topic_selection",
    slackChannel: channel,
    slackThreadTs: threadTs,
    topicCandidates: result.candidates,
    monthlyCiabTopic: result.monthlyCiabTopic || monthlyCiabTopic,
    targetMonth: monthNumber,
    targetMonthLabel: monthLabel,
    targetYear: year,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  try {
    await saveSlackWorkflowToDrive(workflow);
    if (threadTs) await registerSlackWorkflowThread(channel, threadTs, workflowId);
  } catch {
    // continue if Drive unavailable
  }

  await slackPostMessage({
    channel,
    threadTs,
    text: `Mini Box topics for ${monthLabel} ready.`,
    blocks: topicCandidatesTableBlocks(
      workflowId,
      result.candidates,
      workflow.monthlyCiabTopic,
      monthLabel,
    ),
  });

  if (result.note) {
    await slackPostMessage({ channel, threadTs, text: result.note });
  }
}

async function persistWorkflow(workflow: SlackWorkflowRecord) {
  workflow.updatedAt = new Date().toISOString();
  try {
    await saveSlackWorkflowToDrive(workflow);
  } catch {
    // non-fatal
  }
}

export async function generateAndPostOutline({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
}) {
  const candidate = workflow.selectedTopic;
  if (!candidate) throw new Error("No topic selected.");

  await slackPostMessage({
    channel,
    threadTs,
    text: `Generating outline for *${candidate.topicHook}*…`,
  });

  const topic = candidate.topicHook;
  const outlineResult = await generateOutline({
    topic,
    notes: topicNotes(candidate),
  });

  workflow.outline = outlineResult.outline;
  workflow.status = "outline";
  await persistWorkflow(workflow);

  const outlineText = formatOutlineSlack(topic, outlineResult.outline);
  await slackPostMessage({
    channel,
    threadTs,
    text: "Outline ready for review.",
    blocks: outlineReviewBlocks(workflow.id, outlineText),
  });
}

export async function generateAndPostFullBox({
  workflow,
  channel,
  threadTs,
  userId,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
  userId?: string;
}) {
  const candidate = workflow.selectedTopic;
  if (!candidate || !workflow.outline) {
    throw new Error("Missing topic or outline.");
  }

  const topic = candidate.topicHook;
  await slackPostMessage({
    channel,
    threadTs,
    text: `Generating full Mini Box for *${topic}* (content + GIFs)…`,
  });

  const full = await generateFullMiniBox({
    topic,
    notes: topicNotes(candidate),
    outline: workflow.outline,
  });

  const gifs = await pickMiniBoxGifs(topic);
  const draftId = randomUUID();

  try {
    await saveGeneratedDraftToDrive({
      id: draftId,
      topic,
      createdAt: new Date().toISOString(),
      createdBy: userId || workflow.createdBy,
      source: full.source,
      outline: workflow.outline,
      sections: full.sections,
      gifs,
    });
    workflow.draftId = draftId;
  } catch {
    workflow.draftId = undefined;
  }

  workflow.status = "full_draft";
  await persistWorkflow(workflow);

  const openUrl = workflow.draftId
    ? `${appBaseUrl()}/builder/new?draft=${workflow.draftId}`
    : `${appBaseUrl()}/builder/new?topic=${encodeURIComponent(topic)}&autoGenerate=1`;

  const welcomePreview = full.sections.welcome.intro.slice(0, 280);
  await slackPostMessage({
    channel,
    threadTs,
    text: `Full Mini Box ready: ${topic}`,
    blocks: fullBoxReadyBlocks(topic, openUrl, welcomePreview),
  });

  if (full.note) {
    await slackPostMessage({ channel, threadTs, text: full.note });
  }

  await startCsmReview({ workflow, channel, threadTs });
}

export async function handleTopicSelection({
  workflowId,
  candidateId,
  channel,
  threadTs,
  userId,
}: {
  workflowId: string;
  candidateId: string;
  channel: string;
  threadTs?: string;
  userId?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  const candidate = workflow?.topicCandidates?.find((c) => c.id === candidateId);

  if (!workflow || !candidate) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Could not find topic #${candidateId}. Run @bot topics again.`,
    });
    return;
  }

  workflow.selectedTopic = candidate;
  workflow.status = "outline";
  await persistWorkflow(workflow);

  await slackPostMessage({
    channel,
    threadTs,
    text: `Selected *${candidate.topicHook}* — generating outline…`,
  });

  await generateAndPostOutline({ workflow, channel, threadTs });
  void userId;
}

export async function handleOutlineApproval({
  workflowId,
  channel,
  threadTs,
  userId,
}: {
  workflowId: string;
  channel: string;
  threadTs?: string;
  userId?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow?.outline) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Outline not found. Select a topic again.",
    });
    return;
  }

  await generateAndPostFullBox({ workflow, channel, threadTs, userId });
}

export async function handleOutlineRegenerate({
  workflowId,
  channel,
  threadTs,
}: {
  workflowId: string;
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow?.selectedTopic) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Workflow not found. Start with @bot topics.",
    });
    return;
  }

  await generateAndPostOutline({ workflow, channel, threadTs });
}

export async function handleApplyCsmFeedback({
  workflowId,
  channel,
  threadTs,
}: {
  workflowId: string;
  channel: string;
  threadTs: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Workflow not found.",
    });
    return;
  }

  try {
    await applyCsmFeedbackAndFinalize({ workflow, channel, threadTs });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Failed to apply feedback: ${err instanceof Error ? err.message : "unknown error"}`,
    });
  }
}

export async function handleThreadReply({
  channel,
  threadTs,
  text,
  userId,
}: {
  channel: string;
  threadTs: string;
  text: string;
  userId?: string;
}) {
  const normalized = text.toLowerCase().replace(/<@[^>]+>/g, "").trim();
  const isApplyCommand =
    /\b(apply csm|apply feedback|make those csm|make those changes|finalize)\b/.test(
      normalized,
    );
  if (!isApplyCommand) return;

  const workflowId = await findSlackWorkflowIdByThread(channel, threadTs);
  if (!workflowId) return;

  const settings = await loadAppSettingsFromDrive();
  const { morganUserId: morganId } = resolveSlackReview(settings?.slackReview);
  if (morganId && userId && userId !== morganId) return;

  await handleApplyCsmFeedback({ workflowId, channel, threadTs });
}

export async function handleBlockActions(payload: {
  actions?: Array<{
    action_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  channel?: { id: string };
  message?: { ts: string; thread_ts?: string };
  user?: { id: string };
}) {
  const action = payload.actions?.[0];
  if (!action?.action_id) return;

  const channel = payload.channel?.id;
  if (!channel) return;

  const threadTs = payload.message?.thread_ts || payload.message?.ts;
  const userId = payload.user?.id;

  if (action.action_id.startsWith("newbox_type:")) {
    const [, workflowId, boxType] = action.action_id.split(":");
    if (!workflowId || (boxType !== "mini-box" && boxType !== "ciab")) return;
    await handleNewboxTypeSelect({
      workflowId,
      boxType,
      channel,
      threadTs,
    });
    return;
  }

  if (action.action_id.startsWith("newbox_month:")) {
    const workflowId = action.action_id.split(":")[1];
    const monthValue = action.selected_option?.value || action.value;
    const monthNumber = Number(monthValue);
    if (!workflowId || !monthNumber || monthNumber < 1 || monthNumber > 12) return;
    await handleNewboxMonthSelect({
      workflowId,
      monthNumber,
      monthLabel: MONTH_LABELS[monthNumber - 1],
      year: new Date().getFullYear(),
      channel,
      threadTs,
      userId,
    });
    return;
  }

  if (action.action_id.startsWith("select_topic:")) {
    const [, workflowId, candidateId] = action.action_id.split(":");
    if (!workflowId || !candidateId) return;
    await handleTopicSelection({
      workflowId,
      candidateId,
      channel,
      threadTs,
      userId,
    });
    return;
  }

  if (action.action_id.startsWith("approve_outline:")) {
    const workflowId = action.action_id.split(":")[1];
    if (!workflowId) return;
    await handleOutlineApproval({ workflowId, channel, threadTs, userId });
    return;
  }

  if (action.action_id.startsWith("regenerate_outline:")) {
    const workflowId = action.action_id.split(":")[1];
    if (!workflowId) return;
    await handleOutlineRegenerate({ workflowId, channel, threadTs });
    return;
  }

  if (action.action_id.startsWith("apply_csm_feedback:")) {
    const workflowId = action.action_id.split(":")[1];
    if (!workflowId || !threadTs) return;
    await handleApplyCsmFeedback({ workflowId, channel, threadTs });
  }
}
