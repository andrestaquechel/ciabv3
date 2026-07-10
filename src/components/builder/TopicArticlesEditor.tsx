"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { MiniBoxDocument, SourceArticle } from "@/lib/mini-box";
import { StatusPill } from "@/components/builder/SectionNav";
import { deriveSectionStatus } from "@/lib/mini-box";

function newArticle(): SourceArticle {
  return {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    url: "",
    notes: "",
  };
}

export function TopicArticlesEditor({
  document,
  onChange,
}: {
  document: MiniBoxDocument;
  onChange: (next: MiniBoxDocument) => void;
}) {
  const [suggesting, setSuggesting] = useState<"topics" | "articles" | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<{
    topics?: string[];
    articles?: Array<{ title: string; url: string; notes: string }>;
    note?: string;
  } | null>(null);
  const status = deriveSectionStatus(document, "inputs");

  function updateTopic(topic: string) {
    onChange({
      ...document,
      topic,
      title: topic || "Untitled Mini Box",
      updatedAt: new Date().toISOString(),
      sections: {
        ...document.sections,
        title: {
          ...document.sections.title,
          topicTitle: topic,
        },
      },
    });
  }

  function updateArticles(articles: SourceArticle[]) {
    onChange({
      ...document,
      articles,
      updatedAt: new Date().toISOString(),
    });
  }

  async function suggest(kind: "topics" | "articles") {
    setSuggesting(kind);
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          topic: document.topic,
          articles: document.articles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestion failed");
      setSuggestions(data);
    } catch (err) {
      setSuggestions({
        note: err instanceof Error ? err.message : "Suggestion failed",
      });
    } finally {
      setSuggesting(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Topic & Articles</h2>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Start with a topic and source articles. AI can suggest both.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-5 scrollbar-thin">
        <label className="block">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
            Topic
          </div>
          <input
            value={document.topic}
            onChange={(e) => updateTopic(e.target.value)}
            placeholder="e.g. When AI Follows the Wrong Instructions"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!suggesting}
            onClick={() => void suggest("topics")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {suggesting === "topics" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Suggest topics
          </button>
          <button
            type="button"
            disabled={!!suggesting || !document.topic.trim()}
            onClick={() => void suggest("articles")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {suggesting === "articles" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Find related articles
          </button>
        </div>

        {suggestions?.note && (
          <p className="text-[11px] text-[var(--text-dim)]">{suggestions.note}</p>
        )}

        {suggestions?.topics && suggestions.topics.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              Topic ideas
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => updateTopic(topic)}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions?.articles && suggestions.articles.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              Article suggestions
            </div>
            <div className="space-y-2">
              {suggestions.articles.map((article, idx) => (
                <button
                  key={`${article.title}-${idx}`}
                  type="button"
                  onClick={() =>
                    updateArticles([
                      ...document.articles,
                      {
                        id: `art-${Date.now()}-${idx}`,
                        title: article.title,
                        url: article.url,
                        notes: article.notes,
                      },
                    ])
                  }
                  className="block w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-left hover:border-[var(--accent)]/50"
                >
                  <div className="text-sm">{article.title}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-dim)]">
                    {article.notes || article.url}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              Source articles
            </div>
            <button
              type="button"
              onClick={() => updateArticles([...document.articles, newArticle()])}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)]"
            >
              <Plus size={12} />
              Add article
            </button>
          </div>

          <div className="space-y-3">
            {document.articles.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-dim)]">
                No articles yet. Add links/notes manually or use AI suggestions.
              </p>
            )}
            {document.articles.map((article, index) => (
              <div
                key={article.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs text-[var(--text-dim)]">
                    Article {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateArticles(
                        document.articles.filter((a) => a.id !== article.id),
                      )
                    }
                    className="text-[var(--text-dim)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    value={article.title}
                    onChange={(e) =>
                      updateArticles(
                        document.articles.map((a) =>
                          a.id === article.id
                            ? { ...a, title: e.target.value }
                            : a,
                        ),
                      )
                    }
                    placeholder="Article title"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    value={article.url}
                    onChange={(e) =>
                      updateArticles(
                        document.articles.map((a) =>
                          a.id === article.id
                            ? { ...a, url: e.target.value }
                            : a,
                        ),
                      )
                    }
                    placeholder="https://…"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <textarea
                    value={article.notes}
                    onChange={(e) =>
                      updateArticles(
                        document.articles.map((a) =>
                          a.id === article.id
                            ? { ...a, notes: e.target.value }
                            : a,
                        ),
                      )
                    }
                    rows={3}
                    placeholder="Key points to use in the Mini Box…"
                    className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
