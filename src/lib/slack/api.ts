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
  const data = (await res.json()) as { ok: boolean; error?: string; ts?: string };
  if (!data.ok) throw new Error(data.error || "Slack chat.postMessage failed.");
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
  if (mime.includes("jpeg") || mime.includes("jpg")) return "image/jpeg";
  if (mime.includes("gif")) return "image/gif";
  if (mime.includes("webp")) return "image/webp";
  return "image/png";
}
