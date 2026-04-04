"use client";

import { useEffect, useState } from "react";

import {
  endAdminLiveSession,
  fetchAdminLiveSessions,
  type AdminLiveSession,
} from "@/lib/api";

export function AdminLiveSessionsManagement() {
  const [sessions, setSessions] = useState<AdminLiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [expandedId, setExpandedId] = useState("");

  async function loadSessions() {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetchAdminLiveSessions();
      setSessions(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load live sessions.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleEndSession(classId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to end this live session?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(classId);
      setError("");
      await endAdminLiveSession(classId);
      setSessions((currentSessions) =>
        currentSessions.filter((session) => session.class_id !== classId),
      );
      setSuccessMessage("Live session ended successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to end live session.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
        Live Sessions
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Keep an eye on active classrooms and end a session if needed.
      </p>

      {successMessage ? (
        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          Loading live sessions...
        </div>
      ) : sessions.length ? (
        <div className="mt-5 space-y-4">
          {sessions.map((session) => (
            <div
              key={session.class_id}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-800">{session.title}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>Class ID: {session.class_id}</span>
                    <span>Teacher: {session.teacher_name}</span>
                    <span>Participants: {session.participants_count}</span>
                    <span>
                      Started:{" "}
                      {session.start_time
                        ? new Date(session.start_time).toLocaleString()
                        : "Not started"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="inline-flex rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                    {session.status}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((currentId) =>
                        currentId === session.class_id ? "" : session.class_id,
                      )
                    }
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleEndSession(session.class_id)}
                    disabled={busyId === session.class_id}
                    className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    End Session
                  </button>
                </div>
              </div>

              {expandedId === session.class_id ? (
                <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-4 text-sm text-slate-600">
                  This live room is active for <strong>{session.title}</strong> with{" "}
                  <strong>{session.participants_count}</strong> participants. Admins can
                  monitor the start time and end the session here if needed.
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          No live sessions are active right now.
        </div>
      )}
    </section>
  );
}
