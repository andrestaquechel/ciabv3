import PptxGenJS from "pptxgenjs";
import type { MiniBoxDocument, GifSelection } from "@/lib/mini-box";

const COLORS = {
  bg: "0F1117",
  panel: "1A1D27",
  accent: "8B5CF6",
  text: "F4F4F7",
  muted: "A1A1B5",
  dim: "6E6E80",
  divider: "2A2A36",
  white: "FFFFFF",
};

async function gifToDataUrl(gif: GifSelection): Promise<string | null> {
  if (!gif?.url && !gif?.previewUrl) return null;
  const url = gif.previewUrl || gif.url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/gif";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function buildMiniBoxPptx(doc: MiniBoxDocument) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDESCREEN", width: 13.333, height: 7.5 });
  pptx.layout = "WIDESCREEN";
  pptx.author = "Box Studio";
  pptx.title = `Mini Box — ${doc.title || doc.topic || "Untitled"}`;

  const topic =
    doc.sections.title.topicTitle || doc.topic || "Untitled Mini Box";
  const s = doc.sections;

  const [welcomeGif, onePagerGif, chatGif] = await Promise.all([
    gifToDataUrl(s.welcome.gif),
    gifToDataUrl(s.onePager.gif),
    gifToDataUrl(s.chat.gif),
  ]);

  // --- Slide 1: Cover ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.18,
      h: 7.5,
      fill: { color: COLORS.accent },
    });
    slide.addText("MINI BOX", {
      x: 0.8,
      y: 1.6,
      w: 11.5,
      h: 0.4,
      fontSize: 14,
      fontFace: "Arial",
      color: COLORS.accent,
      bold: true,
      charSpacing: 4,
    });
    slide.addText(topic, {
      x: 0.8,
      y: 2.1,
      w: 11.5,
      h: 1.4,
      fontSize: 36,
      fontFace: "Arial",
      color: COLORS.white,
      bold: true,
    });
    slide.addText(
      [
        { text: "Welcome Message for Program Owners", options: { breakLine: true } },
        { text: "One-Pager", options: { breakLine: true } },
        { text: "Chat", options: { breakLine: true } },
      ],
      {
        x: 0.8,
        y: 3.8,
        w: 6,
        h: 1.5,
        fontSize: 16,
        fontFace: "Arial",
        color: COLORS.muted,
        paraSpaceAfter: 8,
      },
    );
  }

  // --- Slide 2: Welcome ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("Welcome Message for Program Owners", {
      x: 0.6,
      y: 0.35,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: "Arial",
      color: COLORS.accent,
      bold: true,
    });
    slide.addText(s.welcome.intro || "", {
      x: 0.6,
      y: 0.9,
      w: welcomeGif ? 7.8 : 12,
      h: 2.2,
      fontSize: 13,
      fontFace: "Arial",
      color: COLORS.text,
      valign: "top",
    });
    slide.addText(s.welcome.contents || "", {
      x: 0.6,
      y: 3.2,
      w: welcomeGif ? 7.8 : 12,
      h: 2.6,
      fontSize: 12,
      fontFace: "Arial",
      color: COLORS.muted,
      valign: "top",
    });
    slide.addText(truncate(s.welcome.closing || "", 280), {
      x: 0.6,
      y: 6.0,
      w: 12,
      h: 1.0,
      fontSize: 11,
      fontFace: "Arial",
      color: COLORS.dim,
      valign: "top",
    });
    if (welcomeGif) {
      slide.addImage({
        data: welcomeGif,
        x: 9.0,
        y: 1.2,
        w: 3.6,
        h: 3.6,
      });
      slide.addText("Via Giphy", {
        x: 9.0,
        y: 4.9,
        w: 3.6,
        h: 0.3,
        fontSize: 10,
        fontFace: "Arial",
        color: COLORS.dim,
        align: "center",
      });
    }
  }

  // --- Slide 3: One-Pager divider ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("One-Pager", {
      x: 0.8,
      y: 3.1,
      w: 11.5,
      h: 1,
      fontSize: 40,
      fontFace: "Arial",
      color: COLORS.white,
      bold: true,
      align: "center",
    });
  }

  // --- Slide 4: One-Pager part 1 ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("Email or One-Pager", {
      x: 0.6,
      y: 0.3,
      w: 5,
      h: 0.3,
      fontSize: 11,
      fontFace: "Arial",
      color: COLORS.dim,
    });
    slide.addText(s.onePager.greeting || "Hey, Team!", {
      x: 0.6,
      y: 0.65,
      w: onePagerGif ? 7.8 : 12,
      h: 0.35,
      fontSize: 14,
      fontFace: "Arial",
      color: COLORS.muted,
    });
    slide.addText(s.onePager.subjectLine || topic, {
      x: 0.6,
      y: 1.1,
      w: onePagerGif ? 7.8 : 12,
      h: 0.7,
      fontSize: 22,
      fontFace: "Arial",
      color: COLORS.white,
      bold: true,
    });
    slide.addText(s.onePager.bodyPart1 || "", {
      x: 0.6,
      y: 2.0,
      w: onePagerGif ? 7.8 : 12,
      h: 4.8,
      fontSize: 13,
      fontFace: "Arial",
      color: COLORS.text,
      valign: "top",
    });
    if (onePagerGif) {
      slide.addImage({
        data: onePagerGif,
        x: 9.0,
        y: 1.4,
        w: 3.6,
        h: 3.6,
      });
      slide.addText("Via Giphy", {
        x: 9.0,
        y: 5.1,
        w: 3.6,
        h: 0.3,
        fontSize: 10,
        fontFace: "Arial",
        color: COLORS.dim,
        align: "center",
      });
    }
  }

  // --- Slide 5: One-Pager part 2 / Email ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("Email Message", {
      x: 0.6,
      y: 0.3,
      w: 5,
      h: 0.3,
      fontSize: 11,
      fontFace: "Arial",
      color: COLORS.dim,
    });
    slide.addText(s.onePager.bodyPart2 || "", {
      x: 0.6,
      y: 0.8,
      w: 12,
      h: 5.8,
      fontSize: 13,
      fontFace: "Arial",
      color: COLORS.text,
      valign: "top",
    });
    slide.addText(doc.signature || "{{ SIGNATURE }}", {
      x: 0.6,
      y: 6.7,
      w: 12,
      h: 0.4,
      fontSize: 12,
      fontFace: "Arial",
      color: COLORS.muted,
    });
  }

  // --- Slide 6: Chats divider ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("Chats", {
      x: 0.8,
      y: 3.1,
      w: 11.5,
      h: 1,
      fontSize: 40,
      fontFace: "Arial",
      color: COLORS.white,
      bold: true,
      align: "center",
    });
  }

  // --- Slide 7: Chat ---
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText("Chat Message", {
      x: 0.6,
      y: 0.35,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: "Arial",
      color: COLORS.accent,
      bold: true,
    });
    slide.addText(s.chat.message || "", {
      x: 0.6,
      y: 0.95,
      w: chatGif ? 7.8 : 12,
      h: 5.8,
      fontSize: 14,
      fontFace: "Arial",
      color: COLORS.text,
      valign: "top",
    });
    if (chatGif) {
      slide.addImage({
        data: chatGif,
        x: 9.0,
        y: 1.5,
        w: 3.6,
        h: 3.6,
      });
      slide.addText("Via Giphy", {
        x: 9.0,
        y: 5.2,
        w: 3.6,
        h: 0.3,
        fontSize: 10,
        fontFace: "Arial",
        color: COLORS.dim,
        align: "center",
      });
    }
  }

  return pptx;
}

export function pptxFilename(doc: MiniBoxDocument) {
  const base = (doc.title || doc.topic || "Mini-Box")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `Mini-Box-${base || "Untitled"}.pptx`;
}
