"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { fetchRecordings, startLiveClass, type RecordingItem } from "@/lib/api";
import { getRecordingStatus } from "@/lib/recordings";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [recordingsError, setRecordingsError] = useState("");
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

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
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
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
                <div
                  key={recording.recording_id}
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
