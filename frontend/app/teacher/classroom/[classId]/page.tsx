"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { LiveClassroomRoom } from "@/components/live-classroom-room";

export default function TeacherClassroomPage() {
  const params = useParams<{ classId: string }>();
  const router = useRouter();

  const classId =
    typeof params.classId === "string" && params.classId.trim().length > 0
      ? params.classId.trim()
      : null;

  useEffect(() => {
    if (!classId) {
      console.error(
        "[TeacherClassroomPage] Invalid or missing classId param:",
        params.classId,
      );
    }
  }, [classId, params.classId]);

  if (!classId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-500">
            Invalid Session
          </p>
          <h1 className="mt-3 text-xl font-semibold text-slate-800">
            Invalid classroom link
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The classroom URL is missing or contains an invalid ID. Please
            start a new class from your dashboard.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/teacher/dashboard")}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <LiveClassroomRoom classId={classId} role="teacher" />;
}
