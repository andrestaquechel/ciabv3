import { randomUUID } from "crypto";
import {
  monthCalendarLabel,
  monthCiabTopic,
  monthMiniBoxTopics,
  parseMonthInput,
} from "@/lib/annual-calendar-types";
import {
  loadAppSettingsFromDrive,
  registerSlackWorkflowThread,
  saveSlackWorkflowToDrive,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import { slackPostMessage } from "@/lib/slack/api";
import {
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
    const settings = await loadAppSettingsFromDrive();
    return settings?.annualCalendars;
  } catch {
    return undefined;
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
  await slackPostMessage({
    channel,
    threadTs,
    text: `${boxType === "ciab" ? "CIAB" : "Mini Box"} selected — pick a month`,
    blocks: newboxMonthBlocks(workflowId, boxType, calendars),
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
    const settings = await loadAppSettingsFromDrive();
    const ciabTopic = monthCiabTopic(settings?.annualCalendars, monthNumber, year);
    const miniTopics = monthMiniBoxTopics(settings?.annualCalendars, monthNumber, year);
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
