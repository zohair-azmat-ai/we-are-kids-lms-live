"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { fetchLiveClasses, fetchRecordings, type RecordingItem } from "@/lib/api";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [recordingsError, setRecordingsError] = useState("");

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

      const liveClasses = await fetchLiveClasses();

      if (!liveClasses.length) {
        setError("No live class is available right now.");
        return;
      }

      router.push(`/student/classroom/${liveClasses[0].class_id}`);
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
              Reading Circle
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
              Science Exploration
            </div>
          </div>
        </section>

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
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : null}
        </section>
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
