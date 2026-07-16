import type { GifSelection } from "@/lib/mini-box";
import {
  CIAB_RESOURCES_INTRO,
  type CiabGeneratedContent,
  type CiabGifs,
} from "@/lib/ciab";
import type { CiabOutline } from "@/lib/ciab-prompts";

function escapeHtml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert the light inline markdown the model emits ([text](url), **bold**) to
 *  HTML, escaping everything else. */
function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label, url) => `<a href="${url}">${label}</a>`,
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

/** Render multi-line body copy as paragraphs. */
function paragraphs(text: string): string {
  return (text || "")
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${inline(line)}</p>`)
    .join("\n");
}

function gifBlock(gif: GifSelection): string {
  if (!gif) return "";
  const img = gif.previewUrl || gif.url;
  const link = gif.url || gif.previewUrl;
  const alt = escapeHtml(gif.title || gif.query || "GIF");
  return [
    `<p><img src="${img}" alt="${alt}" style="max-width:480px;" /></p>`,
    link ? `<p><a href="${link}">Via Giphy</a></p>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Stakeholder outline → HTML (mirrors the archive outline docs)       */
/* ------------------------------------------------------------------ */

export function renderCiabOutlineHtml(outline: CiabOutline): string {
  const sources = outline.sources
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.name)}</strong> (${escapeHtml(s.publisher)}, ${escapeHtml(s.date)}) — ${inline(s.claim)}${s.url ? ` <a href="${s.url}">link</a>` : ""}</li>`,
    )
    .join("\n");

  const sections = outline.sections
    .map((sec) => {
      const points = sec.keyTeachingPoints
        .map((p) => `<li>${inline(p)}</li>`)
        .join("\n");
      return [
        `<h3>${inline(sec.title)}</h3>`,
        paragraphs(sec.description),
        points ? `<p><strong>Key teaching points:</strong></p><ul>${points}</ul>` : "",
        `<p>🛡️ <strong>Safe Data Moment:</strong> ${inline(sec.safeDataMoment)}</p>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const arc = outline.campaignArc
    .map(
      (r) =>
        `<tr><td>Week ${r.week}</td><td>${escapeHtml(r.topic)}</td><td>${escapeHtml(r.focus)}</td></tr>`,
    )
    .join("\n");

  return [
    `<h1>${escapeHtml(outline.title)}</h1>`,
    outline.subtitle ? `<h2><em>${escapeHtml(outline.subtitle)}</em></h2>` : "",
    `<h2>The Big Idea</h2>`,
    paragraphs(outline.bigIdea),
    `<h2>Why This, Why Now</h2>`,
    `<ul>${outline.whyThisWhyNow.map((w) => `<li>${inline(w)}</li>`).join("\n")}</ul>`,
    outline.whatMakesThisFresh
      ? `<h2>What Makes This Box Fresh</h2>${paragraphs(outline.whatMakesThisFresh)}`
      : "",
    `<h2>Sources</h2><ol>${sources}</ol>`,
    `<h2>Campaign Sections</h2>`,
    sections,
    `<h2>Campaign Arc</h2>`,
    `<table border="1" cellpadding="6"><tr><th>Week</th><th>Topic</th><th>Focus</th></tr>${arc}</table>`,
    `<h2>Who This Is For</h2>`,
    paragraphs(outline.whoThisIsFor),
    outline.tagline ? `<h2>Proposed Tagline</h2><p><em>${escapeHtml(outline.tagline)}</em></p>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Full box → HTML (Main Box asset order, with GIF slots)              */
/* ------------------------------------------------------------------ */

export function renderCiabBoxHtml(
  content: CiabGeneratedContent,
  gifs?: Partial<CiabGifs>,
): string {
  const parts: string[] = [`<h1>${escapeHtml(content.topic)}</h1>`];
  if (content.tagline) parts.push(`<p><em>${escapeHtml(content.tagline)}</em></p>`);

  // 1. Welcome Message for Program Owners
  parts.push(`<hr /><h2>Welcome Message for Program Owners</h2>`);
  parts.push(paragraphs(content.welcome.body));
  if (gifs?.welcome) parts.push(gifBlock(gifs.welcome));

  // 2. Blog for End Users
  parts.push(`<hr /><h2>Blog for End Users</h2>`);
  if (content.blog.title) parts.push(`<h3>${escapeHtml(content.blog.title)}</h3>`);
  parts.push(paragraphs(content.blog.intro));
  content.blog.sections.forEach((sec, i) => {
    parts.push(`<h3>${escapeHtml(sec.heading)}</h3>`);
    parts.push(paragraphs(sec.body));
    if (sec.yourMove) parts.push(`<p>🎯 <strong>Your Move:</strong> ${inline(sec.yourMove.replace(/^🎯\s*Your Move:\s*/i, ""))}</p>`);
    const g = gifs?.blog?.[i];
    if (g) parts.push(gifBlock(g));
  });
  parts.push(`<h3>${escapeHtml(content.blog.conclusion.heading)}</h3>`);
  parts.push(paragraphs(content.blog.conclusion.body));
  if (content.blog.conclusion.yourFinalMove) {
    parts.push(
      `<p>🎯 <strong>Your Final Move:</strong> ${inline(content.blog.conclusion.yourFinalMove.replace(/^🎯\s*Your Final Move:\s*/i, ""))}</p>`,
    );
  }
  const blogTailGif = gifs?.blog?.[content.blog.sections.length];
  if (blogTailGif) parts.push(gifBlock(blogTailGif));

  // 3 + 4. Weekly emails and chats, interleaved by week
  for (let w = 1; w <= 4; w += 1) {
    const email = content.emails.find((e) => e.week === w) || content.emails[w - 1];
    const chat = content.chats.find((c) => c.week === w) || content.chats[w - 1];
    parts.push(`<hr /><h2>Week ${w}</h2>`);

    if (email) {
      parts.push(`<h3>Campaign Email</h3>`);
      if (email.subject) parts.push(`<p><strong>Subject:</strong> ${escapeHtml(email.subject)}</p>`);
      if (email.greeting) parts.push(`<p>${escapeHtml(email.greeting)}</p>`);
      parts.push(paragraphs(email.body));
      const g = gifs?.emails?.[w - 1];
      if (g) parts.push(gifBlock(g));
    }

    if (chat) {
      parts.push(`<h3>Chat Message</h3>`);
      parts.push(paragraphs(chat.message));
      const g = gifs?.chats?.[w - 1];
      if (g) parts.push(gifBlock(g));
    }
  }

  // 5. Complementary Resources
  parts.push(`<hr /><h2>Complementary Resources</h2>`);
  parts.push(`<p>${inline(content.resources.intro || CIAB_RESOURCES_INTRO)}</p>`);
  if (content.resources.items.length) {
    parts.push(`<ul>${content.resources.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("\n")}</ul>`);
  }

  return parts.filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* Slack previews                                                      */
/* ------------------------------------------------------------------ */

export function ciabOutlineSlackPreview(outline: CiabOutline): string {
  const sections = outline.sections
    .map((s) => `• ${s.title}`)
    .join("\n");
  const sources = outline.sources
    .map((s) => `• <${s.url}|${s.name}> — ${s.claim}`)
    .join("\n");
  return [
    `*${outline.title}*`,
    outline.subtitle ? `_${outline.subtitle}_` : "",
    "",
    "*The Big Idea*",
    outline.bigIdea.slice(0, 700),
    "",
    "*Why This, Why Now*",
    outline.whyThisWhyNow.map((w) => `• ${w}`).join("\n"),
    "",
    "*Campaign Sections*",
    sections,
    "",
    "*Sources*",
    sources,
    "",
    outline.tagline ? `*Tagline:* _${outline.tagline}_` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function ciabBoxSlackPreview(content: CiabGeneratedContent): string {
  return [
    `*Full Main Box drafted — ${content.topic}*`,
    "",
    "*Welcome (program owners):*",
    content.welcome.body.slice(0, 300) + (content.welcome.body.length > 300 ? "…" : ""),
    "",
    `*Blog:* ${content.blog.title || content.topic} (${content.blog.sections.length} sections)`,
    `*Emails:* ${content.emails.length} weekly · *Chats:* ${content.chats.length} weekly`,
    `*Resources:* ${content.resources.items.length} recommended modules`,
    "",
    "*Week 1 email subject:* " + (content.emails[0]?.subject || "—"),
    "*Week 1 chat:*",
    (content.chats[0]?.message || "").slice(0, 300) + ((content.chats[0]?.message || "").length > 300 ? "…" : ""),
  ]
    .filter((l) => l !== "")
    .join("\n");
}
