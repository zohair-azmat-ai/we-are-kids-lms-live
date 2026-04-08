"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAIInsights, type AIInsightsResponse } from "@/lib/api";

const severityCard = {
  info: "border-sky-100 bg-sky-50/50",
  warning: "border-amber-100 bg-amber-50/50",
  critical: "border-rose-100 bg-rose-50/50",
} as const;

const severityLabel = {
  info: { text: "Recommendation", dot: "bg-sky-400", badge: "text-sky-700 bg-sky-100" },
  warning: { text: "Priority", dot: "bg-amber-400", badge: "text-amber-700 bg-amber-100" },
  critical: { text: "Urgent", dot: "bg-rose-500", badge: "text-rose-700 bg-rose-100" },
} as const;

const severityTitle = {
  info: "text-slate-800",
  warning: "text-amber-950",
  critical: "text-rose-950",
} as const;

const severityBody = {
  info: "text-slate-600",
  warning: "text-amber-900",
  critical: "text-rose-900",
} as const;

const severityCta = {
  info: "border-sky-200 text-sky-800 hover:bg-sky-100",
  warning: "border-amber-200 text-amber-800 hover:bg-amber-100",
  critical: "border-rose-200 text-rose-800 hover:bg-rose-100",
} as const;

type AIInsightsPanelProps = {
  title?: string;
  lazy?: boolean;
};

function InsightsSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-5">
      <div className="h-12 rounded-2xl bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 rounded-[1.75rem] bg-slate-100" />
        <div className="h-40 rounded-[1.75rem] bg-slate-100" />
      </div>
    </div>
  );
}

export function AIInsightsPanel({
  title = "AI Insights",
  lazy = true,
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetchAIInsights();
      setInsights(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Insights are temporarily unavailable.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lazy) {
      void loadInsights();
      return;
    }

    let isCancelled = false;
    const runLoad = () => {
      if (!isCancelled) void loadInsights();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(runLoad, { timeout: 1200 });
      return () => {
        isCancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timerId = globalThis.setTimeout(runLoad, 700);
    return () => {
      isCancelled = true;
      globalThis.clearTimeout(timerId);
    };
  }, [lazy, loadInsights]);

  const visibleItems = useMemo(() => {
    if (!insights) return [];
    const seen = new Map<string, AIInsightsResponse["items"][number]>();
    for (const item of insights.items) {
      const key = item.alert_type ?? item.id.split("-")[0];
      if (!seen.has(key)) seen.set(key, item);
    }
    return Array.from(seen.values()).slice(0, 3);
  }, [insights]);

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-500">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
            Smart alerts &amp; recommendations
          </h2>
        </div>
        {insights ? (
          <p className="shrink-0 text-xs text-slate-400">
            {new Date(insights.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <InsightsSkeleton />
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/60 px-5 py-4">
          <p className="text-sm text-rose-700">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadInsights()}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 active:scale-95"
          >
            Retry
          </button>
        </div>
      ) : insights ? (
        <>
          {insights.summary ? (
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-sm font-medium leading-relaxed text-slate-600">
                {insights.summary}
              </p>
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {visibleItems.map((item) => (
              <article
                key={item.alert_type ?? item.id}
                className={`rounded-[1.75rem] border p-5 ${severityCard[item.severity]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${severityLabel[item.severity].dot}`} />
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {severityLabel[item.severity].text}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${severityLabel[item.severity].badge}`}>
                    {item.severity}
                  </span>
                </div>
                <h3 className={`mt-3 text-base font-semibold leading-snug ${severityTitle[item.severity]}`}>
                  {item.title}
                </h3>
                <p className={`mt-2 text-sm leading-6 ${severityBody[item.severity]}`}>
                  {item.message}
                </p>
                {item.cta_label && item.cta_href ? (
                  <Link
                    href={item.cta_href}
                    className={`mt-4 inline-flex items-center justify-center rounded-full border bg-white/70 px-4 py-2 text-sm font-semibold transition active:scale-95 ${severityCta[item.severity]}`}
                  >
                    {item.cta_label}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm text-slate-500">
          No insights available right now.
        </div>
      )}
    </section>
  );
}
