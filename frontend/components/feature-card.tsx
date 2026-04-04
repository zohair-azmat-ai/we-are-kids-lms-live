type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  accentClassName: string;
};

export function FeatureCard({
  icon,
  title,
  description,
  accentClassName,
}: FeatureCardProps) {
  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-1">
      <div
        className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white ${accentClassName}`}
      >
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-800">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
