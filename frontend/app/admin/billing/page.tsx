"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { LoadingPanel } from "@/components/ui-state";
import { getSession } from "@/lib/demo-auth";
import {
  createBillingCheckoutSession,
  createBillingCustomerPortal,
  fetchBillingSubscription,
  type BillingPlan,
  type BillingSubscription,
} from "@/lib/api";

const planLabels: Record<BillingPlan, string> = {
  starter: "Starter",
  standard: "Standard",
  premium: "Premium",
};

export default function AdminBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");

    if (checkoutState === "success") {
      setNotice("Stripe checkout completed. Billing status will refresh in a moment.");
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadSubscription() {
      const session = getSession();

      if (!session || session.role !== "admin") {
        router.replace("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const nextSubscription = await fetchBillingSubscription(session.email);
        setSubscription(nextSubscription);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load billing details.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSubscription();
  }, [router]);

  const currentPlan = useMemo(() => {
    return subscription?.plans.find((plan) => plan.code === subscription.plan) ?? null;
  }, [subscription]);

  async function handlePlanChange(plan: BillingPlan) {
    const session = getSession();

    if (!session || session.role !== "admin") {
      router.push("/login");
      return;
    }

    try {
      setBusyAction(plan);
      setError("");
      const response = await createBillingCheckoutSession({
        adminEmail: session.email,
        plan,
      });
      window.location.href = response.checkout_url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open Stripe checkout.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePortalOpen() {
    const session = getSession();

    if (!session || session.role !== "admin") {
      router.push("/login");
      return;
    }

    try {
      setBusyAction("portal");
      setError("");
      const response = await createBillingCustomerPortal({ adminEmail: session.email });
      window.location.href = response.portal_url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open Stripe customer portal.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <DashboardShell
      allowedRole="admin"
      title="Admin Billing"
      subtitle="Track your current plan, manage Stripe subscription details, and upgrade school capacity when your nursery grows."
    >
      {isLoading ? (
        <LoadingPanel
          title="Loading billing"
          message="Checking plan status, renewal timing, and usage limits."
        />
      ) : error ? (
        <section className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <p className="text-red-600">{error}</p>
        </section>
      ) : !subscription || !currentPlan ? (
        <section className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <p className="text-red-600">Billing information is not available right now.</p>
        </section>
      ) : (
        <>
          {notice ? (
            <section className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-800 shadow-soft">
              {notice}
            </section>
          ) : null}

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                Current Subscription
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-800">
                {currentPlan.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                {currentPlan.description}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-500">
                    Status
                  </p>
                  <p className="mt-2 text-lg font-semibold capitalize text-slate-800">
                    {subscription.subscription_status.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                    Renewal
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "Not active yet"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 text-sm text-slate-700">
                  Billing email: {subscription.billing_email}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 text-sm text-slate-700">
                  School: {subscription.school_name}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handlePortalOpen()}
                  disabled={busyAction === "portal"}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {busyAction === "portal" ? "Opening Portal..." : "Manage Subscription"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  View Pricing
                </button>
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
                Plan Usage
              </p>
              <div className="mt-5 grid gap-4">
                {[
                  {
                    label: "Teachers",
                    current: subscription.teachers_count,
                    limit: currentPlan.features.teachers_limit,
                  },
                  {
                    label: "Students",
                    current: subscription.students_count,
                    limit: currentPlan.features.students_limit,
                  },
                  {
                    label: "Classes",
                    current: subscription.classes_count,
                    limit: currentPlan.features.classes_limit,
                  },
                ].map((item) => {
                  const percent = Math.min(100, Math.round((item.current / item.limit) * 100));

                  return (
                    <div
                      key={item.label}
                      className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                        <p className="text-sm text-slate-600">
                          {item.current} / {item.limit}
                        </p>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="mt-8 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
                  Upgrade or Downgrade
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-800">
                  Switch plans with Stripe Checkout
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Plan limits apply to teacher, student, and class creation.
              </p>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {subscription.plans.map((plan) => (
                <article
                  key={plan.code}
                  className={`rounded-[1.85rem] border p-5 ${
                    plan.is_current
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                    {planLabels[plan.code]}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{plan.description}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p>Teachers: {plan.features.teachers_limit}</p>
                    <p>Students: {plan.features.students_limit}</p>
                    <p>Classes: {plan.features.classes_limit}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePlanChange(plan.code)}
                    disabled={busyAction === plan.code || plan.is_current}
                    className={`mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
                      plan.is_current
                        ? "border border-blue-200 bg-white text-blue-700"
                        : "bg-red-500 text-white shadow-lg shadow-red-100"
                    }`}
                  >
                    {busyAction === plan.code
                      ? "Opening Stripe..."
                      : plan.is_current
                        ? "Current Plan"
                        : `Switch to ${plan.name}`}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
