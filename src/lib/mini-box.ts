import {
  SHADOW_AI_SECTION_DEFAULTS,
  SHADOW_AI_TOPIC,
} from "@/lib/mini-box-shadow-ai-defaults";

export type SectionStatus = "empty" | "draft" | "ready" | "error";

export type GifSelection = {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
  query: string;
} | null;

export type SourceArticle = {
  id: string;
  title: string;
  url: string;
  notes: string;
};

/** Active builder nav sections */
export type MiniBoxSectionId =
  | "title"
  | "welcome"
  | "onePagerP1"
  | "onePagerP2"
  | "chat"
  | "review";

/** Legacy ids kept for stored documents */
export type LegacySectionId = "ideate" | "inputs" | "onePager";

export const NAV_SECTION_LABELS: Record<MiniBoxSectionId, string> = {
  title: "Topic / Title",
  welcome: "Welcome Message",
  onePagerP1: "Email / One Pager Pt 1",
  onePagerP2: "Email / One Pager Pt 2",
  chat: "Chat Message",
  review: "Review",
};

export type MiniBoxDocument = {
  id: string;
  type: "mini-box" | "ciab";
  title: string;
  topic: string;
  articles: SourceArticle[];
  status: "draft" | "review" | "published";
  createdAt: string;
  updatedAt: string;
  slidesPresentationId: string | null;
  signature: string;
  sections: {
    ideate: {
      id: "ideate";
      label: string;
      status: SectionStatus;
      notes: string;
    };
    inputs: {
      id: "inputs";
      label: string;
      status: SectionStatus;
    };
    title: {
      id: "title";
      label: string;
      status: SectionStatus;
      topicTitle: string;
    };
    welcome: {
      id: "welcome";
      label: string;
      status: SectionStatus;
      intro: string;
      contents: string;
      closing: string;
      gif: GifSelection;
    };
    onePager: {
      id: "onePager";
      label: string;
      status: SectionStatus;
      greeting: string;
      subjectLine: string;
      bodyPart1: string;
      /** Sidebar callout on one-pager slide 4 */
      callout: string;
      bodyPart2: string;
      gif: GifSelection;
    };
    chat: {
      id: "chat";
      label: string;
      status: SectionStatus;
      message: string;
      gif: GifSelection;
    };
    review: {
      id: "review";
      label: string;
      status: SectionStatus;
    };
  };
};

export const BUILD_SECTION_ORDER: MiniBoxSectionId[] = [
  "welcome",
  "onePagerP1",
  "onePagerP2",
  "chat",
];

export const SECTION_ORDER: MiniBoxSectionId[] = [
  "title",
  ...BUILD_SECTION_ORDER,
  "review",
];

export function normalizeSectionId(id: string): MiniBoxSectionId {
  if (id === "ideate" || id === "inputs") return "title";
  if (id === "onePager") return "onePagerP1";
  if (SECTION_ORDER.includes(id as MiniBoxSectionId)) return id as MiniBoxSectionId;
  return "title";
}

export function createEmptyMiniBox(topic = ""): MiniBoxDocument {
  const now = new Date().toISOString();
  const id = `mb-${Date.now()}`;
  const resolvedTopic = topic || SHADOW_AI_TOPIC;
  const d = SHADOW_AI_SECTION_DEFAULTS;

  return {
    id,
    type: "mini-box",
    title: resolvedTopic,
    topic: resolvedTopic,
    articles: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    slidesPresentationId: null,
    signature: "{{ SIGNATURE }}",
    sections: {
      ideate: {
        id: "ideate",
        label: "Ideate",
        status: "empty",
        notes: "",
      },
      inputs: {
        id: "inputs",
        label: "Topics & Articles",
        status: "draft",
      },
      title: {
        id: "title",
        label: "Topic / Title",
        status: "ready",
        topicTitle: topic || d.title.topicTitle,
      },
      welcome: {
        id: "welcome",
        label: "Welcome Message",
        status: "ready",
        intro: d.welcome.intro,
        contents: d.welcome.contents,
        closing: d.welcome.closing,
        gif: d.welcome.gif,
      },
      onePager: {
        id: "onePager",
        label: "One-Pager / Email",
        status: "ready",
        greeting: d.onePager.greeting,
        subjectLine: d.onePager.subjectLine,
        bodyPart1: d.onePager.bodyPart1,
        callout: d.onePager.callout,
        bodyPart2: d.onePager.bodyPart2,
        gif: d.onePager.gif,
      },
      chat: {
        id: "chat",
        label: "Chat Message",
        status: "ready",
        message: d.chat.message,
        gif: d.chat.gif,
      },
      review: {
        id: "review",
        label: "Review",
        status: "draft",
      },
    },
  };
}

export function createEmptyCiab(topic = ""): MiniBoxDocument {
  const doc = createEmptyMiniBox(topic);
  return {
    ...doc,
    id: `ciab-${Date.now()}`,
    type: "ciab",
    title: topic || "Untitled CIAB",
  };
}

export function sectionNeedsGif(id: MiniBoxSectionId): boolean {
  return id === "welcome" || id === "onePagerP1" || id === "chat";
}

export function deriveSectionStatus(
  doc: MiniBoxDocument,
  sectionId: MiniBoxSectionId,
): SectionStatus {
  if (sectionId === "title") {
    const notes = doc.sections.ideate?.notes?.trim() || "";
    const titleName = doc.sections.title?.topicTitle?.trim() || "";
    if (titleName) return "ready";
    if (notes || doc.topic.trim()) return "draft";
    return "empty";
  }

  if (sectionId === "review") {
    const buildStatuses = BUILD_SECTION_ORDER.map((id) =>
      deriveSectionStatus(doc, id),
    );
    if (buildStatuses.every((s) => s === "ready")) return "ready";
    if (buildStatuses.some((s) => s === "draft" || s === "ready")) return "draft";
    return "empty";
  }

  if (sectionId === "welcome") {
    const s = doc.sections.welcome;
    const filled = s.intro.trim() && s.contents.trim();
    if (!filled) return "empty";
    if (!s.gif) return "draft";
    return "ready";
  }

  if (sectionId === "onePagerP1") {
    const s = doc.sections.onePager;
    const filled =
      s.greeting.trim() &&
      s.subjectLine.trim() &&
      s.bodyPart1.trim() &&
      s.callout.trim();
    if (!filled) return "empty";
    if (!s.gif) return "draft";
    return "ready";
  }

  if (sectionId === "onePagerP2") {
    const s = doc.sections.onePager;
    if (!s.bodyPart2.trim()) return "empty";
    return "ready";
  }

  if (sectionId === "chat") {
    const s = doc.sections.chat;
    if (!s.message.trim()) return "empty";
    if (!s.gif) return "draft";
    return "ready";
  }

  return "empty";
}
