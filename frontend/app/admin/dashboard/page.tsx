"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  fetchAdminClasses,
  fetchAdminLiveSessions,
  fetchAdminStudents,
  fetchAdminTeachers,
  fetchRecordings,
  type AdminLiveSession,
  type RecordingItem,
} from "@/lib/api";
import { getRecordingStatus } from "@/lib/recordings";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [teacherCount, setTeacherCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [liveSessions, setLiveSessions] = useState<AdminLiveSession[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [recordingsError, setRecordingsError] = useState("");
  const [overviewError, setOverviewError] = useState("");
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setIsLoadingOverview(true);
        const [teachers, students, classes, liveSessionsResponse] = await Promise.all([
          fetchAdminTeachers(),
          fetchAdminStudents(),
          fetchAdminClasses(),
          fetchAdminLiveSessions(),
        ]);
        setTeacherCount(teachers.length);
        setStudentCount(students.length);
        setClassCount(classes.length);
        setLiveSessions(liveSessionsResponse);
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
  }, []);

  const quickLinks = [
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
