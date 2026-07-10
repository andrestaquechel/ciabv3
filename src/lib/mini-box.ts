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

export type MiniBoxSectionId =
  | "inputs"
  | "title"
  | "welcome"
  | "onePager"
  | "chat";

export type MiniBoxDocument = {
  id: string;
  type: "mini-box";
  title: string;
  topic: string;
  articles: SourceArticle[];
  status: "draft" | "review" | "published";
  createdAt: string;
  updatedAt: string;
  slidesPresentationId: string | null;
  signature: string;
  sections: {
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
  };
};

export const SECTION_ORDER: MiniBoxSectionId[] = [
  "inputs",
  "title",
  "welcome",
  "onePager",
  "chat",
];

export function createEmptyMiniBox(topic = ""): MiniBoxDocument {
  const now = new Date().toISOString();
  const id = `mb-${Date.now()}`;

  return {
    id,
    type: "mini-box",
    title: topic || "Untitled Mini Box",
    topic,
    articles: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    slidesPresentationId: null,
    signature: "{{ SIGNATURE }}",
    sections: {
      inputs: {
        id: "inputs",
        label: "Topic & Articles",
        status: topic ? "draft" : "empty",
      },
      title: {
        id: "title",
        label: "Cover / Title",
        status: topic ? "draft" : "empty",
        topicTitle: topic,
      },
      welcome: {
        id: "welcome",
        label: "Welcome Message",
        status: "empty",
        intro: "",
        contents: "",
        closing:
          "You are absolutely free to edit and customize the content we send. Make this Mini Box your own! Please don't hesitate to let us know if there's something you would like to see in the future.\n\nThe Living Security Team",
        gif: null,
      },
      onePager: {
        id: "onePager",
        label: "One-Pager / Email",
        status: "empty",
        greeting: "Hey, Team!",
        subjectLine: "",
        bodyPart1: "",
        bodyPart2: "",
        gif: null,
      },
      chat: {
        id: "chat",
        label: "Chat Message",
        status: "empty",
        message: "",
        gif: null,
      },
    },
  };
}

export function sectionNeedsGif(id: MiniBoxSectionId): boolean {
  return id === "welcome" || id === "onePager" || id === "chat";
}

export function deriveSectionStatus(
  doc: MiniBoxDocument,
  sectionId: MiniBoxSectionId,
): SectionStatus {
  const section = doc.sections[sectionId];

  if (sectionId === "inputs") {
    const hasTopic = doc.topic.trim().length > 0;
    const hasArticles = doc.articles.some(
      (a) => a.title.trim() || a.url.trim() || a.notes.trim(),
    );
    if (!hasTopic && !hasArticles) return "empty";
    if (hasTopic && hasArticles) return "ready";
    return "draft";
  }

  if (section.id === "title") {
    return section.topicTitle.trim() ? "draft" : "empty";
  }
  if (section.id === "welcome") {
    const filled = section.intro.trim() && section.contents.trim();
    if (!filled) return "empty";
    if (!section.gif) return "draft";
    return "ready";
  }
  if (section.id === "onePager") {
    const filled =
      section.subjectLine.trim() &&
      section.bodyPart1.trim() &&
      section.bodyPart2.trim();
    if (!filled) return "empty";
    if (!section.gif) return "draft";
    return "ready";
  }
  if (section.id === "chat") {
    if (!section.message.trim()) return "empty";
    if (!section.gif) return "draft";
    return "ready";
  }
  return "empty";
}
