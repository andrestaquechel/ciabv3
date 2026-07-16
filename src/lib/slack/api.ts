function botToken(): string {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured.");
  return token;
}

export async function slackPostMessage({
  channel,
  text,
  blocks,
  threadTs,
}: {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
      thread_ts: threadTs,
      unfurl_links: false,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    ts?: string;
    response_metadata?: { messages?: string[] };
  };
  if (!data.ok) {
    const detail = data.response_metadata?.messages?.length
      ? ` (${data.response_metadata.messages.join("; ")})`
      : "";
    throw new Error(`${data.error || "Slack chat.postMessage failed."}${detail}`);
  }
  return data;
}

export async function slackDownloadFile(fileId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  name?: string;
}> {
  const infoRes = await fetch(
    `https://slack.com/api/files.info?file=${encodeURIComponent(fileId)}`,
    { headers: { Authorization: `Bearer ${botToken()}` } },
  );
  const info = (await infoRes.json()) as {
    ok: boolean;
    error?: string;
    file?: { url_private_download?: string; mimetype?: string; name?: string };
  };
  if (!info.ok || !info.file?.url_private_download) {
    throw new Error(info.error || "Could not read Slack file info.");
  }

  const fileRes = await fetch(info.file.url_private_download, {
    headers: { Authorization: `Bearer ${botToken()}` },
  });
  if (!fileRes.ok) throw new Error("Could not download Slack file.");
  const arrayBuffer = await fileRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: info.file.mimetype || "image/png",
    name: info.file.name,
  };
}

export function imageMediaType(
  mime: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const lower = mime.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg") || lower.includes("heic") || lower.includes("heif")) {
    return "image/jpeg";
  }
  if (lower.includes("gif")) return "image/gif";
  if (lower.includes("webp")) return "image/webp";
  return "image/png";
}

export function isSlackImageMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return lower.startsWith("image/") || lower.includes("heic") || lower.includes("heif");
}

export function isSlackImageFiletype(filetype?: string): boolean {
  if (!filetype) return false;
  const t = filetype.toLowerCase();
  return [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "heic",
    "heif",
    "bmp",
    "tif",
    "tiff",
  ].includes(t);
}

export async function slackGetThreadReplies(channel: string, threadTs: string) {
  const url = new URL("https://slack.com/api/conversations.replies");
  url.searchParams.set("channel", channel);
  url.searchParams.set("ts", threadTs);
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${botToken()}` },
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    messages?: Array<{
      ts: string;
      user?: string;
      text?: string;
      bot_id?: string;
      subtype?: string;
      file?: { id?: string; mimetype?: string; filetype?: string };
      files?: Array<{ id: string; mimetype?: string; filetype?: string }>;
    }>;
  };
  if (!data.ok) throw new Error(data.error || "Could not read thread.");
  return data.messages ?? [];
}

export async function findLatestThreadImageFileId(
  channel: string,
  threadTs: string,
): Promise<string | null> {
  const messages = await slackGetThreadReplies(channel, threadTs);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.bot_id) continue;

    for (const file of msg.files ?? []) {
      if (
        isSlackImageMime(file.mimetype || "") ||
        isSlackImageFiletype(file.filetype)
      ) {
        return file.id;
      }
    }

    if (msg.file?.id) {
      if (
        msg.subtype === "file_share" ||
        isSlackImageMime(msg.file.mimetype || "") ||
        isSlackImageFiletype(msg.file.filetype)
      ) {
        return msg.file.id;
      }
    }
  }
  return null;
}

export async function slackUploadFile({
  channel,
  threadTs,
  buffer,
  filename,
  initialComment,
}: {
  channel: string;
  threadTs?: string;
  buffer: Buffer;
  filename: string;
  initialComment: string;
}) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }),
    filename,
  );
  form.append("channels", channel);
  form.append("initial_comment", initialComment);
  if (threadTs) form.append("thread_ts", threadTs);

  const res = await fetch("https://slack.com/api/files.upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${botToken()}` },
    body: form,
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error || "Slack file upload failed.");
  return data;
}
