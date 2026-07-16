import type { GifSelection } from "@/lib/mini-box";

/**
 * CIAB "Main Box" data model.
 *
 * The Main Box is a full 4-week Campaign in a Box — much larger than the Mini
 * Box. Per the "Campaign in a Box - Expectations and Process" doc, a Main Box
 * contains, in order:
 *   1. Welcome Message for Program Owners  (200-225 words + 1 GIF)
 *   2. Blog for End Users                  (1000-1150 words + GIFs)
 *   3. Four weekly Campaign Emails         (250-300 words + 1 GIF each)
 *   4. Four weekly Chat Messages           (100-150 words + 1 GIF each)
 *   5. Complementary Resources             (Living Security training modules)
 *
 * The generated content below maps 1:1 onto that structure so the reviewable
 * document (and, later, the branded deck) render faithfully.
 */

export const CIAB_WEEKS = [1, 2, 3, 4] as const;
export type CiabWeek = (typeof CIAB_WEEKS)[number];

/** A blog body section: a heading, prose (citing sources by name inline), and a
 *  "Your Move" action line — matching the archive's "🎯 Your Move:" callouts. */
export type CiabBlogSection = {
  heading: string;
  body: string;
  /** The single action line for this section (rendered as "🎯 Your Move: …"). */
  yourMove: string;
};

export type CiabEmail = {
  week: CiabWeek;
  /** e.g. "Hi, Everyone!" / "Hello Everyone," / "Hi, Team!" */
  greeting: string;
  /** Emoji + Title Case subject line (doubles as the email subject). */
  subject: string;
  /** 250-300 words. Ends with a sign-off line then {{ SIGNATURE }}. */
  body: string;
};

export type CiabChat = {
  week: CiabWeek;
  /** 100-150 words, emoji-opened, with a call for interaction (poll / react). */
  message: string;
};

export type CiabResources = {
  /** Standard lead-in line before the module list. */
  intro: string;
  /** Living Security training / Teams content module names. */
  items: string[];
};

/**
 * The full generated Main Box content. Every field is final copy — what is
 * written here is what appears in the reviewable doc and the deck.
 */
export type CiabGeneratedContent = {
  /** Concise box title, e.g. "Phone-Based Social Engineering". */
  topic: string;
  tagline?: string;
  welcome: {
    /** Full 200-225 word program-owner note (Hello! … Live Secure). */
    body: string;
  };
  blog: {
    /** Optional standalone blog title/hook shown on the blog cover. */
    title: string;
    /** 2-3 short opening paragraphs establishing the theme. */
    intro: string;
    /** ~4 body sections, each with its own heading + Your Move. */
    sections: CiabBlogSection[];
    /** Closing section that ties the campaign together (Your Final Move). */
    conclusion: {
      heading: string;
      body: string;
      /** Rendered as "🎯 Your Final Move: …". */
      yourFinalMove: string;
    };
  };
  emails: CiabEmail[];
  chats: CiabChat[];
  resources: CiabResources;
};

/** GIF selections for every "Via Giphy" slot in the Main Box. */
export type CiabGifs = {
  welcome: GifSelection;
  /** One per blog GIF slot (aligned with blog sections + conclusion). */
  blog: GifSelection[];
  /** One per weekly email (index 0 = week 1). */
  emails: GifSelection[];
  /** One per weekly chat (index 0 = week 1). */
  chats: GifSelection[];
};

export const CIAB_WELCOME_SIGNOFF = "Live Secure,\nThe Living Security Team";
export const CIAB_EMAIL_SIGNOFF = "Until next time,";
export const CIAB_RESOURCES_INTRO =
  "If you're looking for training content to assign this month, we have your back! Here are our recommendations for Living Security training modules to complement this month's Campaign in a Box:";

/**
 * Format the canonical Main Box name: `CiaB_MM.YY_[Title]`
 * e.g. CiaB_06.26_Mobile Social Engineering
 */
export function ciabDisplayName(
  topic: string,
  month?: number,
  year?: number,
): string {
  const now = new Date();
  const mm = String(month ?? now.getMonth() + 1).padStart(2, "0");
  const yy = String((year ?? now.getFullYear()) % 100).padStart(2, "0");
  const cleanTitle = (topic || "Campaign in a Box").replace(/\s+/g, " ").trim();
  return `CiaB_${mm}.${yy}_${cleanTitle}`;
}

/** Empty content scaffold (used as a safe fallback shape). */
export function emptyCiabContent(topic = ""): CiabGeneratedContent {
  return {
    topic,
    welcome: { body: "" },
    blog: { title: "", intro: "", sections: [], conclusion: { heading: "", body: "", yourFinalMove: "" } },
    emails: [],
    chats: [],
    resources: { intro: CIAB_RESOURCES_INTRO, items: [] },
  };
}
