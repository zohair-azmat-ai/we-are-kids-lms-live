"use client";

import { useEffect, useState } from "react";

import { fetchHealth, getApiBaseUrl, type HealthResponse } from "@/lib/api";

type StatusState = {
  loading: boolean;
  connected: boolean;
  data: HealthResponse | null;
  error: string | null;
};

const initialState: StatusState = {
  loading: true,
  connected: false,
  data: null,
  error: null,
};

export function BackendStatus() {
  const [state, setState] = useState<StatusState>(initialState);

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const data = await fetchHealth();

        if (!mounted) {
          return;
        }

        setState({
          loading: false,
          connected: true,
          data,
          error: null,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setState({
          loading: false,
          connected: false,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to reach backend service.",
        });
      }
    }

    void loadHealth();

    return () => {
      mounted = false;
    };
  }, []);

  const badgeClasses = state.loading
    ? "border-amber-400/25 bg-amber-300/10 text-amber-100"
    : state.connected
      ? "border-emerald-400/25 bg-emerald-300/10 text-emerald-100"
      : "border-rose-400/25 bg-rose-300/10 text-rose-100";

  const statusLabel = state.loading
    ? "Checking"
    : state.connected
      ? "Ready"
      : "Offline";

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Platform Status
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-800">
            We Are Kids Nursery connection
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            A quick live check to make sure classes and dashboards are available.
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${badgeClasses}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
          Service: {state.data?.service ?? "backend"}
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
          Version: {state.data?.version ?? "N/A"}
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-500">
          {getApiBaseUrl()}/health
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        {state.loading && "Checking school platform status..."}
        {!state.loading && state.connected && "Everything looks ready for class."}
        {!state.loading && !state.connected && (
          <span>Connection issue: {state.error}</span>
        )}
      </div>
    </section>
  );
}
