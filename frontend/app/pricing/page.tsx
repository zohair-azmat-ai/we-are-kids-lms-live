"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { LoadingPanel } from "@/components/ui-state";
import { SiteHeader } from "@/components/site-header";
import {
  createBillingCheckoutSession,
  fetchBillingSubscription,
  type BillingPlan,
  type BillingPlanInfo,
} from "@/lib/api";

const planOrder: BillingPlan[] = ["starter", "standard", "premium"];

const comparisonRows = [
  { label: "Teacher seats", key: "teachers_limit" },
  { label: "Student seats", key: "students_limit" },
  { label: "Classes", key: "classes_limit" },
] as const;

const publicPlans: BillingPlanInfo[] = [
  {
    code: "starter",
    name: "Starter",
    description: "For a small school getting its digital classrooms online.",
    is_current: false,
    features: {
      teachers_limit: 2,
      students_limit: 10,
      classes_limit: 3,
      recordings_access: "basic",
      priority_features: false,
      monthly_label: "Entry plan",
      audience: "Small school",
      highlights: [
        "Core nursery LMS dashboard",
        "Agora RTC live classroom sessions",
        "Basic recordings access",
      ],
    },
  },
  {
    code: "standard",
    name: "Standard",
    description: "For growing schools that need more teachers, classes, and students.",
    is_current: false,
    features: {
      teachers_limit: 10,
      students_limit: 100,
      classes_limit: 20,
      recordings_access: "full",
      priority_features: false,
      monthly_label: "Growth plan",
      audience: "Growing school",
      highlights: [
        "Higher classroom and enrollment capacity",
        "Full recordings access",
        "Better room for expanding teams",
      ],
    },
  },
  {
    code: "premium",
    name: "Premium",
    description: "For advanced usage across larger school operations.",
    is_current: false,
    features: {
      teachers_limit: null,
      students_limit: null,
      classes_limit: null,
      recordings_access: "full",
      priority_features: true,
      monthly_label: "Advanced plan",
      audience: "Advanced usage",
      highlights: [
        "Unlimited core capacity",
        "Priority-ready features enabled",
        "Best fit for multi-team operations",
      ],
    },
  },
];

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toString();
}

function PricingPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<BillingPlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPlan, setBusyPlan] = useState<BillingPlan | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");

    if (checkoutState === "cancelled") {
      setNotice("Checkout was cancelled. You can choose a plan again whenever you're ready.");
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadPlans() {
      try {
        setIsLoading(true);
        setError("");

        if (user?.role === "admin") {
          const subscription = await fetchBillingSubscription(user.email);
          setPlans(subscription.plans);
        } else {
          setPlans(publicPlans);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Unable to load pricing.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPlans();
  }, [user]);

  const orderedPlans = useMemo(() => {
    return [...plans].sort(
      (left, right) => planOrder.indexOf(left.code) - planOrder.indexOf(right.code),
    );
  }, [plans]);

  async function handleSubscribe(plan: BillingPlan) {
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    try {
      setBusyPlan(plan);
      setError("");
      const response = await createBillingCheckoutSession({
        adminEmail: user.email,
        plan,
      });
      window.location.href = response.checkout_url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start Stripe checkout.",
      );
    } finally {
      setBusyPlan(null);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
          <SiteHeader showAnchorLinks={false} />
          <div className="mt-6">
            <LoadingPanel
              title="Loading pricing"
              message="Preparing subscription plans for your school."
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-10">
        <SiteHeader showAnchorLinks={false} />

        <section className="relative mt-6 overflow-hidden rounded-[2.75rem] bg-white px-5 py-10 shadow-soft sm:px-8 sm:py-12 lg:px-10 lg:py-16">
          <div className="absolute -left-8 top-10 h-36 w-36 rounded-full bg-blue-100/80" />
          <div className="absolute bottom-10 right-8 h-28 w-28 rounded-full bg-amber-100/80" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                Nursery LMS Pricing
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-800 sm:text-5xl lg:text-6xl">
                Simple subscription plans for modern schools
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Launch with a calm starter setup, grow into a bigger admin workflow,
                and scale classroom operations with Stripe-managed subscriptions.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-100"
                >
                  Admin Login
                </Link>
                <Link
                  href="/admin/billing"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-semibold text-slate-700"
                >
                  Manage Billing
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
                Why schools upgrade
              </p>
              <div className="mt-5 grid gap-3">
                {[ 
                  "More teachers and student accounts without admin bottlenecks.",
                  "Clear plan limits that match real nursery growth stages.",
                  "A premium-feeling plan structure that fits real school growth.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-slate-700 shadow-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {notice ? (
          <div className="mt-6 rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[1.75rem] border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-10 grid gap-6 xl:grid-cols-3">
          {orderedPlans.map((plan) => {
            const isFeatured = plan.code === "standard";

            return (
              <article
                key={plan.code}
                className={`rounded-[2.2rem] border p-6 shadow-soft ${
                  isFeatured
                    ? "border-blue-200 bg-gradient-to-b from-blue-50 via-white to-white"
                    : "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                      {plan.features.audience}
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-slate-800">{plan.name}</h2>
                  </div>
                  {isFeatured ? (
                    <span className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      Most Popular
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">{plan.description}</p>
                <p className="mt-5 text-2xl font-semibold text-slate-800">{plan.features.monthly_label}</p>

                <div className="mt-6 grid gap-3">
                  {plan.features.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 rounded-[1.75rem] border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>Teachers</span>
                    <span className="font-semibold">{formatLimit(plan.features.teachers_limit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>Students</span>
                    <span className="font-semibold">{formatLimit(plan.features.students_limit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>Classes</span>
                    <span className="font-semibold">{formatLimit(plan.features.classes_limit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>Recordings</span>
                    <span className="font-semibold">
                      {plan.features.recordings_access === "full" ? "Full" : "Basic"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>Priority features</span>
                    <span className="font-semibold">
                      {plan.features.priority_features ? "Included" : "Not included"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubscribe(plan.code)}
                  disabled={busyPlan === plan.code || plan.is_current}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    isFeatured
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                      : "bg-red-500 text-white shadow-lg shadow-red-100"
                  }`}
                >
                  {busyPlan === plan.code
                    ? "Redirecting to Stripe..."
                    : plan.is_current
                      ? "Current Plan"
                      : `Choose ${plan.name}`}
                </button>
              </article>
            );
          })}
        </section>

        <section className="mt-10 rounded-[2.2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
                Feature Comparison
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-800">
                Capacity at a glance
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Subscribe as an admin to unlock the right limits for your school.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="rounded-l-2xl bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700">
                    Feature
                  </th>
                  {orderedPlans.map((plan) => (
                    <th
                      key={plan.code}
                      className="bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 last:rounded-r-2xl"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-medium text-slate-700">
                      {row.label}
                    </td>
                    {orderedPlans.map((plan) => (
                      <td
                        key={`${plan.code}-${row.key}`}
                        className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600"
                      >
                        {formatLimit(plan.features[row.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="border-b border-slate-100 px-4 py-4 text-sm font-medium text-slate-700">
                    Recordings access
                  </td>
                  {orderedPlans.map((plan) => (
                    <td
                      key={`${plan.code}-recordings`}
                      className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600"
                    >
                      {plan.features.recordings_access === "full" ? "Full" : "Basic"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-4 text-sm font-medium text-slate-700">
                    Premium features
                  </td>
                  {orderedPlans.map((plan) => (
                    <td
                      key={`${plan.code}-priority`}
                      className="px-4 py-4 text-sm text-slate-600"
                    >
                      {plan.features.priority_features ? "Included" : "No"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
            <SiteHeader showAnchorLinks={false} />
            <div className="mt-6">
              <LoadingPanel
                title="Loading pricing"
                message="Preparing subscription plans for your school."
              />
            </div>
          </div>
        </main>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
