"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { type UserRole } from "@/lib/demo-auth";
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
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== allowedRole) {
      router.replace(`/${user.role}/dashboard`);
    }
  }, [allowedRole, isLoading, router, user]);

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
    teacher: [
      { href: "/teacher/dashboard", label: "Overview" },
      { href: "/teacher/recordings", label: "Recordings" },
    ],
    student: [
      { href: "/student/dashboard", label: "Overview" },
      { href: "/student/recordings", label: "Recordings" },
    ],
  };

  const dashboardLinks = dashboardLinksByRole[allowedRole];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (isLoading || !user || user.role !== allowedRole) {
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
    <main className="min-h-screen pb-[max(128px,calc(env(safe-area-inset-bottom)+128px))]">
      <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-10">
        <header className="rounded-[2rem] border border-slate-100 bg-white px-5 py-4 shadow-soft sm:px-6">
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
                <p className="truncate text-lg font-bold text-slate-800">
                  We Are Kids Nursery
                </p>
                <p className="truncate text-sm text-slate-500">{title}</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <nav className="flex flex-wrap items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-2 py-2">
                {dashboardLinks.map((link) => {
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-white text-blue-700 shadow-sm"
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
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Back Home
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5"
              >
                Logout
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
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
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "border border-slate-100 bg-slate-50 text-slate-700"
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
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Back Home
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100"
                  >
                    Logout
                  </button>
                </div>
              </nav>
            </div>
          ) : null}
        </header>

        <section className="mt-8 rounded-[2.5rem] border border-slate-100 bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
            Welcome Back
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-5xl">
            {user.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {subtitle}
          </p>
          <div className="mt-6 inline-flex max-w-full rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Signed in as {user.email}
          </div>
        </section>

        <div className="mt-8">{children}</div>
      </div>
      {allowedRole !== "student" ? <AIAssistantChat /> : null}
    </main>
  );
}
