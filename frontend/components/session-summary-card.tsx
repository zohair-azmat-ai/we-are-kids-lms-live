"use client";

import { useEffect, useState } from "react";

import {
  fetchSessionSummary,
  generateSessionSummary,
  ApiError,
  type SessionSummaryResponse,
} from "@/lib/api";

type Props = {
  sessionId: string;
  /** If true the component will auto-fetch. Pass false to skip until user clicks. */
  autoFetch?: boolean;
};

function SourceBadge({ source }: { source: "ai" | "fallback" }) {
  if (source === "ai") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-700">
        ✦ AI Generated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-500">
      Auto Summary
    </span>
  );
}

export function SessionSummaryCard({ sessionId, autoFetch = true }: Props) {
  const [summary, setSummary] = useState<SessionSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!autoFetch) return;

    async function load() {
      try {
        setIsLoading(true);
        setError("");
        setNotFound(false);
        const data = await fetchSessionSummary(sessionId);
        setSummary(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Unable to load summary.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [sessionId, autoFetch]);

  async function handleGenerate() {
    try {
      setIsGenerating(true);
      setError("");
      setNotFound(false);
      const data = await generateSessionSummary(sessionId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Loading session summary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">No summary generated yet for this session.</p>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="mt-2 inline-flex items-center rounded-full bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow shadow-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isGenerating ? "Generating..." : "Generate Summary"}
        </button>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
          Session Summary
        </p>
        <div className="flex items-center gap-2">
          <SourceBadge source={summary.source_type} />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="rounded-full border border-violet-200 bg-white px-3 py-0.5 text-xs font-semibold text-violet-600 disabled:opacity-60"
          >
            {isGenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{summary.summary_text}</p>

      {summary.key_points.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500">Key Points</p>
          <ul className="mt-1.5 space-y-1">
            {summary.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-violet-400">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.action_items.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500">Follow-up Actions</p>
          <ul className="mt-1.5 space-y-1">
            {summary.action_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-teal-500">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-400">
        Generated {new Date(summary.generated_at).toLocaleString()}
      </p>
    </div>
  );
}
