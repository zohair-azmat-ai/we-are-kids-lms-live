"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RecordingsManagement } from "@/components/recordings-management";

export default function TeacherRecordingsPage() {
  const { user } = useAuth();
  const [teacherName, setTeacherName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user?.role === "teacher") {
      setTeacherName(user.name);
    }
  }, [user]);

  return (
    <DashboardShell
      allowedRole="teacher"
      title="Teacher Recordings"
      subtitle="Review your saved classroom recordings, rename titles, and remove anything you no longer need."
    >
      <RecordingsManagement role="teacher" teacherName={teacherName} />
    </DashboardShell>
  );
}
