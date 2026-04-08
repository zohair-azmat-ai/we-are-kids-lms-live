"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { AIInsightsPanel } from "@/components/ai-insights-panel";
import { AdminDemoHelpCard } from "@/components/admin-demo-help-card";
import { AdminSystemStatusCard } from "@/components/admin-system-status-card";
import { AnalyticsBarChart } from "@/components/analytics-bar-chart";
import {
  fetchAdminAnalytics,
  fetchAdminLiveSessions,
  fetchBillingUsage,
  fetchRecordings,
  type AdminLiveSession,
  type AdminAnalyticsResponse,
  type BillingUsageSummary,
  type RecordingItem,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { getRecordingStatus } from "@/lib/recordings";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [teacherCount, setTeacherCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [liveSessions, setLiveSessions] = useState<AdminLiveSession[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [recordingsError, setRecordingsError] = useState("");
  const [overviewError, setOverviewError] = useState("");
  const [usage, setUsage] = useState<BillingUsageSummary | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setIsLoadingOverview(true);
        const [liveSessionsResponse, usageResponse, analyticsResponse] = await Promise.all([
          fetchAdminLiveSessions(),
          user ? fetchBillingUsage(user.email) : Promise.resolve(null),
          fetchAdminAnalytics(),
        ]);
        setTeacherCount(analyticsResponse.total_teachers);
        setStudentCount(analyticsResponse.total_students);
        setClassCount(analyticsResponse.active_classes);
        setLiveSessions(liveSessionsResponse);
        setUsage(usageResponse);
        setAnalytics(analyticsResponse);
      } catch (requestError) {
        setOverviewError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load admin overview.",
        );
      } finally {
        setIsLoadingOverview(false);
      }
    }

    async function loadRecordings() {
      try {
        setIsLoadingRecordings(true);
        const savedRecordings = await fetchRecordings();
        setRecordings(savedRecordings);
      } catch (requestError) {
        setRecordingsError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load recordings.",
        );
      } finally {
        setIsLoadingRecordings(false);
      }
    }

    void loadOverview();
    void loadRecordings();
  }, [user]);

  const quickLinks = [
    {
      title: "Billing",
      text: "View plan status, renewal details, and manage your subscription.",
      href: "/admin/billing",
      accent: "text-violet-600",
    },
    {
      title: "Teachers",
      text: "Add, update, and remove teacher accounts.",
      href: "/admin/teachers",
      accent: "text-blue-600",
    },
    {
      title: "Students",
      text: "Keep student access and enrollments tidy.",
      href: "/admin/students",
      accent: "text-red-500",
    },
    {
      title: "Classes",
      text: "Organize nursery classes and assignments.",
      href: "/admin/classes",
      accent: "text-amber-600",
    },
    {
      title: "Live Sessions",
      text: "Monitor active classrooms and end sessions.",
      href: "/admin/live-sessions",
      accent: "text-sky-600",
    },
    {
      title: "Recordings",
      text: "Review classroom recordings and expiry.",
      href: "/admin/recordings",
      accent: "text-emerald-600",
    },
  ];

  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Dashboard"
      subtitle="Keep an eye on teachers, students, classes, recordings, and live lesson activity from one simple nursery overview."
    >
      {overviewError ? (
        <section className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <p className="text-red-600">{overviewError}</p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:gap-6 grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Teachers", value: teacherCount, accent: "text-blue-600" },
          { label: "Total Students", value: studentCount, accent: "text-red-500" },
          { label: "Total Classes", value: classCount, accent: "text-amber-600" },
          { label: "Live Sessions", value: liveSessions.length, accent: "text-sky-600" },
        ].map((card) => (
          <article key={card.label} className="rounded-[2rem] border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
            <p className={`text-xs sm:text-sm font-semibold uppercase tracking-[0.24em] ${card.accent}`}>
              {card.label}
            </p>
            {isLoadingOverview ? (
              <div className="mt-4 h-10 w-16 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <p className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-800">{card.value}</p>
            )}
          </article>
        ))}
      </div>

      {isLoadingOverview && !analytics ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 rounded-xl bg-slate-100" />
            <div className="h-4 w-72 rounded-xl bg-slate-100" />
            <div className="mt-5 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-[1.75rem] bg-slate-100" />
              ))}
            </div>
          </div>
        </section>
      ) : analytics ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                Analytics Overview
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-800">
                Growth, activity, and plan signals
              </h2>
            </div>
            <p className="text-sm text-slate-500">{analytics.activity_change_label}</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total Users", value: analytics.total_users, accent: "text-blue-600" },
              { label: "Teachers", value: analytics.total_teachers, accent: "text-sky-600" },
              { label: "Students", value: analytics.total_students, accent: "text-red-500" },
              { label: "Active Classes", value: analytics.active_classes, accent: "text-amber-600" },
              { label: "Live Now", value: analytics.live_sessions_count, accent: "text-emerald-600" },
              { label: "Recordings", value: analytics.recordings_count, accent: "text-violet-600" },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4"
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${item.accent}`}>
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-800">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
            <AnalyticsBarChart
              title="Live Sessions"
              subtitle="Last 7 days"
              points={analytics.live_activity_points}
              accentClassName="bg-blue-600"
            />
            <AnalyticsBarChart
              title="Recording Activity"
              subtitle="Last 7 days"
              points={analytics.recording_activity_points}
              accentClassName="bg-emerald-500"
            />
            <section className="rounded-[1.85rem] border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-800">Plan usage summary</p>
              <div className="mt-4 space-y-4">
                {[
                  { label: "Teachers", metric: analytics.plan_usage_summary.teachers },
                  { label: "Students", metric: analytics.plan_usage_summary.students },
                  { label: "Classes", metric: analytics.plan_usage_summary.classes },
                ].map(({ label, metric }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>{label}</span>
                      <span>
                        {metric.current} / {metric.limit ?? "Unlimited"}
                      </span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${metric.is_unlimited ? 24 : metric.percent_used}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700">
                  Active students: {analytics.active_students}
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700">
                  Class fill ratio: {analytics.class_fill_ratio}%
                </div>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {isLoadingOverview && !usage ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-36 rounded-xl bg-slate-100" />
            <div className="h-4 w-56 rounded-xl bg-slate-100" />
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 rounded-[1.75rem] bg-slate-100" />
              ))}
            </div>
          </div>
        </section>
      ) : usage ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
                SaaS Usage
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-800">
                {usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)} plan overview
              </h2>
            </div>
            <button
              type="button"
              onClick={() => router.push("/admin/billing")}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Manage Billing
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              { label: "Teachers", metric: usage.teachers },
              { label: "Students", metric: usage.students },
              { label: "Classes", metric: usage.classes },
            ].map(({ label, metric }) => (
              <article
                key={label}
                className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="text-sm text-slate-600">
                    {metric.current} / {metric.limit === null ? "Unlimited" : metric.limit}
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full ${
                      metric.is_at_limit
                        ? "bg-red-500"
                        : metric.is_near_limit
                          ? "bg-amber-500"
                          : "bg-blue-600"
                    }`}
                    style={{ width: `${metric.is_unlimited ? 24 : metric.percent_used}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {metric.upgrade_message ?? "Capacity is healthy."}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                Plan Signals
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {usage.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              <p>Recordings: {usage.recordings_access === "full" ? "Full access" : "Basic access"}</p>
              <p className="mt-2">
                Premium features: {usage.priority_features ? "Enabled" : "Upgrade for priority-ready tools"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <AIInsightsPanel />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminDemoHelpCard />
        <AdminSystemStatusCard />
      </div>

      <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
          Quick Links
        </p>
        <div className="mt-5 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {quickLinks.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => router.push(link.href)}
              className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5"
            >
              <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${link.accent}`}>
                {link.title}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{link.text}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            Active Live Sessions
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/live-sessions")}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Open Live Sessions
          </button>
        </div>

        {isLoadingOverview ? (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            Loading live sessions...
          </div>
        ) : liveSessions.length ? (
          <div className="mt-5 space-y-4">
            {liveSessions.map((session) => (
              <div
                key={session.class_id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">{session.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {session.teacher_name} - {session.participants_count} participants
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                  {session.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            No live sessions are active right now.
          </div>
        )}
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
            Recordings Overview
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/recordings")}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Manage Recordings
          </button>
        </div>
        {isLoadingRecordings ? (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            Loading recordings...
          </div>
        ) : recordingsError ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-red-600">
            {recordingsError}
          </div>
        ) : recordings.length ? (
          <div className="mt-5 space-y-4">
            {recordings.map((recording) => {
              const status = getRecordingStatus(recording);

              return (
                <div
                  key={recording.recording_id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{recording.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {recording.teacher} - Expires on{" "}
                      {new Date(recording.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${status.className}`}
                  >
                    {status.label}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            No recordings are currently available.
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
