"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { RecordingsManagement } from "@/components/recordings-management";
import { getSession, type SessionUser } from "@/lib/demo-auth";

export default function TeacherRecordingsPage() {
  const [session, setSession] = useState<SessionUser | null>(() => {
    const storedSession = getSession();
    return storedSession?.role === "teacher" ? storedSession : null;
  });

  useEffect(() => {
    const storedSession = getSession();

    if (storedSession?.role === "teacher") {
      setSession(storedSession);
    }
  }, []);

  return (
    <DashboardShell
      allowedRole="teacher"
      title="Teacher Recordings"
      subtitle="Review your saved classroom recordings, rename titles, and remove anything you no longer need."
    >
      <RecordingsManagement role="teacher" teacherName={session?.name} />
    </DashboardShell>
  );
}
