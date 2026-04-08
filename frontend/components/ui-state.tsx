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
  ctaLabel?: string;
  onCtaClick?: () => void;
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

export function EmptyState({ title, message, ctaLabel, onCtaClick }: EmptyStateProps) {
  return (
    <div className="glass-card rounded-2xl px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <span className="text-lg font-semibold">◎</span>
      </div>
      <p className="mt-4 text-base font-semibold tracking-tight text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{message}</p>
      {ctaLabel && onCtaClick ? (
        <button
          type="button"
          onClick={onCtaClick}
          className="premium-button btn-primary mt-5 px-4 py-2 text-sm font-semibold"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
