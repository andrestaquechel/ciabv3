import { createHmac, timingSafeEqual } from "crypto";

export function verifySlackSignature(
  signingSecret: string,
  signature: string | null,
  timestamp: string | null,
  rawBody: string,
): boolean {
  if (!signature || !timestamp) return false;
  const fiveMinutes = 60 * 5;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > fiveMinutes) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function slackSigningSecret(): string | undefined {
  return process.env.SLACK_SIGNING_SECRET?.trim() || undefined;
}

export function assertSlackSignature(
  request: Request,
  rawBody: string,
): void {
  const secret = slackSigningSecret();
  if (!secret) return;
  const ok = verifySlackSignature(
    secret,
    request.headers.get("x-slack-signature"),
    request.headers.get("x-slack-request-timestamp"),
    rawBody,
  );
  if (!ok) throw new Error("Invalid Slack signature.");
}
