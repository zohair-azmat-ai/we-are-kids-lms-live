"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AdminLiveSessionsManagement } from "@/components/admin-live-sessions-management";

export default function AdminLiveSessionsPage() {
  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Live Sessions"
      subtitle="Monitor active classrooms, review session details, and end a live lesson when admin support is needed."
    >
      <AdminLiveSessionsManagement />
    </DashboardShell>
  );
}
