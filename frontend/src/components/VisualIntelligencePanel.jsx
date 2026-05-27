import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Clock3,
  FileCode2,
  Layers3,
  Loader2,
  Play,
  Route,
  Sparkles,
  Target
} from 'lucide-react';
import { getRepoFlow, getRepoWalkthrough } from '../services/api.js';
import { buildLearningProgressModel } from '../utils/architectureInsights.js';

const DEFAULT_FLOW_QUERY = 'What happens during login?';

export default function VisualIntelligencePanel({ analysis, memory, exploredFiles = [], onExploreFile }) {
  const ready = Boolean(analysis?.repoId);
  const live = memory?.status === 'ready';
  const [mode, setMode] = useState('flow');
  const [flowQuery, setFlowQuery] = useState(DEFAULT_FLOW_QUERY);
  const [level, setLevel] = useState('beginner');
  const [flow, setFlow] = useState(null);
  const [walkthrough, setWalkthrough] = useState(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [loadingWalkthrough, setLoadingWalkthrough] = useState(false);
  const [error, setError] = useState('');
  const progress = useMemo(() => buildLearningProgressModel(analysis, exploredFiles), [analysis, exploredFiles]);

  const flowExamples = useMemo(() => {
    const projectType = String(analysis?.architecture?.projectType || '').toLowerCase();
    const examples = [
      DEFAULT_FLOW_QUERY,
      'Trace the request from UI to persistence.',
      'How does authentication travel through the app?'
    ];

    if (projectType.includes('frontend')) examples.push('What happens when the main page loads?');
    if (projectType.includes('express') || projectType.includes('node')) examples.push('Explain the API request path visually.');
    if (projectType.includes('full-stack')) examples.push('Show the data flow between frontend and backend.');

    return [...new Set(examples)].slice(0, 5);
  }, [analysis]);

  useEffect(() => {
    if (!analysis?.repoId) return;

    loadFlow(DEFAULT_FLOW_QUERY);
    loadWalkthrough(level);
    // The panel stays in sync with the current repository analysis.
  }, [analysis?.repoId]);

  useEffect(() => {
    if (!analysis?.repoId) return;
    loadWalkthrough(level);
  }, [level]);

  async function loadFlow(query = flowQuery) {
    const nextQuery = query.trim() || DEFAULT_FLOW_QUERY;
    setFlowQuery(nextQuery);
    setLoadingFlow(true);
    setError('');

    try {
      const payload = await getRepoFlow(analysis.repoId, nextQuery);
      setFlow(payload);
      setMode('flow');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Failed to generate execution flow.');
    } finally {
      setLoadingFlow(false);
    }
  }

  async function loadWalkthrough(nextLevel = level) {
    if (!analysis?.repoId) return;
    setLoadingWalkthrough(true);
    setError('');

    try {
      const payload = await getRepoWalkthrough(analysis.repoId, nextLevel);
      setWalkthrough(payload);
      setLevel(nextLevel);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Failed to generate walkthrough.');
    } finally {
      setLoadingWalkthrough(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (mode === 'flow') {
      loadFlow(flowQuery);
    } else {
      loadWalkthrough(level);
    }
  }

  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyanLens">
              <Sparkles className="h-4 w-4" />
              Visual Intelligence Studio
            </div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">See architecture as a guided motion system</h2>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Generate execution paths, then switch into a beginner-friendly roadmap that teaches the repository in the right order.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-white/46 sm:grid-cols-4 xl:min-w-[360px]">
            <StudioMetric icon={Route} label="Flow" value={flow?.steps?.length || 0} />
            <StudioMetric icon={BookOpen} label="Roadmap" value={walkthrough?.steps?.length || 0} />
            <StudioMetric icon={Clock3} label="Learn" value={walkthrough?.estimatedTime || '—'} />
            <StudioMetric icon={BrainCircuit} label="Live" value={live ? 'Ready' : 'Indexing'} accent={live ? 'mint' : 'amber'} />
          </div>
        </div>
      </div>

      <form className="border-b border-white/10 p-4" onSubmit={handleSubmit}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ToggleButton active={mode === 'flow'} icon={Route} onClick={() => setMode('flow')} type="button">
            Execution Flow
          </ToggleButton>
          <ToggleButton active={mode === 'walkthrough'} icon={BookOpen} onClick={() => setMode('walkthrough')} type="button">
            Walkthrough
          </ToggleButton>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'flow' ? (
            <motion.div
              key="flow-input"
              className="command-bar p-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Route className="h-4 w-4 shrink-0 text-cyanLens" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                onChange={(event) => setFlowQuery(event.target.value)}
                placeholder="Ask for an execution sequence"
                value={flowQuery}
              />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center border border-cyanLens/40 bg-cyanLens text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!ready || loadingFlow}
                type="submit"
              >
                {loadingFlow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="walkthrough-input"
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="command-bar flex-1 p-2">
                <BookOpen className="h-4 w-4 shrink-0 text-mintLens" />
                <select
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                  onChange={(event) => setLevel(event.target.value)}
                  value={level}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button
                  className="grid h-10 w-10 shrink-0 place-items-center border border-mintLens/40 bg-mintLens text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!ready || loadingWalkthrough}
                  type="submit"
                >
                  {loadingWalkthrough ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-white/45">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">Recommended reading order</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">Progressively disclosed</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap gap-2">
          {flowExamples.map((example) => (
            <button
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/64 transition hover:border-cyanLens/40 hover:text-white"
              key={example}
              onClick={() => loadFlow(example)}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}
      </form>

      <div className="grid min-h-[620px] grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="border-b border-white/10 xl:border-b-0 xl:border-r">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'flow' ? (
              <motion.div
                key="flow-view"
                className="p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <FlowView flow={flow} loading={loadingFlow} onExploreFile={onExploreFile} />
              </motion.div>
            ) : (
              <motion.div
                key="walkthrough-view"
                className="p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <WalkthroughView walkthrough={walkthrough} loading={loadingWalkthrough} onExploreFile={onExploreFile} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-5">
          <ArchitectureSummary analysis={analysis} flow={flow} walkthrough={walkthrough} live={live} progress={progress} />
        </div>
      </div>
    </section>
  );
}

function FlowView({ flow, loading, onExploreFile }) {
  if (loading && !flow) {
    return <EmptyState title="Generating execution flow" description="Pulling architecture context and building a visual traversal." />;
  }

  if (!flow?.steps?.length) {
    return <EmptyState title="No flow yet" description="Ask a question above to render an execution sequence." />;
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyanLens">Execution Flow</div>
          <h3 className="mt-2 text-2xl font-semibold text-white">{flow.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/52">Rendered from the dependency graph, architecture metadata, and retrieved repository context.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/52">
          {flow.steps.length} steps / {flow.connections?.length || 0} links
        </div>
      </div>

      <div className="relative pl-5">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-cyanLens/60 via-mintLens/40 to-transparent" />
        <div className="space-y-3">
          {flow.steps.map((step, index) => (
            <motion.div
              key={step.id}
              className="relative rounded-[12px] border border-white/10 bg-white/[0.035] p-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <div className="absolute -left-[1.05rem] top-5 grid h-4 w-4 place-items-center rounded-full border border-cyanLens/40 bg-ink shadow-glow">
                <span className="h-2 w-2 rounded-full bg-cyanLens" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/44">{step.kind}</div>
                  <h4 className="mt-1 text-lg font-semibold text-white">{step.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-white/60">{step.description}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <Layers3 className="h-3.5 w-3.5 text-mintLens" />
                  {step.importance}%
                </div>
              </div>

              {step.files?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {step.files.map((filePath) => (
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65 transition hover:border-cyanLens/40 hover:text-white"
                      key={filePath}
                      onClick={() => onExploreFile?.(filePath)}
                      type="button"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      {shortenPath(filePath)}
                    </button>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WalkthroughView({ walkthrough, loading, onExploreFile }) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  useEffect(() => {
    if (walkthrough?.steps?.length) setExpandedIndex(0);
  }, [walkthrough?.steps?.length]);

  if (loading && !walkthrough) {
    return <EmptyState title="Building roadmap" description="Selecting entrypoints and arranging a progressive reading order." />;
  }

  if (!walkthrough?.steps?.length) {
    return <EmptyState title="No walkthrough yet" description="Switch to beginner mode to generate a guided path." />;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-mintLens">Walkthrough Mode</div>
          <h3 className="mt-2 text-2xl font-semibold text-white">Repository onboarding roadmap</h3>
          <p className="mt-2 text-sm leading-6 text-white/52">Recommended reading order with focused learning goals and time estimates.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-white/45">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">{walkthrough.estimatedTime}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">{walkthrough.steps.length} steps</span>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {walkthrough.learningGoals.map((goal) => (
          <span key={goal} className="rounded-full border border-mintLens/20 bg-mintLens/10 px-3 py-2 text-xs text-mintLens">
            {goal}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {walkthrough.steps.map((step, index) => {
          const expanded = expandedIndex === index;
          return (
            <motion.button
              className={`w-full rounded-[12px] border p-4 text-left transition ${expanded ? 'border-mintLens/35 bg-mintLens/10' : 'border-white/10 bg-white/[0.035] hover:border-mintLens/25'}`}
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setExpandedIndex(expanded ? -1 : index)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-white/70">
                      {step.order}
                    </span>
                    {step.kind}
                  </div>
                  <h4 className="mt-2 text-lg font-semibold text-white">{step.title}</h4>
                </div>
                <ChevronState open={expanded} />
              </div>

              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    className="mt-3 space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <p className="text-sm leading-6 text-white/60">{step.reason}</p>
                    <div className="rounded-[10px] border border-white/10 bg-black/20 p-3 text-sm text-white/65">
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                        <Target className="h-3.5 w-3.5 text-cyanLens" />
                        Focus
                      </div>
                      {step.focus}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58">{shortenPath(step.file)}</span>
                      {step.supportingFiles?.map((filePath) => (
                        <button
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58 transition hover:border-mintLens/35 hover:text-white"
                          key={filePath}
                          onClick={(event) => {
                            event.stopPropagation();
                            onExploreFile?.(filePath);
                          }}
                          type="button"
                        >
                          {shortenPath(filePath)}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ArchitectureSummary({ analysis, flow, walkthrough, live, progress }) {
  const architecture = analysis?.architecture || {};

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/44">Understanding Progress</div>
        <h3 className="mt-2 text-2xl font-semibold text-white">Learning cockpit</h3>
        <p className="mt-2 text-sm leading-6 text-white/54">A compact summary of what the AI has learned, what the graph emphasizes, and where to go next.</p>
      </div>

      <div className="grid gap-3">
        <SummaryTile label="Architecture" value={architecture.architectureStyle || 'Modular repository'} detail={architecture.projectType || 'Repository'} />
        <SummaryTile label="Files explored" value={`${progress.exploredFiles} / ${progress.totalFiles || '—'}`} detail={`${Math.round(progress.fileCoverage * 100)}% file coverage`} />
        <SummaryTile label="Walkthrough" value={walkthrough?.estimatedTime || '—'} detail={walkthrough?.steps?.[0]?.title || 'Beginner roadmap pending'} />
      </div>

      <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <Layers3 className="h-4 w-4 text-mintLens" />
          Hot path signals
        </div>
        <div className="space-y-3">
          <ProgressBar label="Flow readiness" value={live ? 100 : 65} accent="cyan" />
          <ProgressBar label="Visual coverage" value={Math.round(progress.roleCoverage * 100)} accent="mint" />
          <ProgressBar label="Reading order" value={Math.min(100, (walkthrough?.steps?.length || 0) * 15)} accent="amber" />
        </div>
      </div>

      <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <FileCode2 className="h-4 w-4 text-cyanLens" />
          Architecture hotspots
        </div>
        <div className="space-y-2">
          {(progress.hotspots || []).slice(0, 4).map((hotspot) => (
            <div key={hotspot.path} className="rounded-[10px] border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{hotspot.path}</div>
                  <div className="mt-1 text-xs text-white/42">{hotspot.visualType || 'module'} hotspot</div>
                </div>
                <span className="rounded-full border border-mintLens/20 bg-mintLens/10 px-2 py-1 text-[11px] text-mintLens">
                  {hotspot.importance}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyanLens via-mintLens to-amberLens" style={{ width: `${hotspot.importance}%` }} />
              </div>
            </div>
          ))}
          {!(progress.hotspots || []).length ? <span className="text-sm text-white/42">No hotspot signals available yet.</span> : null}
        </div>
      </div>

      <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <Target className="h-4 w-4 text-cyanLens" />
          Next topics
        </div>
        <div className="flex flex-wrap gap-2">
          {(progress.nextTopics || []).map((topic) => (
            <span key={topic.path} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58">
              {shortenPath(topic.path)}
            </span>
          ))}
          {!(progress.nextTopics || []).length ? <span className="text-sm text-white/42">Explore a few nodes to unlock next reading topics.</span> : null}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, detail }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/52">{detail}</div>
    </div>
  );
}

function ProgressBar({ label, value, accent }) {
  const accentClass = accent === 'mint' ? 'from-mintLens to-cyanLens' : accent === 'amber' ? 'from-amberLens to-mintLens' : 'from-cyanLens to-mintLens';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/42">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r ${accentClass}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function StudioMetric({ icon: Icon, label, value, accent = 'cyan' }) {
  const accentClasses = accent === 'mint' ? 'text-mintLens border-mintLens/25 bg-mintLens/10' : accent === 'amber' ? 'text-amberLens border-amberLens/25 bg-amberLens/10' : 'text-cyanLens border-cyanLens/25 bg-cyanLens/10';

  return (
    <div className={`rounded-[12px] border p-3 ${accentClasses}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function ToggleButton({ active, icon: Icon, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${active ? 'border-cyanLens/40 bg-cyanLens/10 text-cyanLens' : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white'}`}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function ChevronState({ open }) {
  return (
    <div className={`grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition ${open ? 'text-mintLens' : 'text-white/48'}`}>
      <ArrowRight className={`h-4 w-4 transition ${open ? 'rotate-90' : 'rotate-0'}`} />
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="grid min-h-[420px] place-items-center">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[12px] border border-white/10 bg-white/[0.04] text-cyanLens shadow-glow">
          <BrainCircuit className="h-7 w-7" />
        </div>
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/52">{description}</p>
      </div>
    </div>
  );
}

function shortenPath(filePath) {
  const parts = String(filePath || '').split('/');
  if (parts.length <= 2) return filePath;
  return `${parts.slice(-3).join('/')}`;
}
