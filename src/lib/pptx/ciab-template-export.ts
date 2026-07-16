import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import type { CiabGeneratedContent } from "@/lib/ciab";
import { replaceShapeText } from "@/lib/pptx/template-export";

/**
 * CIAB "Main Box" branded deck export.
 *
 * Fills the branded 20-slide master (`templates/ciab-master.pptx`, derived from
 * CiaB_06.26 with GIFs stripped) with generated content, preserving the
 * template's exact fonts (embedded InterTight), colors, and layout via the same
 * paragraph-styling-preserving replacement the Mini Box uses.
 *
 * Slide map (confirmed from the master; shape indices are text-shape order):
 *   1  cover           [0]=title
 *   2  welcome         [1]=Hello+framing  [2]="In this box…"+signoff  [3]=Via Giphy
 *   3-7 blog           body shapes vary per slide (see BLOG_FILL)
 *   8/11/14/17 dividers (Week N — static)
 *   9  wk1 email       [0]=body  [3]=Subject
 *   10 wk1 chat        [1]=message
 *   12 wk2 email       [1]=body  [3]=Subject
 *   13 wk2 chat        [1]=message
 *   15 wk3 email       [0]=body  [2]=Subject
 *   16 wk3 chat        [1]=message
 *   18 wk4 email       [2]=body  [3]=Subject
 *   19 wk4 chat        [1]=message
 *   20 resources       [1]=intro+modules
 *
 * GIFs sit above each "Via Giphy" caption; image injection is a follow-up
 * (see docs/decisions/003) — text fidelity lands first.
 */

export const CIAB_TEMPLATE_FILE = "ciab-master.pptx";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", CIAB_TEMPLATE_FILE);

type Edit = { shape: number; text: string };

/** Per-week email/chat slide + shape mapping. */
const WEEK_SLIDES = [
  { week: 1, emailSlide: 9, emailBody: 0, emailSubject: 3, chatSlide: 10, chatBody: 1 },
  { week: 2, emailSlide: 12, emailBody: 1, emailSubject: 3, chatSlide: 13, chatBody: 1 },
  { week: 3, emailSlide: 15, emailBody: 0, emailSubject: 2, chatSlide: 16, chatBody: 1 },
  { week: 4, emailSlide: 18, emailBody: 2, emailSubject: 3, chatSlide: 19, chatBody: 1 },
] as const;

function emailBodyText(greeting: string, body: string): string {
  return [greeting, "", body].filter((l) => l !== undefined).join("\n").trim();
}

function yourMoveLine(prefix: string, text: string): string {
  const cleaned = (text || "").replace(/^🎯\s*Your (Final )?Move:\s*/i, "").trim();
  return cleaned ? `🎯 ${prefix} ${cleaned}` : "";
}

/**
 * Build the per-slide edit list for a box. Only the clean 1:1 slots are mapped
 * with confidence; the blog is filled best-effort into each blog slide's primary
 * body shape (content-shaping to the exact multi-shape blog layout is the next
 * iteration).
 */
function buildEdits(content: CiabGeneratedContent): Record<number, Edit[]> {
  const edits: Record<number, Edit[]> = {};
  const add = (slide: number, shape: number, text: string) => {
    (edits[slide] ||= []).push({ shape, text });
  };

  // Cover
  add(1, 0, content.topic);

  // Welcome — full note in the top body shape; clear the lower duplicate shape.
  add(2, 1, content.welcome.body);
  add(2, 2, "");

  // Blog (best-effort): intro on slide 3, sections across 3-6, conclusion on 7.
  const blogSectionText = (i: number) => {
    const s = content.blog.sections[i];
    if (!s) return "";
    return [s.heading, "", s.body, "", yourMoveLine("Your Move:", s.yourMove)]
      .filter((l) => l !== undefined)
      .join("\n")
      .trim();
  };
  add(3, 1, content.blog.intro);
  add(3, 4, blogSectionText(0));
  add(4, 0, blogSectionText(1));
  add(4, 1, ""); // clear leftover example heading/body
  add(5, 1, blogSectionText(2));
  add(5, 3, "");
  add(6, 1, blogSectionText(3));
  add(
    7,
    1,
    [
      content.blog.conclusion.heading,
      "",
      content.blog.conclusion.body,
      "",
      yourMoveLine("Your Final Move:", content.blog.conclusion.yourFinalMove),
    ]
      .filter((l) => l !== undefined)
      .join("\n")
      .trim(),
  );

  // Weekly emails + chats
  for (const w of WEEK_SLIDES) {
    const email = content.emails.find((e) => e.week === w.week) || content.emails[w.week - 1];
    const chat = content.chats.find((c) => c.week === w.week) || content.chats[w.week - 1];
    if (email) {
      add(w.emailSlide, w.emailBody, emailBodyText(email.greeting, email.body));
      add(w.emailSlide, w.emailSubject, email.subject ? `Subject: ${email.subject}` : "");
    }
    if (chat) add(w.chatSlide, w.chatBody, chat.message);
  }

  // Resources
  const resourceText = [content.resources.intro, "", ...content.resources.items]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
  add(20, 1, resourceText);

  return edits;
}

export async function buildCiabDeckFromTemplate(content: CiabGeneratedContent): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const edits = buildEdits(content);

  for (const [slideStr, slideEdits] of Object.entries(edits)) {
    const slideNum = Number(slideStr);
    const file = zip.file(`ppt/slides/slide${slideNum}.xml`);
    if (!file) continue;
    let xml = await file.async("string");
    // Apply higher shape indices first so earlier edits do not shift later matches.
    for (const edit of [...slideEdits].sort((a, b) => b.shape - a.shape)) {
      xml = replaceShapeText(xml, edit.shape, edit.text, slideNum);
    }
    zip.file(`ppt/slides/slide${slideNum}.xml`, xml);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
