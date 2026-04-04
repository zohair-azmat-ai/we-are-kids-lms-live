"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AdminUsersManagement } from "@/components/admin-users-management";

export default function AdminTeachersPage() {
  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Teachers"
      subtitle="Manage teacher accounts, classroom assignments, and access status from one structured nursery control panel."
    >
      <AdminUsersManagement entityType="teachers" />
    </DashboardShell>
  );
}
