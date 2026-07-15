import { randomUUID } from "crypto";
import {
  monthCiabTopic,
  monthMiniBoxTopics,
  MONTH_LABELS,
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
  const workflowId = randomUUID();
  const now = new Date().getFullYear();
  const workflow: SlackWorkflowRecord = {
    id: workflowId,
    boxType: parsed?.boxType || "mini-box",
    status: "newbox_setup",
    slackChannel: channel,
    slackThreadTs: threadTs,
    targetYear: now,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };

  try {
    await saveSlackWorkflowToDrive(workflow);
    if (threadTs) await registerSlackWorkflowThread(channel, threadTs, workflowId);
  } catch {
    // continue — buttons may fail without Drive
  }

  if (parsed?.boxType && parsed?.month) {
    const month = parseMonthInput(parsed.month, now);
    if (month) {
      if (parsed.boxType === "mini-box") {
        const { runTopicResearchForMonth } = await import("@/lib/slack/handlers");
        await runTopicResearchForMonth({
          channel,
          threadTs,
          userId,
          workflowId,
          monthNumber: month.monthNumber,
          monthLabel: month.monthLabel,
          year: month.year,
        });
        return { workflowId, skippedWizard: true };
      }
      await handleNewboxMonthSelect({
        workflowId,
        monthNumber: month.monthNumber,
        monthLabel: month.monthLabel,
        year: month.year,
        channel,
        threadTs,
        userId,
        boxType: "ciab",
      });
      return { workflowId, skippedWizard: true };
    }
  }

  if (parsed?.boxType) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `New ${parsed.boxType === "ciab" ? "CIAB" : "Mini Box"} — select month`,
      blocks: newboxMonthBlocks(workflowId, parsed.boxType),
    });
    return { workflowId, skippedWizard: false };
  }

  await slackPostMessage({
    channel,
    threadTs,
    text: "New box wizard — choose Mini Box or CIAB",
    blocks: newboxTypeBlocks(workflowId),
  });
  return { workflowId, skippedWizard: false };
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

  await slackPostMessage({
    channel,
    threadTs,
    text: `${boxType === "ciab" ? "CIAB" : "Mini Box"} selected — pick a month`,
    blocks: newboxMonthBlocks(workflowId, boxType),
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
      text: `CIAB topic for ${monthLabel}`,
      blocks: ciabMonthReadyBlocks(monthLabel, ciabTopic, miniTopics),
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
    monthLabel,
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
