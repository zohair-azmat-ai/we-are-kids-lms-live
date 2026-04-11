"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { fetchRecordings, getApiBaseUrl, type LiveClassSession, type RecordingItem } from "@/lib/api";
import { getAccessToken } from "@/lib/demo-auth";

function isValidClassId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("anonymous") &&
    !value.startsWith("[object") &&
    !value.startsWith("function")
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [liveClasses, setLiveClasses] = useState<LiveClassSession[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [recordingsError, setRecordingsError] = useState("");

  // Poll for live classes every 10 s.
  // Uses a direct fetch() — NOT fetchLiveClasses() — to bypass the 20s
  // in-memory cache in requestCachedJson. Without this, an empty result
  // on first load is served from cache on subsequent polls, so the student
  // card stays "not live" even after the teacher has started the class.
  useEffect(() => {
    const apiBase = getApiBaseUrl();

    async function checkLive() {
      const token = getAccessToken();
      if (!token) {
        console.log("[StudentDashboard] checkLive: no token yet, skipping");
        return;
      }
      try {
        const resp = await fetch(`${apiBase}/api/v1/classes/live`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!resp.ok) {
          console.warn("[StudentDashboard] checkLive: HTTP", resp.status);
          return;
        }
        const classes = (await resp.json()) as LiveClassSession[];
        console.log(
          "[StudentDashboard] checkLive: received",
          classes.length,
          "live class(es)",
          classes.map((c) => ({ id: c.class_id, title: c.title, teacher: c.teacher_name })),
        );
        setLiveClasses(classes);
      } catch (err) {
        console.warn("[StudentDashboard] checkLive error:", err);
        // non-fatal — card stays in "not live" state
      }
    }

    void checkLive();
    const interval = setInterval(() => { void checkLive(); }, 10_000);
    return () => clearInterval(interval);
  }, []);

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

    void loadRecordings();
  }, []);

  async function handleJoinClass() {
    if (!user || user.role !== "student") {
      router.replace("/login");
      return;
    }

    try {
      setIsJoining(true);
      setError("");

      // Direct fetch — bypass requestCachedJson so we always get fresh state
      const apiBase = getApiBaseUrl();
      const token = getAccessToken();
      const resp = await fetch(`${apiBase}/api/v1/classes/live`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const liveClasses = resp.ok ? ((await resp.json()) as LiveClassSession[]) : [];
      console.log("[StudentDashboard] handleJoinClass: live classes", liveClasses);

      if (!liveClasses.length) {
        setError("No live class is available right now.");
        return;
      }

      const targetClassId = liveClasses[0].class_id;
      if (!isValidClassId(targetClassId)) {
        console.error("[StudentDashboard] Invalid class_id from live classes:", targetClassId);
        setError("Unable to join: the classroom ID returned by the server is invalid.");
        return;
      }

      console.log("[StudentDashboard] Joining classroom:", targetClassId);
      router.push(`/student/classroom/${targetClassId}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to join class.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <DashboardShell
      allowedRole="student"
      title="Student Dashboard"
      subtitle="See your classes, join lessons quickly, and revisit recordings in a simple student-friendly space."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            Enrolled Classes
          </p>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
              Join live lessons from here as soon as your teacher starts class.
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
              Revisit saved recordings anytime from your recordings area.
            </div>
          </div>
        </section>

        {/* Today's Lesson — state driven by live class poll */}
        {liveClasses.length > 0 ? (
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-soft ring-1 ring-emerald-200">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
                Today&apos;s Lesson
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-800">
              {liveClasses[0].title ?? "Join your live class now"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {liveClasses[0].teacher_name
                ? `${liveClasses[0].teacher_name} is teaching right now`
                : "Your class is live right now"}
            </p>
            <button
              type="button"
              onClick={handleJoinClass}
              disabled={isJoining}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              {isJoining ? "Joining..." : "Join Live Class"}
            </button>
            {error ? (
              <div className="mt-4 rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
              Today&apos;s Lesson
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-800">
              Join your class when it starts
            </h2>
            <button
              type="button"
              onClick={handleJoinClass}
              disabled={isJoining}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isJoining ? "Joining..." : "Join Class"}
            </button>
            {error ? (
              <div className="mt-4 rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}
          </section>
        )}
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
            {recordings.map((recording) => (
              <div
                key={recording.recording_id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">{recording.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {recording.teacher} - {new Date(recording.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/student/recordings/${recording.recording_id}`)
                  }
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-100"
                >
                  Watch
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            No saved recordings are available yet.
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
