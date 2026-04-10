"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useAuth } from "@/components/auth-provider";
import { type UserRole, isTeacherRole } from "@/lib/demo-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { AIAssistantChat } from "@/components/ai-assistant-chat";

type DashboardShellProps = {
  allowedRole: UserRole;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function DashboardShell({
  allowedRole,
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  usePageTitle(title);

  useEffect(() => {
    if (isLoading) {
      console.log("[Dashboard] Auth loading — waiting for session...");
      return;
    }

    if (!user) {
      console.log("[Dashboard] No user after auth settled — redirecting to login");
      router.replace("/login");
      return;
    }

    // Teacher-group roles (main_teacher, assistant_teacher) are all allowed on teacher pages
    const roleMatches =
      allowedRole === "teacher"
        ? isTeacherRole(user.role)
        : user.role === allowedRole;

    console.log("[Dashboard] Auth resolved — user.role:", user.role, "allowedRole:", allowedRole, "match:", roleMatches);

    if (!roleMatches) {
      const redirect = isTeacherRole(user.role) ? "/teacher/dashboard" : `/${user.role}/dashboard`;
      console.log("[Dashboard] Role mismatch — redirecting to:", redirect);
      router.replace(redirect);
    }
  }, [allowedRole, isLoading, router, user]);

  const teacherLinks = [
    { href: "/teacher/dashboard", label: "Overview" },
    { href: "/teacher/recordings", label: "Recordings" },
  ];

  const dashboardLinksByRole: Record<UserRole, Array<{ href: string; label: string }>> = {
    admin: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/billing", label: "Billing" },
      { href: "/admin/teachers", label: "Teachers" },
      { href: "/admin/students", label: "Students" },
      { href: "/admin/classes", label: "Classes" },
      { href: "/admin/live-sessions", label: "Live Sessions" },
      { href: "/admin/recordings", label: "Recordings" },
    ],
    teacher: teacherLinks,
    main_teacher: teacherLinks,
    assistant_teacher: teacherLinks,
    student: [
      { href: "/student/dashboard", label: "Overview" },
      { href: "/student/recordings", label: "Recordings" },
    ],
  };

  const dashboardLinks = dashboardLinksByRole[user?.role ?? allowedRole] ?? dashboardLinksByRole[allowedRole];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const roleMatches = user
    ? allowedRole === "teacher" ? isTeacherRole(user.role) : user.role === allowedRole
    : false;

  if (isLoading || !user || !roleMatches) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
          <div className="animate-pulse space-y-6">
            <section className="h-24 rounded-[2rem] border border-slate-100 bg-white shadow-soft" />
            <section className="h-52 rounded-[2.5rem] border border-slate-100 bg-white shadow-soft" />
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-36 rounded-[2rem] border border-slate-100 bg-white shadow-soft" />
              <div className="h-36 rounded-[2rem] border border-slate-100 bg-white shadow-soft" />
              <div className="h-36 rounded-[2rem] border border-slate-100 bg-white shadow-soft sm:col-span-2 lg:col-span-1" />
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50/70 to-slate-100/60 pb-[max(128px,calc(env(safe-area-inset-bottom)+128px))]">
      <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
        <header className="glass-card rounded-2xl px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="We Are Kids Nursery"
                width={48}
                height={48}
                className="h-11 w-auto object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-800">
                  We Are Kids Nursery
                </p>
                <p className="truncate text-sm text-slate-500">{title}</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-2 py-2 backdrop-blur">
                {dashboardLinks.map((link) => {
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-100"
                          : "text-slate-600 hover:bg-white hover:text-slate-800"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/"
                className="premium-button btn-secondary inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
              >
                Back Home
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="premium-button btn-danger inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
              >
                Logout
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-700 lg:hidden"
              aria-label="Toggle dashboard menu"
              aria-expanded={isMenuOpen}
            >
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </div>

          {isMenuOpen ? (
            <div className="mt-4 border-t border-slate-100 pt-4 lg:hidden">
              <nav className="grid gap-2">
                {dashboardLinks.map((link) => {
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                          : "border border-slate-200 bg-white/80 text-slate-700"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Link
                    href="/"
                    onClick={() => setIsMenuOpen(false)}
                    className="premium-button btn-secondary inline-flex items-center justify-center px-4 py-3 text-sm font-semibold"
                  >
                    Back Home
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="premium-button btn-danger inline-flex items-center justify-center px-4 py-3 text-sm font-semibold"
                  >
                    Logout
                  </button>
                </div>
              </nav>
            </div>
          ) : null}
        </header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-card mt-8 rounded-2xl px-5 py-8 sm:px-8 sm:py-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
            Welcome Back
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-800 sm:text-5xl">
            {user.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {subtitle}
          </p>
          <div className="mt-6 inline-flex max-w-full rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Signed in as {user.email}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
          className="mt-8"
        >
          {children}
        </motion.div>
      </div>
      {allowedRole !== "student" ? <AIAssistantChat /> : null}
    </main>
  );
}
