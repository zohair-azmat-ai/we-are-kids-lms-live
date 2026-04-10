"use client";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RecordingsManagement } from "@/components/recordings-management";
import { isTeacherRole } from "@/lib/demo-auth";

export default function TeacherRecordingsPage() {
  const { user } = useAuth();
  // Pass teacher name only once auth settles — isTeacherRole covers all teacher variants
  const teacherName = user && isTeacherRole(user.role) ? user.name : undefined;

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
