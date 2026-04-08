"use client";

import { useEffect, useState } from "react";

import {
  fetchClassAttendance,
  fetchTeacherAttendance,
  type AttendanceSummary,
} from "@/lib/api";

type Props = {
  /** Pass classId to show attendance for a specific class across all its sessions. */
  classId?: string;
  /** Pass "teacher" to fetch all sessions run by the logged-in teacher. */
  mode?: "class" | "teacher";
  title?: string;
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "present") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
        Present
      </span>
    );
  }

  if (status === "left") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">
        Left
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
      {status}
    </span>
  );
}

export function AttendancePanel({ classId, mode = "teacher", title = "Attendance" }: Props) {
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSession, setExpandedSession] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError("");

        let data: AttendanceSummary[];

        if (mode === "class" && classId) {
          data = await fetchClassAttendance(classId);
        } else {
          data = await fetchTeacherAttendance();
        }

        setSummaries(data);

        if (data.length > 0) {
          setExpandedSession(data[0].session_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load attendance.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [classId, mode]);

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-600">
        {title}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-800">
        Live session attendance records
      </h2>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          Loading attendance...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
          {error}
        </div>
      ) : summaries.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          No attendance records yet. Records are created when students join a live session.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {summaries.map((summary) => (
            <div
              key={summary.session_id}
              className="rounded-2xl border border-slate-100 bg-slate-50"
            >
              {/* Session header */}
              <button
                type="button"
                className="flex w-full items-start justify-between px-4 py-4 text-left"
                onClick={() =>
                  setExpandedSession((current) =>
                    current === summary.session_id ? "" : summary.session_id,
                  )
                }
              >
                <div>
                  <p className="font-semibold text-slate-800">{summary.class_title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {summary.started_at
                      ? new Date(summary.started_at).toLocaleDateString([], {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Session date unknown"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-4">
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {summary.currently_present} present
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {summary.total_attended} total
                  </div>
                  <span className="text-slate-400 text-sm">
                    {expandedSession === summary.session_id ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Student records */}
              {expandedSession === summary.session_id ? (
                <div className="border-t border-slate-100 px-4 pb-4">
                  {summary.records.length === 0 ? (
                    <p className="pt-4 text-sm text-slate-500">
                      No students joined this session yet.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            <th className="pb-3 pr-4">Student</th>
                            <th className="pb-3 pr-4">Joined</th>
                            <th className="pb-3 pr-4">Left</th>
                            <th className="pb-3 pr-4">Duration</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summary.records.map((record) => (
                            <tr key={record.id} className="text-slate-700">
                              <td className="py-3 pr-4">
                                <p className="font-medium text-slate-800">{record.student_name}</p>
                                <p className="text-xs text-slate-400">{record.student_email}</p>
                              </td>
                              <td className="py-3 pr-4 text-slate-600">
                                {formatTime(record.joined_at)}
                              </td>
                              <td className="py-3 pr-4 text-slate-600">
                                {formatTime(record.left_at)}
                              </td>
                              <td className="py-3 pr-4 text-slate-600">
                                {record.duration_minutes != null
                                  ? `${record.duration_minutes} min`
                                  : "—"}
                              </td>
                              <td className="py-3">
                                <StatusBadge status={record.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
