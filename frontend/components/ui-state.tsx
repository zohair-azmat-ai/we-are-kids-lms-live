"use client";

type SpinnerProps = {
  className?: string;
};

type LoadingPanelProps = {
  title: string;
  message?: string;
  compact?: boolean;
};

type EmptyStateProps = {
  title: string;
  message: string;
};

export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 ${className}`}
    />
  );
}

export function LoadingPanel({
  title,
  message,
  compact = false,
}: LoadingPanelProps) {
  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <div
        className={`flex items-center gap-4 ${compact ? "min-h-[96px]" : "min-h-[140px]"}`}
      >
        <Spinner className="h-6 w-6" />
        <div>
          <p className="text-base font-semibold text-slate-800">{title}</p>
          {message ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
    </div>
  );
}
