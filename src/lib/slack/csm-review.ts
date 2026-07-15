import {
  buildMiniBoxFromTemplate,
  pptxFilename,
} from "@/lib/pptx/template-export";
import {
  loadAppSettingsFromDrive,
  loadGeneratedDraftFromDrive,
  saveSlackWorkflowToDrive,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import { draftToMiniBoxDocument, slidePreviewText } from "@/lib/slack/draft-document";
import { resolveSlackReview } from "@/lib/slack/review-settings";
import { slackPostMessage, slackUploadFile } from "@/lib/slack/api";
import { csmReviewBlocks } from "@/lib/slack/blocks";

function csmMentionLine(csmUserIds?: string[]) {
  if (!csmUserIds?.length) return "";
  return csmUserIds.map((id) => `<@${id}>`).join(" ");
}

export async function startCsmReview({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
}) {
  if (!workflow.draftId) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "No draft saved — CSM review skipped. Open Box Studio to export manually.",
    });
    return;
  }

  const draft = await loadGeneratedDraftFromDrive(workflow.draftId);
  if (!draft) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "Could not load draft for CSM review.",
    });
    return;
  }

  const doc = draftToMiniBoxDocument(draft);
  const pptxBuffer = await buildMiniBoxFromTemplate(doc);
  const filename = pptxFilename(doc);
  const settings = await loadAppSettingsFromDrive();
  const { csmUserIds } = resolveSlackReview(settings?.slackReview);
  const mentions = csmMentionLine(csmUserIds);
  const preview = slidePreviewText(doc);

  await slackPostMessage({
    channel,
    threadTs,
    text: mentions
      ? `${mentions} — Mini Box ready for CSM review`
      : "Mini Box ready for CSM review",
    blocks: csmReviewBlocks(workflow.id, preview, mentions),
  });

  try {
    await slackUploadFile({
      channel,
      threadTs,
      buffer: Buffer.from(pptxBuffer),
      filename,
      initialComment: `📎 *${doc.topic}* — PowerPoint draft for review. Reply in this thread with edits.`,
    });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Could not upload PPTX: ${err instanceof Error ? err.message : "upload failed"}. Use Box Studio link above.`,
    });
  }

  workflow.status = "csm_review";
  workflow.updatedAt = new Date().toISOString();
  await saveSlackWorkflowToDrive(workflow);
}
