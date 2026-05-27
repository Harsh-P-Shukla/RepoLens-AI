import { BrainCircuit, Database, FileStack, Layers3, MessageSquareText, Sparkles } from 'lucide-react';
import { formatNumber } from '../utils/format.js';

export default function RepoMemorySidebar({ analysis, memory, onSelectQuestion }) {
  const ready = memory?.status === 'ready';
  const suggestions = buildSuggestions(analysis);

  return (
    <aside className="glass-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyanLens">
            <BrainCircuit className="h-4 w-4" />
            Repo Memory
          </div>
          <h2 className="text-2xl font-semibold text-white">{ready ? 'Ready' : statusLabel(memory?.status)}</h2>
        </div>
        <div className={`h-3 w-3 rounded-full ${ready ? 'bg-mintLens' : 'animate-pulse bg-amberLens'}`} />
      </div>

      <p className="mt-4 text-sm leading-6 text-white/56">{memory?.message || 'Preparing repository memory.'}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MemoryMetric icon={FileStack} label="Files" value={formatNumber(memory?.indexedFiles)} />
        <MemoryMetric icon={Layers3} label="Chunks" value={formatNumber(memory?.chunkCount)} />
        <MemoryMetric icon={Sparkles} label="Embedding" value={memory?.embeddingProvider || 'auto'} />
        <MemoryMetric icon={Database} label="Vector DB" value={memory?.vectorDatabase || 'lancedb'} />
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Languages</div>
        <div className="flex flex-wrap gap-2">
          {(memory?.languages || []).slice(0, 10).map((language) => (
            <span key={language} className="border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/62">
              {language}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <MessageSquareText className="h-4 w-4 text-mintLens" />
          Smart Questions
        </div>
        <div className="grid gap-2">
          {suggestions.map((question) => (
            <button
              className="border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-sm text-white/68 transition hover:border-cyanLens/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!ready}
              key={question}
              onClick={() => onSelectQuestion(question)}
              type="button"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function MemoryMetric({ icon: Icon, label, value }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/38">
        <Icon className="h-3.5 w-3.5 text-cyanLens" />
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-white">{value || '0'}</div>
    </div>
  );
}

function statusLabel(status) {
  if (status === 'failed') return 'Needs attention';
  if (status === 'indexing') return 'Indexing';
  return 'Preparing';
}

function buildSuggestions(analysis) {
  const base = [
    'Explain the architecture visually.',
    'Trace the main execution flow.',
    'Generate a beginner walkthrough.',
    'Which files should I read first?'
  ];

  const techNames = new Set((analysis.techStack || []).map((tech) => tech.name));
  if (techNames.has('React')) base.splice(2, 0, 'How does UI connect to the API?');
  if (techNames.has('Express')) base.splice(1, 0, 'What happens during login?');
  if (techNames.has('MongoDB') || techNames.has('Firebase')) base.push('Which file handles database connections?');
  if ((analysis.architecture?.entrypoints || []).length > 0) base.push(`Start with ${analysis.architecture.entrypoints[0]}`);
  return base.slice(0, 7);
}

