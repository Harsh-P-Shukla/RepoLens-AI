const accentClasses = {
  cyan: 'text-cyanLens bg-cyanLens/10 border-cyanLens/30',
  mint: 'text-mintLens bg-mintLens/10 border-mintLens/30',
  amber: 'text-amberLens bg-amberLens/10 border-amberLens/30',
  rose: 'text-roseLens bg-roseLens/10 border-roseLens/30'
};

export default function StatCard({ icon: Icon, label, value, detail, accent }) {
  return (
    <article className="glass-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/42">{label}</p>
          <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-6 text-white">{value}</h3>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border ${accentClasses[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-white/48">{detail}</p>
    </article>
  );
}

