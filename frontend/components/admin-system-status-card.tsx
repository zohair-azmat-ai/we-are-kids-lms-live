"use client";

import { useEffect, useState } from "react";

import { fetchHealth, fetchBillingUsage, type BillingUsageSummary, type HealthResponse } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const badgeStyles = {
  ready: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-800",
  off: "bg-red-100 text-red-700",
} as const;

function StatusPill({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          ready ? badgeStyles.ready : badgeStyles.pending
        }`}
      >
        {ready ? "Yes" : "No"}
      </span>
    </div>
  );
}

export function AdminSystemStatusCard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [usage, setUsage] = useState<BillingUsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStatus() {
      if (!user || user.role !== "admin") {
        return;
      }

      try {
        setError("");
        const [healthResponse, usageResponse] = await Promise.all([
          fetchHealth(),
          fetchBillingUsage(user.email),
        ]);
        setHealth(healthResponse);
        setUsage(usageResponse);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load system status.",
        );
      }
    }

    void loadStatus();
  }, [user]);

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            System Status
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-800">
            Production readiness snapshot
          </h2>
        </div>
        {health ? (
          <span
            className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
              health.status === "healthy" ? badgeStyles.ready : badgeStyles.off
            }`}
          >
            {health.status === "healthy" ? "Backend Connected" : "Attention Needed"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
          {error}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <StatusPill label="Backend connected" ready={health?.status === "healthy"} />
          <StatusPill label="AI configured" ready={Boolean(health?.ai_configured)} />
          <StatusPill label="Agora RTC" ready={Boolean(health?.agora_configured)} />
          <StatusPill label="Stripe configured" ready={Boolean(health?.billing_configured)} />
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Current plan
            </p>
            <p className="mt-2 text-sm font-semibold capitalize text-slate-800">
              {usage?.plan ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Environment
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {health?.environment ?? "Unknown"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
