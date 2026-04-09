"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAuth } from "@/components/auth-provider";
import { AIInsightsPanel } from "@/components/ai-insights-panel";
import { AnalyticsBarChart } from "@/components/analytics-bar-chart";
import { AttendancePanel } from "@/components/attendance-panel";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  fetchRecordings,
  fetchTeacherAnalytics,
  startLiveClass,
  type RecordingItem,
  type TeacherAnalyticsResponse,
} from "@/lib/api";
import { getRecordingStatus } from "@/lib/recordings";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [analytics, setAnalytics] = useState<TeacherAnalyticsResponse | null>(null);
  const [recordingsError, setRecordingsError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  useEffect(() => {
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

    async function loadAnalytics() {
      try {
        setIsLoadingAnalytics(true);
        const analyticsResponse = await fetchTeacherAnalytics();
        setAnalytics(analyticsResponse);
      } catch (requestError) {
        setAnalyticsError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load analytics.",
        );
      } finally {
        setIsLoadingAnalytics(false);
      }
    }

    void loadRecordings();
    void loadAnalytics();
  }, []);

  async function handleStartLiveClass() {
    if (!user || user.role !== "teacher") {
      router.replace("/login");
      return;
    }

    try {
      setIsStarting(true);
      setError("");

      const classroom = await startLiveClass(user.email);
      router.push(`/teacher/classroom/${classroom.class_id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start live class.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <DashboardShell
      allowedRole="teacher"
      title="Teacher Dashboard"
      subtitle="Manage your classes, start live lessons, and keep recordings organized in one calm teaching space."
    >
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            Assigned Classes
          </p>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
              Class A: Reading and Science
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
              Weekly live class schedule ready for students
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
            Live Teaching
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-800">
            Ready to begin your next lesson
          </h2>
          <button
            type="button"
            onClick={handleStartLiveClass}
            disabled={isStarting}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isStarting ? "Starting..." : "Start Live Class"}
          </button>
          {error ? (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/teacher/recordings")}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            View Recordings
          </button>
        </section>
      </div>

      {isLoadingAnalytics ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-52 rounded-xl bg-slate-100" />
            <div className="h-4 w-72 rounded-xl bg-slate-100" />
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-[1.75rem] bg-slate-100" />
              ))}
            </div>
          </div>
        </section>
      ) : analyticsError ? (
        <section className="mt-8 rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-soft">
          <p className="text-sm text-red-600">{analyticsError}</p>
        </section>
      ) : analytics ? (
        <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
                Teaching Analytics
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-800">
                Mini classroom performance snapshot
              </h2>
            </div>
            <p className="text-sm text-slate-500">{analytics.participation_summary}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Assigned Classes", value: analytics.assigned_classes, accent: "text-blue-600" },
              { label: "Live Sessions", value: analytics.live_sessions_run, accent: "text-red-500" },
              { label: "Recordings", value: analytics.recordings_created, accent: "text-amber-600" },
              { label: "Enrolled Students", value: analytics.enrolled_students, accent: "text-emerald-600" },
              { label: "Avg Class Size", value: analytics.average_class_size, accent: "text-violet-600" },
            ].map((item, i) => (
              <motion.article
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.07, ease: "easeOut" }}
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4 cursor-default"
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${item.accent}`}>
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-800">{item.value}</p>
              </motion.article>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <AnalyticsBarChart
              title="Your Live Activity"
              subtitle="Last 7 days"
              points={analytics.live_activity_points}
              accentClassName="bg-red-500"
            />
            <section className="rounded-[1.85rem] border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-800">Participation summary</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700">
                  Active learners: {analytics.active_students}
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700">
                  Total enrolled learners: {analytics.enrolled_students}
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700">
                  {analytics.participation_summary}
                </div>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <AttendancePanel mode="teacher" title="Session Attendance" />
      </div>

      <div className="mt-8">
        <AIInsightsPanel title="Teaching Insights" />
      </div>

      <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
          Recordings
        </p>
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
                <motion.div
                  key={recording.recording_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{recording.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Expires on {new Date(recording.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${status.className}`}
                  >
                    {status.label}
                  </div>
                </motion.div>
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
