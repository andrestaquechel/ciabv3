import { randomUUID } from "crypto";
import {
  hasAnnualCalendarTopics,
  monthCalendarLabel,
  monthCiabTopic,
  monthMiniBoxTopics,
  parseMonthInput,
  formatCalendarSummary,
  currentMonthCiabTopic,
  type AnnualCalendarsConfig,
} from "@/lib/annual-calendar-types";
import {
  loadAppSettingsFromDrive,
  registerSlackWorkflowThread,
  saveSlackWorkflowToDrive,
  loadSlackWorkflowFromDrive,
  findSlackWorkflowIdByThread,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import {
  loadAnnualCalendarsConfig,
  saveAnnualCalendar,
} from "@/lib/db/annual-calendars";
import {
  parseAnnualCalendarImage,
  parseAnnualCalendarText,
} from "@/lib/annual-calendar-ocr";
import { imageMediaType, isSlackImageMime, slackDownloadFile, slackPostMessage } from "@/lib/slack/api";
import { calendarParsedBlocks } from "@/lib/slack/blocks";
import {
  calendarUploadPromptBlocks,
  ciabMonthReadyBlocks,
  newboxMonthBlocks,
  newboxTypeBlocks,
} from "@/lib/slack/newbox-blocks";

export type NewboxWizardResponse = {
  workflowId: string;
  text: string;
  blocks: unknown[];
  /** When true, topic research runs async in channel */
  async?: boolean;
};

async function persistNewWorkflow(
  workflow: SlackWorkflowRecord,
  channel: string,
  threadTs?: string,
) {
  try {
    await saveSlackWorkflowToDrive(workflow);
    if (threadTs) await registerSlackWorkflowThread(channel, threadTs, workflow.id);
  } catch {
    // continue — buttons may fail without Drive
  }
}

async function loadAnnualCalendars() {
  try {
    return await loadAnnualCalendarsConfig();
  } catch {
    return undefined;
  }
}

async function promptCalendarUpload({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
}) {
  workflow.status = "awaiting_calendar";
  await persist(workflow);
  if (threadTs) {
    await registerSlackWorkflowThread(channel, threadTs, workflow.id);
  }
  await slackPostMessage({
    channel,
    threadTs,
    text: "Annual topic calendar needed — upload a photo or paste the list in this thread.",
    blocks: calendarUploadPromptBlocks(workflow.id, workflow.boxType),
  });
}

async function showMonthPicker({
  workflowId,
  boxType,
  channel,
  threadTs,
  calendars,
  year = new Date().getFullYear(),
}: {
  workflowId: string;
  boxType: "mini-box" | "ciab";
  channel: string;
  threadTs?: string;
  calendars?: AnnualCalendarsConfig;
  year?: number;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: `${boxType === "ciab" ? "CIAB" : "Mini Box"} — pick a month`,
    blocks: newboxMonthBlocks(workflowId, boxType, calendars, undefined, year),
  });
}

export async function resumeNewboxAfterCalendar({
  channel,
  threadTs,
  calendar,
}: {
  channel: string;
  threadTs: string;
  calendar: import("@/lib/annual-calendar-types").ParsedAnnualCalendar;
}) {
  await saveAnnualCalendar(calendar);

  const workflowId = await findSlackWorkflowIdByThread(channel, threadTs);
  if (!workflowId) {
    const summary = formatCalendarSummary(calendar);
    const ciab = currentMonthCiabTopic({ [String(calendar.year)]: calendar });
    await slackPostMessage({
      channel,
      threadTs,
      text: `${calendar.year} topic calendar saved.`,
      blocks: calendarParsedBlocks(calendar.year, summary, ciab),
    });
    return;
  }

  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow || workflow.status !== "awaiting_calendar") {
    const summary = formatCalendarSummary(calendar);
    await slackPostMessage({
      channel,
      threadTs,
      text: `${calendar.year} topic calendar saved.`,
      blocks: calendarParsedBlocks(calendar.year, summary),
    });
    return;
  }

  workflow.status = "newbox_setup";
  workflow.targetYear = calendar.year;
  await persist(workflow);

  const calendars: AnnualCalendarsConfig = {
    [String(calendar.year)]: calendar,
  };
  const summary = formatCalendarSummary(calendar);
  const monthBlocks = newboxMonthBlocks(
    workflowId,
    workflow.boxType,
    calendars,
    undefined,
    calendar.year,
  );

  await slackPostMessage({
    channel,
    threadTs,
    text: `${calendar.year} calendar saved — pick a month.`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${calendar.year} topic calendar saved* ✅\n${summary.slice(0, 1200)}`,
        },
      },
      ...monthBlocks.slice(1),
    ],
  });
}

export async function handleNewboxCalendarImage({
  channel,
  threadTs,
  fileId,
  workflow,
}: {
  channel: string;
  threadTs: string;
  fileId: string;
  workflow: SlackWorkflowRecord;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: "Reading your topic calendar photo…",
  });

  const file = await slackDownloadFile(fileId);
  if (!isSlackImageMime(file.mimeType)) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Please upload an *image* (PNG, JPG, screenshot, etc.) or paste the month/topic list as text in this thread.",
    });
    return;
  }

  try {
    const calendar = await parseAnnualCalendarImage({
      imageBase64: file.buffer.toString("base64"),
      mediaType: imageMediaType(file.mimeType),
      source: "slack",
      sourceFileName: file.name,
    });
    await resumeNewboxAfterCalendar({ channel, threadTs, calendar });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Could not read that calendar: ${err instanceof Error ? err.message : "OCR failed"}. Try a clearer photo or paste the list as text.`,
    });
  }

  void workflow;
}

export async function handleNewboxCalendarText({
  channel,
  threadTs,
  text,
}: {
  channel: string;
  threadTs: string;
  text: string;
}) {
  await slackPostMessage({
    channel,
    threadTs,
    text: "Parsing your topic calendar list…",
  });

  try {
    const calendar = await parseAnnualCalendarText(text, "slack");
    await resumeNewboxAfterCalendar({ channel, threadTs, calendar });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Could not parse that list: ${err instanceof Error ? err.message : "parse failed"}. Try a photo or format like \`January - Phishing\`.`,
    });
  }
}

/** Build slash-command response with interactive blocks (buttons / month dropdown). */
export async function buildNewboxWizardResponse({
  channel,
  threadTs,
  userId,
  parsed,
}: {
  channel: string;
  threadTs?: string;
  userId?: string;
  parsed?: {
    boxType?: "mini-box" | "ciab";
    month?: string;
  };
}): Promise<NewboxWizardResponse> {
  const workflowId = randomUUID();
  const year = new Date().getFullYear();
  const workflow: SlackWorkflowRecord = {
    id: workflowId,
    boxType: parsed?.boxType || "mini-box",
    status: "newbox_setup",
    slackChannel: channel,
    slackThreadTs: threadTs,
    targetYear: year,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };

  await persistNewWorkflow(workflow, channel, threadTs);

  if (parsed?.boxType && parsed?.month) {
    const month = parseMonthInput(parsed.month, year);
    if (month) {
      if (parsed.boxType === "mini-box") {
        void runTopicResearchAsync({
          channel,
          threadTs,
          userId,
          workflowId,
          monthNumber: month.monthNumber,
          monthLabel: month.monthLabel,
          year: month.year,
        });
        return {
          workflowId,
          async: true,
          text: `Researching Mini Box topics for *${month.monthLabel}*…`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Researching 6 Mini Box topics for *${month.monthLabel}* — I'll post the table here in about a minute.`,
              },
            },
          ],
        };
      }
      void handleNewboxMonthSelect({
        workflowId,
        monthNumber: month.monthNumber,
        monthLabel: month.monthLabel,
        year: month.year,
        channel,
        threadTs,
        userId,
        boxType: "ciab",
      });
      return {
        workflowId,
        async: true,
        text: `Loading CIAB topic for *${month.monthLabel}*…`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Loading *${month.monthLabel}* CIAB calendar topic…`,
            },
          },
        ],
      };
    }
  }

  if (parsed?.boxType) {
    const calendars = await loadAnnualCalendars();
    if (!hasAnnualCalendarTopics(calendars, year, parsed.boxType)) {
      workflow.status = "awaiting_calendar";
      await persistNewWorkflow(workflow, channel, threadTs);
      return {
        workflowId,
        text: "Annual topic calendar needed",
        blocks: calendarUploadPromptBlocks(workflowId, parsed.boxType),
      };
    }
    return {
      workflowId,
      text: `New ${parsed.boxType === "ciab" ? "CIAB" : "Mini Box"} — select month`,
      blocks: newboxMonthBlocks(workflowId, parsed.boxType, calendars, undefined, year),
    };
  }

  return {
    workflowId,
    text: "New box wizard — choose Mini Box or CIAB",
    blocks: newboxTypeBlocks(workflowId),
  };
}

async function runTopicResearchAsync(args: Parameters<typeof import("@/lib/slack/handlers").runTopicResearchForMonth>[0]) {
  const { runTopicResearchForMonth } = await import("@/lib/slack/handlers");
  await runTopicResearchForMonth(args);
}

export async function startNewboxWizard({
  channel,
  threadTs,
  userId,
  parsed,
}: {
  channel: string;
  threadTs?: string;
  userId?: string;
  parsed?: {
    boxType?: "mini-box" | "ciab";
    month?: string;
  };
}) {
  const response = await buildNewboxWizardResponse({
    channel,
    threadTs,
    userId,
    parsed,
  });
  if (!response.async) {
    await slackPostMessage({
      channel,
      threadTs,
      text: response.text,
      blocks: response.blocks,
    });
  }
  return response;
}

export async function handleNewboxTypeSelect({
  workflowId,
  boxType,
  channel,
  threadTs,
}: {
  workflowId: string;
  boxType: "mini-box" | "ciab";
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadOrStubWorkflow(workflowId, channel, threadTs, boxType);
  workflow.boxType = boxType;
  workflow.status = "newbox_setup";
  await persist(workflow);

  const calendars = await loadAnnualCalendars();
  const year = new Date().getFullYear();

  if (!hasAnnualCalendarTopics(calendars, year, boxType)) {
    await promptCalendarUpload({ workflow, channel, threadTs });
    return;
  }

  await showMonthPicker({
    workflowId,
    boxType,
    channel,
    threadTs,
    calendars,
    year,
  });
}

export async function handleNewboxMonthSelect({
  workflowId,
  monthNumber,
  monthLabel,
  year,
  channel,
  threadTs,
  userId,
  boxType,
}: {
  workflowId: string;
  monthNumber: number;
  monthLabel: string;
  year: number;
  channel: string;
  threadTs?: string;
  userId?: string;
  boxType?: "mini-box" | "ciab";
}) {
  const workflow = await loadOrStubWorkflow(
    workflowId,
    channel,
    threadTs,
    boxType || "mini-box",
  );
  workflow.targetMonth = monthNumber;
  workflow.targetMonthLabel = monthLabel;
  workflow.targetYear = year;
  workflow.boxType = boxType || workflow.boxType;
  await persist(workflow);

  const calendars = await loadAnnualCalendars();
  const displayMonthLabel =
    monthLabel ||
    monthCalendarLabel(calendars, monthNumber, workflow.boxType, year);

  if (workflow.boxType === "ciab") {
    const calendars = await loadAnnualCalendarsConfig();
    const ciabTopic = monthCiabTopic(calendars, monthNumber, year);
    const miniTopics = monthMiniBoxTopics(calendars, monthNumber, year);
    workflow.monthlyCiabTopic = ciabTopic;
    workflow.status = "topic_selection";
    await persist(workflow);

    await slackPostMessage({
      channel,
      threadTs,
      text: `CIAB topic for ${displayMonthLabel}`,
      blocks: ciabMonthReadyBlocks(displayMonthLabel, ciabTopic, miniTopics),
    });
    return;
  }

  const { runTopicResearchForMonth } = await import("@/lib/slack/handlers");
  await runTopicResearchForMonth({
    channel,
    threadTs,
    userId,
    workflowId,
    monthNumber,
    monthLabel: displayMonthLabel,
    year,
  });
}

async function loadOrStubWorkflow(
  workflowId: string,
  channel: string,
  threadTs?: string,
  boxType: "mini-box" | "ciab" = "mini-box",
): Promise<SlackWorkflowRecord> {
  const { loadSlackWorkflowFromDrive } = await import("@/lib/box-studio-drive-data");
  const existing = await loadSlackWorkflowFromDrive(workflowId);
  if (existing) return existing;

  return {
    id: workflowId,
    boxType,
    status: "newbox_setup",
    slackChannel: channel,
    slackThreadTs: threadTs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function persist(workflow: SlackWorkflowRecord) {
  workflow.updatedAt = new Date().toISOString();
  try {
    await saveSlackWorkflowToDrive(workflow);
  } catch {
    // non-fatal
  }
}
