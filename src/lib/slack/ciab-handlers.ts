import { randomUUID } from "crypto";
import {
  loadAppSettingsFromDrive,
  loadSlackWorkflowFromDrive,
  saveGeneratedCiabDraftToDrive,
  saveSlackWorkflowToDrive,
  type SlackWorkflowRecord,
} from "@/lib/box-studio-drive-data";
import { MONTH_LABELS } from "@/lib/annual-calendar-types";
import { slackPostMessage } from "@/lib/slack/api";
import { mrkdwnSections } from "@/lib/slack/blocks";
import {
  ciabBoxReadyBlocks,
  ciabConceptBlocks,
  ciabOutlineReviewBlocks,
} from "@/lib/slack/newbox-blocks";
import { resolveSlackReview } from "@/lib/slack/review-settings";
import {
  generateCiabConceptOptions,
  generateCiabOutline,
  generateCiabSources,
  generateFullCiab,
} from "@/lib/ciab-generate";
import { pickCiabGifs } from "@/lib/giphy-search";
import { buildCiabDeckFromTemplate } from "@/lib/pptx/ciab-template-export";
import { uploadPptxAsGoogleSlides } from "@/lib/google-drive-slides";
import { ciabDisplayName } from "@/lib/ciab";
import {
  ciabBoxSlackPreview,
  ciabOutlineSlackPreview,
  renderCiabBoxHtml,
  renderCiabOutlineHtml,
} from "@/lib/ciab-document";
import { uploadHtmlAsGoogleDoc } from "@/lib/google-drive-doc";
import { dispatchCiabJob } from "@/lib/slack/ciab-job";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

async function persist(workflow: SlackWorkflowRecord) {
  workflow.updatedAt = new Date().toISOString();
  try {
    await saveSlackWorkflowToDrive(workflow);
  } catch {
    // non-fatal
  }
}

function monthLabelOf(workflow: SlackWorkflowRecord): string {
  return (
    workflow.targetMonthLabel ||
    (workflow.targetMonth ? MONTH_LABELS[workflow.targetMonth - 1] : "") ||
    ""
  );
}

function csmMentionLine(csmUserIds?: string[]) {
  if (!csmUserIds?.length) return "";
  return csmUserIds.map((id) => `<@${id}>`).join(" ");
}

/* ------------------------------------------------------------------ */
/* Step 1 — concept options                                            */
/* ------------------------------------------------------------------ */

export async function handleCiabStart({
  workflowId,
  channel,
  threadTs,
}: {
  workflowId: string;
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow) {
    await slackPostMessage({ channel, threadTs, text: "Workflow not found. Run `/newbox ciab` again." });
    return;
  }

  const topic = workflow.monthlyCiabTopic || monthLabelOf(workflow) || "this month's topic";
  await slackPostMessage({
    channel,
    threadTs,
    text: `Researching Main CIAB concept options for *${topic}* (this may take a minute)…`,
  });

  let result;
  try {
    result = await generateCiabConceptOptions({ topic, monthLabel: monthLabelOf(workflow) });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Concept research failed: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    return;
  }

  workflow.ciabConcepts = result.concepts;
  workflow.status = "concept_selection";
  await persist(workflow);

  await slackPostMessage({
    channel,
    threadTs,
    text: `Main CIAB concept options for ${topic} ready.`,
    blocks: ciabConceptBlocks(workflow.id, result.concepts, monthLabelOf(workflow)),
  });

  if (result.note) {
    await slackPostMessage({ channel, threadTs, text: result.note });
  }
}

/* ------------------------------------------------------------------ */
/* Step 2 — concept → sources → outline                                */
/* ------------------------------------------------------------------ */

/** First half: research sources, then hand off outline drafting to a fresh
 *  invocation. Splitting keeps each background job short enough to survive as a
 *  post-response task (sources + outline together ran ~180-260s and were being
 *  killed silently). */
export async function generateAndPostCiabSources({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
}) {
  const concept = workflow.selectedConcept;
  if (!concept) throw new Error("No concept selected.");

  await slackPostMessage({
    channel,
    threadTs,
    text: `Researching sources for *${concept.title}*…`,
  });

  let sourcesResult;
  try {
    sourcesResult = await generateCiabSources({ concept });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `⚠️ Source research failed: ${errMessage(err)}\nTap *Regenerate outline* to retry.`,
    });
    return;
  }

  workflow.ciabSources = sourcesResult.sources;
  workflow.status = "ciab_outline";
  await persist(workflow);

  if (sourcesResult.note) {
    await slackPostMessage({ channel, threadTs, text: sourcesResult.note });
  }

  await slackPostMessage({
    channel,
    threadTs,
    text: `Found ${sourcesResult.sources.length} vetted source${sourcesResult.sources.length === 1 ? "" : "s"} — drafting the stakeholder outline…`,
  });

  // Hand the outline off to its own invocation so this job ends now.
  try {
    await dispatchCiabJob({ step: "outline", workflowId: workflow.id, channel, threadTs });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `⚠️ Could not start the outline step: ${errMessage(err)}\nTap *Regenerate outline* to retry.`,
    });
  }
}

/** Second half: build + post the outline from already-researched sources. */
export async function generateAndPostCiabOutlineFromSources({
  workflow,
  channel,
  threadTs,
}: {
  workflow: SlackWorkflowRecord;
  channel: string;
  threadTs?: string;
}) {
  const concept = workflow.selectedConcept;
  if (!concept) throw new Error("No concept selected.");
  const sources = workflow.ciabSources || [];

  let outlineResult;
  try {
    outlineResult = await generateCiabOutline({ concept, sources });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `⚠️ Outline drafting failed: ${errMessage(err)}\nTap *Regenerate outline* to retry.`,
    });
    return;
  }

  workflow.ciabOutline = outlineResult.outline;
  workflow.status = "ciab_outline";
  await persist(workflow);

  // Post the outline to a commentable Google Doc (best-effort) + inline preview.
  let docUrl: string | undefined;
  try {
    const uploaded = await uploadHtmlAsGoogleDoc({
      html: renderCiabOutlineHtml(outlineResult.outline),
      name: `${ciabDisplayName(outlineResult.outline.title, workflow.targetMonth, workflow.targetYear)} — Outline`,
    });
    docUrl = uploaded.webViewLink;
  } catch (err) {
    console.error("CIAB outline doc upload failed:", err);
  }

  const preview = mrkdwnSections(ciabOutlineSlackPreview(outlineResult.outline));
  await slackPostMessage({
    channel,
    threadTs,
    text: "Main CIAB outline ready for review.",
    blocks: ciabOutlineReviewBlocks(workflow.id, preview, docUrl),
  });

  if (outlineResult.note) {
    await slackPostMessage({ channel, threadTs, text: outlineResult.note });
  }
}

export async function handleCiabConceptSelection({
  workflowId,
  conceptId,
  channel,
  threadTs,
}: {
  workflowId: string;
  conceptId: string;
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  const concept = workflow?.ciabConcepts?.find((c) => c.id === conceptId);
  if (!workflow || !concept) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Could not find concept #${conceptId}. Start the CIAB again with the button above.`,
    });
    return;
  }

  workflow.selectedConcept = concept;
  workflow.status = "ciab_outline";
  await persist(workflow);

  await slackPostMessage({
    channel,
    threadTs,
    text: `Selected *${concept.title}* — researching sources and drafting the outline…`,
  });

  await generateAndPostCiabSources({ workflow, channel, threadTs });
}

/** Runs the outline half in its own invocation (dispatched by the sources step). */
export async function handleCiabOutline({
  workflowId,
  channel,
  threadTs,
}: {
  workflowId: string;
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow?.selectedConcept) {
    await slackPostMessage({ channel, threadTs, text: "Workflow not found. Start the CIAB again." });
    return;
  }
  await generateAndPostCiabOutlineFromSources({ workflow, channel, threadTs });
}

export async function handleCiabOutlineRegenerate({
  workflowId,
  channel,
  threadTs,
}: {
  workflowId: string;
  channel: string;
  threadTs?: string;
}) {
  const workflow = await loadSlackWorkflowFromDrive(workflowId);
  if (!workflow?.selectedConcept) {
    await slackPostMessage({ channel, threadTs, text: "Workflow not found. Start the CIAB again." });
    return;
  }
  // Reuse already-researched sources when present; otherwise re-run the full
  // sources → outline chain.
  if (workflow.ciabSources?.length) {
    await generateAndPostCiabOutlineFromSources({ workflow, channel, threadTs });
  } else {
    await generateAndPostCiabSources({ workflow, channel, threadTs });
  }
}

/* ------------------------------------------------------------------ */
/* Step 3 — approve outline → full box + GIFs + reviewable Doc         */
/* ------------------------------------------------------------------ */

export async function handleCiabOutlineApproval({
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
  if (!workflow?.ciabOutline) {
    await slackPostMessage({ channel, threadTs, text: "Outline not found. Select a concept again." });
    return;
  }

  const outline = workflow.ciabOutline;
  const sources = workflow.ciabSources || outline.sources || [];
  const boxName = ciabDisplayName(outline.title, workflow.targetMonth, workflow.targetYear);

  await slackPostMessage({
    channel,
    threadTs,
    text: `Drafting the full Main Box for *${outline.title}* (welcome + blog + 4 emails + 4 chats + GIFs)…`,
  });

  let full;
  try {
    full = await generateFullCiab({ outline, sources });
  } catch (err) {
    await slackPostMessage({
      channel,
      threadTs,
      text: `Full box generation failed: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    return;
  }

  const content = full.content;

  // GIFs for every slot: welcome, one per blog section (+conclusion), 4 emails, 4 chats.
  const blogGifText = [
    ...content.blog.sections.map((s) => `${s.heading} ${s.body}`),
    `${content.blog.conclusion.heading} ${content.blog.conclusion.body}`,
  ];
  const gifs = await pickCiabGifs(content.topic, {
    welcome: content.welcome.body,
    blog: blogGifText,
    emails: content.emails.map((e) => `${e.subject} ${e.body}`),
    chats: content.chats.map((c) => c.message),
  });

  // Branded Google Slides deck (best-effort) — the primary deliverable.
  let deckUrl: string | undefined;
  try {
    const pptxBuffer = await buildCiabDeckFromTemplate(content, gifs);
    const uploaded = await uploadPptxAsGoogleSlides({
      pptxBuffer: Buffer.from(pptxBuffer),
      name: boxName,
    });
    deckUrl = uploaded.webViewLink;
  } catch (err) {
    console.error("CIAB branded deck build/upload failed:", err);
  }

  // Reviewable Google Doc (best-effort) — a text mirror for inline commenting.
  let docUrl: string | undefined;
  try {
    const uploaded = await uploadHtmlAsGoogleDoc({
      html: renderCiabBoxHtml(content, gifs),
      name: `${boxName} — Text`,
    });
    docUrl = uploaded.webViewLink;
  } catch (err) {
    console.error("CIAB full box doc upload failed:", err);
  }

  const draftId = randomUUID();
  try {
    await saveGeneratedCiabDraftToDrive({
      id: draftId,
      topic: content.topic,
      createdAt: new Date().toISOString(),
      createdBy: userId || workflow.createdBy,
      source: full.source,
      outline,
      sources,
      content,
      gifs,
      targetMonth: workflow.targetMonth,
      targetYear: workflow.targetYear,
      reviewDocUrl: docUrl,
      reviewDeckUrl: deckUrl,
    });
    workflow.ciabDraftId = draftId;
  } catch {
    workflow.ciabDraftId = undefined;
  }
  workflow.ciabReviewDocUrl = docUrl;
  workflow.ciabReviewDeckUrl = deckUrl;
  workflow.status = "ciab_full_draft";
  await persist(workflow);

  const settings = await loadAppSettingsFromDrive();
  const { csmUserIds } = resolveSlackReview(settings?.slackReview);
  const mentions = csmMentionLine(csmUserIds);

  await slackPostMessage({
    channel,
    threadTs,
    text: `Full Main Box ready: ${boxName}`,
    blocks: ciabBoxReadyBlocks(boxName, docUrl, mrkdwnSections(ciabBoxSlackPreview(content)), mentions, deckUrl),
  });

  if (!deckUrl && !docUrl) {
    await slackPostMessage({
      channel,
      threadTs,
      text: "⚠️ Could not create the deck or Doc automatically. The draft is saved — retry or check Drive access (BOX_STUDIO_GOOGLE_REFRESH_TOKEN).",
    });
  }
  if (full.note) await slackPostMessage({ channel, threadTs, text: full.note });
}
