"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { AIInsightsPanel } from "@/components/ai-insights-panel";
import {
  fetchAdminClasses,
  fetchAdminLiveSessions,
  fetchAdminStudents,
  fetchAdminTeachers,
  fetchBillingUsage,
  fetchRecordings,
  type AdminLiveSession,
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
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setIsLoadingOverview(true);
        const [teachers, students, classes, liveSessionsResponse, usageResponse] = await Promise.all([
          fetchAdminTeachers(),
          fetchAdminStudents(),
          fetchAdminClasses(),
          fetchAdminLiveSessions(),
          user ? fetchBillingUsage(user.email) : Promise.resolve(null),
        ]);
        setTeacherCount(teachers.length);
        setStudentCount(students.length);
        setClassCount(classes.length);
        setLiveSessions(liveSessionsResponse);
        setUsage(usageResponse);
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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            Total Teachers
          </p>
          <p className="mt-4 text-4xl font-semibold text-slate-800">
            {isLoadingOverview ? "..." : teacherCount}
          </p>
        </article>
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
            Total Students
          </p>
          <p className="mt-4 text-4xl font-semibold text-slate-800">
            {isLoadingOverview ? "..." : studentCount}
          </p>
        </article>
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
            Total Classes
          </p>
          <p className="mt-4 text-4xl font-semibold text-slate-800">
            {isLoadingOverview ? "..." : classCount}
          </p>
        </article>
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            Live Sessions
          </p>
          <p className="mt-4 text-4xl font-semibold text-slate-800">
            {isLoadingOverview ? "..." : liveSessions.length}
          </p>
        </article>
      </div>

      {usage ? (
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

      <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
          Quick Links
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
