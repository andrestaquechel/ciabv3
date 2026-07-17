// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import { verifySlackSignature, slackSigningSecret } from "@/lib/slack/verify";

const SECRET = "test-signing-secret";

function sign(secret: string, timestamp: string, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  return `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
}

describe("verifySlackSignature", () => {
  beforeEach(() => {
    // Freeze time so timestamp freshness checks are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = () => Math.floor(new Date("2026-07-16T00:00:00Z").getTime() / 1000);

  it("accepts a correctly signed, fresh request", () => {
    const ts = String(now());
    const body = "token=abc&command=/mini-box";
    const sig = sign(SECRET, ts, body);
    expect(verifySlackSignature(SECRET, sig, ts, body)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = String(now());
    const sig = sign(SECRET, ts, "original");
    expect(verifySlackSignature(SECRET, sig, ts, "tampered")).toBe(false);
  });

  it("rejects a wrong signing secret", () => {
    const ts = String(now());
    const body = "hello";
    const sig = sign("other-secret", ts, body);
    expect(verifySlackSignature(SECRET, sig, ts, body)).toBe(false);
  });

  it("rejects a stale timestamp (replay protection, >5 min)", () => {
    const staleTs = String(now() - 6 * 60);
    const body = "hello";
    const sig = sign(SECRET, staleTs, body);
    expect(verifySlackSignature(SECRET, sig, staleTs, body)).toBe(false);
  });

  it("rejects when signature or timestamp is missing", () => {
    expect(verifySlackSignature(SECRET, null, String(now()), "b")).toBe(false);
    expect(verifySlackSignature(SECRET, "v0=abc", null, "b")).toBe(false);
  });
});

describe("slackSigningSecret", () => {
  const original = process.env.SLACK_SIGNING_SECRET;
  afterEach(() => {
    process.env.SLACK_SIGNING_SECRET = original;
  });

  it("returns a trimmed secret when set", () => {
    process.env.SLACK_SIGNING_SECRET = "  padded  ";
    expect(slackSigningSecret()).toBe("padded");
  });

  it("returns undefined when unset or blank", () => {
    process.env.SLACK_SIGNING_SECRET = "   ";
    expect(slackSigningSecret()).toBeUndefined();
  });
});
