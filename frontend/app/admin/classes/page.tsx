"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AdminClassesManagement } from "@/components/admin-classes-management";

export default function AdminClassesPage() {
  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Classes"
      subtitle="Create and manage nursery classes, assign teachers, and organize student groups without disturbing live lesson flow."
    >
      <AdminClassesManagement />
    </DashboardShell>
  );
}
