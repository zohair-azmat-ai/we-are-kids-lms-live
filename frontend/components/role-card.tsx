type RoleCardProps = {
  icon: string;
  label: string;
  title: string;
  description: string;
  points: string[];
  accentClassName: string;
};

export function RoleCard({
  icon,
  label,
  title,
  description,
  points,
  accentClassName,
}: RoleCardProps) {
  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft transition duration-200 hover:-translate-y-1 hover:border-slate-200">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white ${accentClassName}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {label}
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-800">{title}</h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>

      <div className="mt-6 space-y-3">
        {points.map((point) => (
          <div
            key={point}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {point}
          </div>
        ))}
      </div>
    </article>
  );
}
