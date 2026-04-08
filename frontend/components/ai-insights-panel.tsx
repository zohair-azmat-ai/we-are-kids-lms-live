"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAIInsights, type AIInsightsResponse } from "@/lib/api";

const severityStyles = {
  info: "border-sky-100 bg-sky-50 text-sky-900",
  warning: "border-amber-100 bg-amber-50 text-amber-900",
  critical: "border-red-100 bg-red-50 text-red-900",
} as const;

const severityLabels = {
  info: "Recommendation",
  warning: "Priority",
  critical: "Urgent",
} as const;

type AIInsightsPanelProps = {
  title?: string;
};

export function AIInsightsPanel({
  title = "AI Insights",
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInsights() {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetchAIInsights();
        setInsights(response);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load AI insights.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInsights();
  }, []);

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
            {title}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-800">
            Smart alerts and recommendations
          </h2>
        </div>
        {insights ? (
          <p className="text-xs text-slate-500">
            Updated {new Date(insights.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          Generating AI insights...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-red-600">
          {error}
        </div>
      ) : insights ? (
        <>
          <div className="mt-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">{insights.summary}</p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {insights.items.map((item) => (
              <article
                key={item.id}
                className={`rounded-[1.75rem] border p-4 ${severityStyles[item.severity]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                    {severityLabels[item.severity]}
                  </p>
                  <span className="rounded-full border border-current px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {item.severity}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7">{item.message}</p>
                {item.cta_label && item.cta_href ? (
                  <Link
                    href={item.cta_href}
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-current px-4 py-2 text-sm font-semibold"
                  >
                    {item.cta_label}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          No AI insights are available right now.
        </div>
      )}
    </section>
  );
}
