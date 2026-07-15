"use client";

import type { KnowledgeSettings } from "@/lib/knowledge-store";
import { CLAUDE_MODEL_OPTIONS } from "@/lib/claude-models";

export type AppSettingsResponse = {
  claudeModel?: string;
  knowledgeFolders?: KnowledgeSettings;
  updatedAt?: string;
  updatedBy?: string;
  error?: string;
};

export async function fetchAppSettings(): Promise<AppSettingsResponse | null> {
  const res = await fetch("/api/app-settings", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as AppSettingsResponse;
}

export async function saveAppSettings(
  payload: Pick<AppSettingsResponse, "claudeModel" | "knowledgeFolders">,
): Promise<AppSettingsResponse | null> {
  const res = await fetch("/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as AppSettingsResponse;
  if (!res.ok) throw new Error(data.error || "Failed to save app settings.");
  return data;
}

export { CLAUDE_MODEL_OPTIONS };
