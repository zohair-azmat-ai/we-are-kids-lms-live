"use client";

import type { ActivityPoint } from "@/lib/api";

type AnalyticsBarChartProps = {
  title: string;
  subtitle: string;
  points: ActivityPoint[];
  accentClassName: string;
};

export function AnalyticsBarChart({
  title,
  subtitle,
  points,
  accentClassName,
}: AnalyticsBarChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <section className="rounded-[1.85rem] border border-slate-100 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5 grid grid-cols-7 items-end gap-3">
        {points.map((point) => (
          <div key={point.label} className="flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-slate-400">{point.value}</div>
            <div className="flex h-28 w-full items-end rounded-full bg-white px-1 py-1">
              <div
                className={`w-full rounded-full ${accentClassName}`}
                style={{
                  height: `${Math.max(14, Math.round((point.value / maxValue) * 100))}%`,
                }}
              />
            </div>
            <div className="text-xs font-semibold text-slate-500">{point.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
