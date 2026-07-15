"use client";

import { AppShell } from "@/components/layout/AppShell";
import { DriveFolderPicker } from "@/components/knowledge/DriveFolderPicker";
import {
  loadKnowledgeSettings,
  saveKnowledgeSettings,
  parseDriveFolderId,
  type BoxType,
} from "@/lib/knowledge-store";
import {
  CLAUDE_MODEL_OPTIONS,
  fetchAppSettings,
  saveAppSettings,
} from "@/lib/app-settings-client";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/claude-models";
import {
  DEFAULT_GENERATION_PROMPTS,
  type GenerationPromptsConfig,
} from "@/lib/mini-box-prompts";
import {
  DEFAULT_TOPIC_RESEARCH_PROMPTS,
  type TopicResearchPromptsConfig,
} from "@/lib/mini-box-topic-prompts";
import {
  DEFAULT_SLACK_REVIEW,
  resolveSlackReview,
} from "@/lib/slack/review-settings";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState(loadKnowledgeSettings());
  const [miniBoxUrl, setMiniBoxUrl] = useState(
    settings["mini-box"]?.folderUrl ?? "",
  );
  const [ciabUrl, setCiabUrl] = useState(settings.ciab?.folderUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [activePicker, setActivePicker] = useState<BoxType | null>(null);
  const [claudeModel, setClaudeModel] = useState(DEFAULT_CLAUDE_MODEL);
  const [generationPrompts, setGenerationPrompts] = useState<GenerationPromptsConfig>(
    DEFAULT_GENERATION_PROMPTS,
  );
  const [topicResearchPrompts, setTopicResearchPrompts] =
    useState<TopicResearchPromptsConfig>(DEFAULT_TOPIC_RESEARCH_PROMPTS);
  const [csmUserIds, setCsmUserIds] = useState(
    DEFAULT_SLACK_REVIEW.csmUserIds.join(", "),
  );
  const [morganUserId, setMorganUserId] = useState<string>(
    DEFAULT_SLACK_REVIEW.morganUserId,
  );
  const [slackMembers, setSlackMembers] = useState<
    Array<{ id: string; realName: string; displayName: string; title?: string }>
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) {
      setLoadingSettings(false);
      return;
    }
    void (async () => {
      try {
        const remote = await fetchAppSettings();
        if (remote?.knowledgeFolders) {
          const merged = { ...loadKnowledgeSettings(), ...remote.knowledgeFolders };
          saveKnowledgeSettings(merged);
          setSettings(merged);
          setMiniBoxUrl(merged["mini-box"]?.folderUrl ?? "");
          setCiabUrl(merged.ciab?.folderUrl ?? "");
        }
        if (remote?.claudeModel) setClaudeModel(remote.claudeModel);
        if (remote?.generationPrompts) {
          setGenerationPrompts({
            ...DEFAULT_GENERATION_PROMPTS,
            ...remote.generationPrompts,
          });
        }
        if (remote?.topicResearchPrompts) {
          setTopicResearchPrompts({
            ...DEFAULT_TOPIC_RESEARCH_PROMPTS,
            ...remote.topicResearchPrompts,
          });
        }
        const resolvedSlack = resolveSlackReview(remote?.slackReview);
        setCsmUserIds(resolvedSlack.csmUserIds.join(", "));
        setMorganUserId(resolvedSlack.morganUserId);
      } catch (err) {
        setSettingsError(
          err instanceof Error ? err.message : "Could not load shared settings.",
        );
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, [session?.accessToken]);

  function slackReviewPayload() {
    return {
      csmUserIds: csmUserIds
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      morganUserId: morganUserId.trim() || undefined,
    };
  }

  async function persistRemote(
    nextSettings: typeof settings,
    nextModel: string,
    nextPrompts: GenerationPromptsConfig = generationPrompts,
    nextTopicPrompts: TopicResearchPromptsConfig = topicResearchPrompts,
  ) {
    if (!session?.accessToken) return;
    await saveAppSettings({
      claudeModel: nextModel,
      knowledgeFolders: nextSettings,
      generationPrompts: nextPrompts,
      topicResearchPrompts: nextTopicPrompts,
      slackReview: slackReviewPayload(),
    });
  }

  function save(type: BoxType, url: string, folderName?: string) {
    const folderId = parseDriveFolderId(url);
    if (!folderId) return;
    const next = { ...settings };
    next[type] = {
      folderId,
      folderUrl: url.trim(),
      folderName,
      setAt: new Date().toISOString(),
    };
    saveKnowledgeSettings(next);
    setSettings(next);
    if (type === "mini-box") setMiniBoxUrl(url.trim());
    if (type === "ciab") setCiabUrl(url.trim());
    setSaved(true);
    setActivePicker(null);
    setSettingsError(null);
    void persistRemote(next, claudeModel).catch((err) => {
      setSettingsError(
        err instanceof Error ? err.message : "Saved locally but not to shared Drive.",
      );
    });
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveClaudeModel(model: string) {
    setClaudeModel(model);
    setSettingsError(null);
    try {
      await saveAppSettings({
        claudeModel: model,
        knowledgeFolders: settings,
        generationPrompts,
        topicResearchPrompts,
        slackReview: slackReviewPayload(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not save Claude model.",
      );
    }
  }

  async function saveGenerationPrompts() {
    setSettingsError(null);
    try {
      await saveAppSettings({
        claudeModel,
        knowledgeFolders: settings,
        generationPrompts,
        topicResearchPrompts,
        slackReview: slackReviewPayload(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not save generation prompts.",
      );
    }
  }

  async function saveTopicResearchPrompts() {
    setSettingsError(null);
    try {
      await saveAppSettings({
        claudeModel,
        knowledgeFolders: settings,
        generationPrompts,
        topicResearchPrompts,
        slackReview: slackReviewPayload(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not save topic research prompts.",
      );
    }
  }

  async function saveSlackReviewSettings() {
    setSettingsError(null);
    try {
      await saveAppSettings({
        claudeModel,
        knowledgeFolders: settings,
        generationPrompts,
        topicResearchPrompts,
        slackReview: slackReviewPayload(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not save Slack review settings.",
      );
    }
  }

  async function fetchSlackMembers(query = "") {
    setLoadingMembers(true);
    setSettingsError(null);
    try {
      const url = query
        ? `/api/slack/members?q=${encodeURIComponent(query)}`
        : "/api/slack/members";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Slack members.");
      setSlackMembers(data.members || []);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Could not load Slack members.",
      );
      setSlackMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  function appendCsmId(id: string) {
    const ids = new Set(
      csmUserIds
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
    ids.add(id);
    setCsmUserIds(Array.from(ids).join(", "));
  }

  function resetTopicResearchPrompts() {
    setTopicResearchPrompts(DEFAULT_TOPIC_RESEARCH_PROMPTS);
  }

  function resetGenerationPrompts() {
    setGenerationPrompts(DEFAULT_GENERATION_PROMPTS);
  }

  function saveFromPicker(
    type: BoxType,
    folder: { id: string; name: string; webViewLink?: string },
  ) {
    save(
      type,
      folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
      folder.name,
    );
  }

  return (
    <AppShell
      topBar={
        <header className="flex h-14 items-center border-b border-[var(--border)] px-6 text-sm text-[var(--text-muted)]">
          Settings
        </header>
      }
    >
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-4 p-6 pb-12">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Account</h2>
          {session?.user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Signed in as{" "}
                <span className="text-[var(--text)]">{session.user.email}</span>
              </p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-[var(--text-muted)]">
                Connect Google to browse Drive folders in Knowledge Base.
              </p>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/settings" })}
                className="mt-3 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
              >
                Connect Google
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h1 className="text-base font-medium">Knowledge Base folders</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Choose Google Drive archive folders for each box type. Browse folders
            in-app or paste a link.
          </p>

          {(["mini-box", "ciab"] as BoxType[]).map((type) => {
            const label = type === "mini-box" ? "Mini Box folder" : "CIAB folder";
            const url = type === "mini-box" ? miniBoxUrl : ciabUrl;
            const setUrl = type === "mini-box" ? setMiniBoxUrl : setCiabUrl;
            const configured = settings[type];

            return (
              <div key={type} className="mt-5 border-t border-[var(--border)] pt-5 first:mt-4 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-dim)]">
                    {label}
                  </span>
                  {configured?.folderName && (
                    <span className="truncate text-xs text-[var(--accent)]">
                      {configured.folderName}
                    </span>
                  )}
                </div>

                {session?.accessToken && activePicker === type ? (
                  <div className="mt-3">
                    <DriveFolderPicker
                      onSelect={(folder) => saveFromPicker(type, folder)}
                    />
                    <button
                      type="button"
                      onClick={() => setActivePicker(null)}
                      className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel browse
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/…"
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => save(type, url, configured?.folderName)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                      >
                        Save {type === "mini-box" ? "Mini Box" : "CIAB"} folder
                      </button>
                      {session?.accessToken && (
                        <button
                          type="button"
                          onClick={() => setActivePicker(type)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--accent)]"
                        >
                          Browse Drive…
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {saved && (
            <p className="mt-3 text-xs text-[var(--accent)]">Saved.</p>
          )}
          {settingsError && (
            <p className="mt-3 text-xs text-[var(--danger)]">{settingsError}</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">AI (Anthropic Claude)</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Choose the default Claude model for the whole app — Knowledge Base Q&amp;A,
            AI generate, and research. Saved to shared Google Drive so everyone on
            the team uses the same model. Builder section tabs can still override
            per section in this browser.
          </p>

          {session?.accessToken ? (
            <div className="mt-4">
              <label className="text-xs font-medium text-[var(--text-dim)]">
                Default Claude model
              </label>
              <select
                value={claudeModel}
                disabled={loadingSettings}
                onChange={(e) => void saveClaudeModel(e.target.value)}
                className="mt-2 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm disabled:opacity-50"
              >
                {CLAUDE_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-[var(--text-dim)]">
                Stored in your team&apos;s <strong>Box Studio Data</strong> folder on
                Google Drive. Re-connect Google once if indexing or saving fails
                (new write permission).
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Connect Google above to change the shared Claude model.
            </p>
          )}

          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Local development
              </div>
              <p className="mt-1">
                Add to <code className="text-[var(--text)]">.env.local</code> in the project root:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text)]">
{`ANTHROPIC_API_KEY=sk-ant-...
# optional:
ANTHROPIC_MODEL=claude-sonnet-4-6`}
              </pre>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Production (Vercel)
              </div>
              <p className="mt-1">
                Vercel project → Settings → Environment Variables → add{" "}
                <code className="text-[var(--text)]">ANTHROPIC_API_KEY</code>, then redeploy.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Mini Box generation prompts</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Configure the prompts used after a topic is selected — for outline
            generation, full mini box generation, and Slack{" "}
            <code className="text-[var(--text)]">/mini-box</code> commands. Saved
            to shared Google Drive. Template variables:{" "}
            <code className="text-[var(--text)]">{"{{topic}}"}</code>,{" "}
            <code className="text-[var(--text)]">{"{{notes}}"}</code>,{" "}
            <code className="text-[var(--text)]">{"{{outline}}"}</code>,{" "}
            <code className="text-[var(--text)]">{"{{articles}}"}</code>.
          </p>

          {session?.accessToken ? (
            <div className="mt-4 space-y-4">
              {(
                [
                  ["outlineSystem", "Outline system prompt"],
                  ["outlineUser", "Outline user template"],
                  ["generateSystem", "Full box system prompt"],
                  ["generateFullUser", "Full box user template"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-[var(--text-dim)]">
                    {label}
                  </span>
                  <textarea
                    value={generationPrompts[key] || ""}
                    disabled={loadingSettings}
                    onChange={(e) =>
                      setGenerationPrompts((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    rows={key.includes("User") ? 12 : 3}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs leading-relaxed disabled:opacity-50"
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loadingSettings}
                  onClick={() => void saveGenerationPrompts()}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Save prompts
                </button>
                <button
                  type="button"
                  disabled={loadingSettings}
                  onClick={resetGenerationPrompts}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)]"
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Connect Google above to edit shared generation prompts.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Topic research prompts (Slack step 1)</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Used when the Slack bot researches 6 Mini Box candidates. Variable:{" "}
            <code className="text-[var(--text)]">{"{{monthlyCiabTopic}}"}</code>{" "}
            comes from the parsed annual calendar on Drive.
          </p>
          {session?.accessToken ? (
            <div className="mt-4 space-y-4">
              {(
                [
                  ["topicResearchSystem", "Topic research system prompt"],
                  ["topicResearchUser", "Topic research user template"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-[var(--text-dim)]">
                    {label}
                  </span>
                  <textarea
                    value={topicResearchPrompts[key] || ""}
                    disabled={loadingSettings}
                    onChange={(e) =>
                      setTopicResearchPrompts((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    rows={key === "topicResearchUser" ? 16 : 3}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs leading-relaxed disabled:opacity-50"
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loadingSettings}
                  onClick={() => void saveTopicResearchPrompts()}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Save topic prompts
                </button>
                <button
                  type="button"
                  disabled={loadingSettings}
                  onClick={resetTopicResearchPrompts}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)]"
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Connect Google to edit shared topic research prompts.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Slack bot setup</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add the app to any channel, then @mention it or DM it. Works in all
            channels where the bot is invited.
          </p>
          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Bot token scopes (OAuth &amp; Permissions)
              </div>
              <ul className="mt-2 list-inside list-disc text-xs">
                <li><code>app_mentions:read</code> — @mentions in channels</li>
                <li><code>chat:write</code> — post messages and buttons</li>
                <li><code>files:read</code> — calendar photos uploaded in Slack</li>
                <li><code>im:history</code> — direct messages to the bot</li>
                <li><code>channels:history</code> — read thread context (public channels)</li>
                <li><code>groups:history</code> — private channels the bot is in</li>
                <li><code>commands</code> — optional slash command</li>
                <li><code>files:write</code> — upload PPTX to threads</li>
                <li><code>users:read</code> — list members for CSM/Morgan picker</li>
                <li><code>users:read.email</code> — optional, show emails in picker</li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Request URLs (Slack app config)
              </div>
              <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--text)]">
                <li>
                  Event Subscriptions:{" "}
                  <span className="text-[var(--accent)]">
                    https://ciabv2-gilt.vercel.app/api/webhooks/slack/events
                  </span>
                </li>
                <li>
                  Interactivity:{" "}
                  <span className="text-[var(--accent)]">
                    https://ciabv2-gilt.vercel.app/api/webhooks/slack/interactions
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Enable Event Subscriptions, subscribe to bot events{" "}
                <code>app_mention</code>, <code>message.im</code>,{" "}
                <code>message.channels</code>, <code>message.groups</code>, then
                click Retry after deploy.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Slash command (optional)
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text)]">
{`Command:        /mini-box
Request URL:    https://ciabv2-gilt.vercel.app/api/webhooks/slack
Short Description: Research topics and generate Mini Boxes
Usage Hint:     topics | help | [topic name]

Examples:
  /mini-box topics
  /mini-box help
  /mini-box Shadow AI`}
              </pre>
            </div>
            {session?.accessToken && (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
                <div className="text-xs font-medium text-[var(--text-dim)]">
                  CSM &amp; Morgan (Slack user IDs — Profile → ⋮ → Copy member ID)
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Defaults are pre-filled (Morgan + Amber, Elise, Nick). Save here
                  to override in Drive; clear a field and save to revert Morgan to
                  default.
                </p>
                <label className="block text-xs">
                  CSM user IDs (comma-separated)
                  <input
                    value={csmUserIds}
                    onChange={(e) => setCsmUserIds(e.target.value)}
                    placeholder="U012ABC, U345DEF"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 font-mono text-xs"
                  />
                </label>
                <label className="block text-xs">
                  Morgan user ID
                  <input
                    value={morganUserId}
                    onChange={(e) => setMorganUserId(e.target.value)}
                    placeholder="U012ABC"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 font-mono text-xs"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveSlackReviewSettings()}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                >
                  Save Slack review settings
                </button>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={loadingMembers}
                    onClick={() => void fetchSlackMembers("morgan")}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] disabled:opacity-50"
                  >
                    Find Morgan
                  </button>
                  <button
                    type="button"
                    disabled={loadingMembers}
                    onClick={() => void fetchSlackMembers("success")}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] disabled:opacity-50"
                  >
                    Find CSMs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCsmUserIds(DEFAULT_SLACK_REVIEW.csmUserIds.join(", "));
                      setMorganUserId(DEFAULT_SLACK_REVIEW.morganUserId);
                    }}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px]"
                  >
                    Reset to defaults
                  </button>
                </div>
                {slackMembers.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[11px]">
                    {slackMembers.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[var(--accent)]">{m.id}</span>
                        <span>
                          {m.realName || m.displayName}
                          {m.title ? ` · ${m.title}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMorganUserId(m.id)}
                          className="text-[var(--text-muted)] underline"
                        >
                          Morgan
                        </button>
                        <button
                          type="button"
                          onClick={() => appendCsmId(m.id)}
                          className="text-[var(--text-muted)] underline"
                        >
                          +CSM
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Event Subscriptions → Request URL
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text)]">
{`https://ciabv2-gilt.vercel.app/api/webhooks/slack/events

Subscribe to bot events:
• app_mention
• message.im
• message.channels
• message.groups`}
              </pre>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Interactivity → Request URL
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text)]">
{`https://ciabv2-gilt.vercel.app/api/webhooks/slack/interactions`}
              </pre>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Vercel env vars
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--text)]">
{`SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
BOX_STUDIO_DATA_FOLDER_ID=...   # shared Drive folder
BOX_STUDIO_GOOGLE_REFRESH_TOKEN=...  # server Drive read/write for Slack`}
              </pre>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                Commands in Slack
              </div>
              <ul className="mt-2 list-inside list-disc text-xs">
                <li><code>@Box Studio topics</code> — 6 topic candidates with Select buttons</li>
                <li>Upload calendar photo + @mention — OCR year/month topics</li>
                <li><code>/mini-box topics</code> — same as above (slash command)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-base font-medium">Export</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Mini Boxes use the Shadow AI master template
            (`mini-box-master.pptx`) for preview and download. New boxes start
            with that example content pre-filled for editing.
          </p>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
