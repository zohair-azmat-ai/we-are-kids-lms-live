"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui-state";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  authenticateDemoUser,
  demoUsers,
  getSession,
  saveSession,
  type UserRole,
} from "@/lib/demo-auth";

const roles: UserRole[] = ["admin", "teacher", "student"];

const roleRedirects: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("admin");
  const [email, setEmail] = useState("admin@wearekids.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTitle("Login");

  useEffect(() => {
    const existingSession = getSession();

    if (existingSession) {
      router.replace(roleRedirects[existingSession.role]);
    }
  }, [router]);

  function handleRoleChange(nextRole: UserRole) {
    setRole(nextRole);
    setError("");

    const defaultUser = demoUsers.find((user) => user.role === nextRole);

    if (defaultUser) {
      setEmail(defaultUser.email);
      setPassword(defaultUser.password);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter both your email and password.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You appear to be offline. Please check your internet connection.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const session = authenticateDemoUser(trimmedEmail, trimmedPassword, role);

    if (!session) {
      setError("Please check the selected role, email, and password.");
      setIsSubmitting(false);
      return;
    }

    saveSession(session);
    router.push(roleRedirects[session.role]);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <SiteHeader showAnchorLinks={false} />

        <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="relative overflow-hidden rounded-[2.5rem] bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10">
            <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-blue-100 sm:h-40 sm:w-40" />
            <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-red-100 sm:h-28 sm:w-28" />
            <div className="absolute bottom-8 left-1/3 h-16 w-16 rounded-full bg-amber-100 sm:h-20 sm:w-20" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo.png"
                  alt="We Are Kids Nursery"
                  width={56}
                  height={56}
                  className="h-12 w-auto object-contain"
                  priority
                />
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    We Are Kids Nursery
                  </p>
                  <p className="text-sm text-slate-500">
                    Demo access for admin, teacher, and student roles
                  </p>
                </div>
              </div>

              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                Login
              </p>
              <h1 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
                Sign in to your dashboard
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                Choose your role, use one of the demo accounts, and continue to
                the right nursery workspace.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {roles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleRoleChange(item)}
                    className={`rounded-2xl px-4 py-4 text-sm font-semibold capitalize transition ${
                      role === item
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-10 rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  Demo accounts
                </p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {demoUsers.map((user) => (
                    <p key={user.email}>
                      {user.email} / 123456 / {user.role}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10">
            <form onSubmit={handleSubmit}>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
                Access Portal
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl">
                Nursery role login
              </h2>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Selected role
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 capitalize">
                    {role}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
                    autoComplete="current-password"
                    required
                    minLength={6}
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-red-500 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? <Spinner className="h-4 w-4 border-white/50 border-t-white" /> : null}
                  {isSubmitting ? "Signing in..." : "Login"}
                </button>
              </div>
            </form>

            <Link
              href="/"
              className="mt-6 inline-flex text-sm font-semibold text-blue-600"
            >
              Back to homepage
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
