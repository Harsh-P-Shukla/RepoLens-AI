import { BookOpen, GitBranch } from 'lucide-react';

export default function SummaryPanel({ summary, architecture }) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-cyanLens" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Summary</h2>
      </div>
      <p className="text-sm leading-7 text-white/68">{summary}</p>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          <GitBranch className="h-4 w-4 text-mintLens" />
          Data Flow
        </div>
        <div className="flex flex-wrap gap-2">
          {architecture.dataFlow.map((step, index) => (
            <span key={step} className="border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/64">
              {index + 1}. {step}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

