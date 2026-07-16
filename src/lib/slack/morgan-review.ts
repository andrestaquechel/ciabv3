import { anthropicJson } from "@/lib/anthropic";
import type { GeneratedMiniBoxSections } from "@/lib/mini-box";
import {
  buildMiniBoxFromTemplate,
  pptxFilename,
} from "@/lib/pptx/template-export";
import {
  loadGeneratedDraftFromDrive,
  saveGeneratedDraftToDrive,
  type GeneratedBoxDraft,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import { pickMiniBoxGifs } from "@/lib/giphy-search";
import { addGeneratedBoxToMemory } from "@/lib/minibox-topic-memory";
import { draftToMiniBoxDocument } from "@/lib/slack/draft-document";
import {
  slackGetThreadReplies,
  slackPostMessage,
  slackUploadFile,
} from "@/lib/slack/api";
import { finalDraftBlocks } from "@/lib/slack/blocks";
import { saveSlackWorkflowToDrive } from "@/lib/box-studio-drive-data";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://ciabv2-gilt.vercel.app";
}

function feedbackFromThread(
  messages: Array<{ ts: string; user?: string; text?: string; bot_id?: string }>,
  botUserId?: string,
) {
  return messages
    .filter((m) => !m.bot_id && m.user !== botUserId && m.text?.trim())
    .map((m) => m.text!.trim())
    .filter((t) => !t.startsWith("Selected *") && !/^Generating /i.test(t))
    .join("\n\n");
}

export async function applyCsmFeedbackAndFinalize({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs: string;
}) {
  if (!workflow.draftId || !threadTs) {
    throw new Error("Missing draft or thread.");
  }

  await slackPostMessage({
    channel,
    threadTs,
    text: "Applying CSM feedback and building final draft…",
  });

  const draft = await loadGeneratedDraftFromDrive(workflow.draftId);
  if (!draft) throw new Error("Draft not found.");

  const replies = await slackGetThreadReplies(channel, threadTs);
  const feedback = feedbackFromThread(replies);

  if (!feedback.trim()) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "No CSM comments found in this thread yet. Ask CSMs to reply with feedback, then try again.",
    });
    return;
  }

  const revised = await anthropicJson<{ sections: GeneratedMiniBoxSections }>({
    system: `You revise Living Security Mini Box content based on reviewer feedback. Keep tone warm, security-focused, and emoji-friendly. Preserve {{ SIGNATURE }} in email closings. Return JSON only.`,
    user: `Topic: ${draft.topic}

Current sections:
${JSON.stringify(draft.sections, null, 2)}

CSM / reviewer feedback from Slack thread:
${feedback}

Return JSON: { "sections": { "welcome": {...}, "onePager": {...}, "chat": {...} } }`,
    temperature: 0.4,
    maxTokens: 8192,
  });

  const updatedDraft: GeneratedBoxDraft = {
    ...draft,
    sections: revised.sections,
    gifs:
      draft.gifs ??
      (await pickMiniBoxGifs(draft.topic, {
        welcome: revised.sections.welcome.intro,
        onePager: `${revised.sections.onePager.subjectLine} ${revised.sections.onePager.bodyPart1}`,
        chat: revised.sections.chat.message,
      })),
  };

  await saveGeneratedDraftToDrive(updatedDraft);

  const doc = draftToMiniBoxDocument(updatedDraft);
  const pptxBuffer = await buildMiniBoxFromTemplate(doc);
  const filename = pptxFilename(doc, workflow.targetMonth, workflow.targetYear);

  await slackUploadFile({
    channel,
    threadTs,
    buffer: Buffer.from(pptxBuffer),
    filename: filename.replace(/\.pptx$/, " (Final).pptx"),
    initialComment: `✅ *Final draft* — ${doc.topic} (CSM feedback applied)`,
  });

  // Self-update the rolling topic memory: fold this finished box in and evict
  // anything now older than 2 years, so future topic research can cross-
  // reference it. Best-effort — never block finalization on it.
  try {
    const s = revised.sections;
    const contentText = [
      s.welcome.intro,
      s.welcome.contents,
      s.welcome.closing,
      s.onePager.subjectLine,
      s.onePager.greeting,
      s.onePager.bodyPart1,
      s.onePager.callout,
      s.onePager.bodyPart2,
      s.chat.message,
    ]
      .filter(Boolean)
      .join("\n\n");
    const selected = workflow.selectedTopic;
    const sources: { name?: string; url?: string }[] = [];
    if (selected) {
      sources.push({ name: selected.sourceName, url: selected.sourceLink });
      if (selected.secondarySourceLink) {
        sources.push({
          name: selected.secondarySourceName,
          url: selected.secondarySourceLink,
        });
      }
    }
    await addGeneratedBoxToMemory({
      title: doc.title || doc.topic,
      topic: doc.topic,
      month: workflow.targetMonth,
      year: workflow.targetYear,
      contentText,
      sources: sources.length ? sources : undefined,
    });
  } catch {
    // topic memory is optional
  }

  workflow.status = "morgan_review";
  workflow.updatedAt = new Date().toISOString();
  await saveSlackWorkflowToDrive(workflow);

  const openUrl = `${appBaseUrl()}/builder/new?draft=${workflow.draftId}`;
  await slackPostMessage({
    channel,
    threadTs,
    text: `Final Mini Box draft ready: ${doc.topic}`,
    blocks: finalDraftBlocks(doc.topic, openUrl),
  });
}
