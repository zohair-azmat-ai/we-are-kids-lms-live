"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { RecordingsManagement } from "@/components/recordings-management";

export default function AdminRecordingsPage() {
  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Recordings"
      subtitle="Review all system recordings, filter by teacher or class, and remove recordings when needed."
    >
      <RecordingsManagement role="admin" />
    </DashboardShell>
  );
}
