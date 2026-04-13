"use client";

export function AdminDemoHelpCard() {
  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
        Demo Guide
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-800">
        What to show in a live product demo
      </h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Demo Account
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Use the seeded admin, teacher, and student accounts already in the LMS to move across dashboards quickly during a walkthrough.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-500">
            Best Features
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Show billing limits, AI insights, Jitsi classroom joining, recording upload flow, and the floating AI assistant in one pass.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">
            Suggested Flow
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Start on admin analytics, open billing, ask the AI assistant for usage help, then switch to teacher and launch a live classroom.
          </p>
        </article>
      </div>
    </section>
  );
}
