import { describe, it, expect } from "vitest";
import {
  DEFAULT_CLAUDE_MODEL,
  TOPIC_RESEARCH_CLAUDE_MODEL,
  isValidClaudeModel,
  resolveClaudeModel,
  resolveTopicResearchModel,
  claudeModelLabel,
  modelSupportsTemperature,
} from "@/lib/claude-models";

describe("isValidClaudeModel", () => {
  it("accepts a known model id", () => {
    expect(isValidClaudeModel("claude-sonnet-4-6")).toBe(true);
  });

  it("rejects an unknown model id", () => {
    expect(isValidClaudeModel("gpt-4o")).toBe(false);
  });
});

describe("resolveClaudeModel", () => {
  it("returns the preferred model when it is valid", () => {
    expect(resolveClaudeModel("claude-opus-4-8")).toBe("claude-opus-4-8");
  });

  it("maps a legacy alias to a current model", () => {
    expect(resolveClaudeModel("claude-sonnet-4-20250514")).toBe(
      DEFAULT_CLAUDE_MODEL,
    );
  });

  it("falls back to the env default when preferred is missing", () => {
    expect(resolveClaudeModel(undefined, "claude-sonnet-5")).toBe(
      "claude-sonnet-5",
    );
  });

  it("falls back to the default when nothing valid is provided", () => {
    expect(resolveClaudeModel("nonsense", "also-nonsense")).toBe(
      DEFAULT_CLAUDE_MODEL,
    );
  });
});

describe("resolveTopicResearchModel", () => {
  it("keeps an explicit opus preference", () => {
    expect(resolveTopicResearchModel("claude-opus-4-6")).toBe("claude-opus-4-6");
  });

  it("forces the research model when a non-opus model is preferred", () => {
    expect(resolveTopicResearchModel("claude-sonnet-4-6")).toBe(
      TOPIC_RESEARCH_CLAUDE_MODEL,
    );
  });
});

describe("claudeModelLabel", () => {
  it("returns the friendly label for a known model", () => {
    expect(claudeModelLabel("claude-opus-4-8")).toBe("Claude Opus 4.8");
  });

  it("echoes the id for an unknown model", () => {
    expect(claudeModelLabel("mystery-model")).toBe("mystery-model");
  });
});

describe("modelSupportsTemperature", () => {
  it("is false for opus 4.8", () => {
    expect(modelSupportsTemperature("claude-opus-4-8")).toBe(false);
  });

  it("is true for sonnet", () => {
    expect(modelSupportsTemperature("claude-sonnet-4-6")).toBe(true);
  });
});
