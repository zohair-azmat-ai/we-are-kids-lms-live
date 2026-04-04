"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AdminUsersManagement } from "@/components/admin-users-management";

export default function AdminStudentsPage() {
  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Students"
      subtitle="Manage student accounts, class enrollments, and account status in one simple nursery view."
    >
      <AdminUsersManagement entityType="students" />
    </DashboardShell>
  );
}
