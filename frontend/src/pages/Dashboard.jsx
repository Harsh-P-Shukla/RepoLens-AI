import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Github, RefreshCw, Search } from 'lucide-react';
import RepoSearchForm from '../components/RepoSearchForm.jsx';
import OverviewCards from '../components/OverviewCards.jsx';
import FolderTree from '../components/FolderTree.jsx';
import DependencyGraph from '../components/DependencyGraph.jsx';
import VisualIntelligencePanel from '../components/VisualIntelligencePanel.jsx';
import TechStackPanel from '../components/TechStackPanel.jsx';
import SummaryPanel from '../components/SummaryPanel.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import RepoChatPanel from '../components/RepoChatPanel.jsx';
import RepoMemorySidebar from '../components/RepoMemorySidebar.jsx';
import { getRepoMemory } from '../services/api.js';

export default function Dashboard({ analysis, error, loading, onAnalyze, onReset }) {
  const [memory, setMemory] = useState(analysis.memory);
  const [queuedQuestion, setQueuedQuestion] = useState('');
  const [exploredFiles, setExploredFiles] = useState([]);

  useEffect(() => {
    let active = true;
    let intervalId;
    setMemory(analysis.memory);
    setExploredFiles([]);

    async function refreshMemory() {
      try {
        const next = await getRepoMemory(analysis.repoId);
        if (!active) return;
        setMemory(next);

        if (['ready', 'failed'].includes(next.status)) {
          clearInterval(intervalId);
        }
      } catch {
        if (active) {
          setMemory((current) => ({
            ...current,
            status: 'failed',
            message: 'Unable to read repository memory status.'
          }));
        }
      }
    }

    if (analysis.repoId) {
      refreshMemory();
      intervalId = setInterval(refreshMemory, 1800);
    }

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [analysis]);

  function markExplored(filePath) {
    if (!filePath) return;
    setExploredFiles((current) => (current.includes(filePath) ? current : [...current, filePath]));
  }

  return (
    <motion.main
      className="min-h-screen bg-ink text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(103,232,249,0.12),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(251,191,36,0.1),transparent_28%),linear-gradient(180deg,#07090d,#0b0d11_52%,#07090d)]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <button className="flex w-fit items-center gap-3 text-left" onClick={onReset} type="button">
            <div className="grid h-9 w-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.06]">
              <BrainCircuit className="h-5 w-5 text-cyanLens" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-white/85">REPOLENS AI</div>
              <div className="text-xs text-white/45">Repository intelligence workspace</div>
            </div>
          </button>

          <div className="flex flex-col gap-3 lg:min-w-[560px]">
            <RepoSearchForm compact loading={loading} onAnalyze={onAnalyze} />
            <ErrorBanner message={error} compact />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/48">
              <Github className="h-4 w-4 text-white/60" />
              <span>{analysis.repository?.url}</span>
            </div>
            <h1 className="text-3xl font-semibold text-white sm:text-5xl">{analysis.projectName}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/62">{analysis.architecture.projectType}</p>
          </div>
          <button
            className="inline-flex h-10 w-fit items-center gap-2 border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white/75 transition hover:border-cyanLens/40 hover:text-white"
            onClick={onReset}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            New analysis
          </button>
        </div>

        <OverviewCards analysis={analysis} />

        <div className="mt-6">
          <VisualIntelligencePanel analysis={analysis} exploredFiles={exploredFiles} memory={memory} onExploreFile={markExplored} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <RepoMemorySidebar
            analysis={analysis}
            memory={memory}
            onSelectQuestion={(question) => setQueuedQuestion(question)}
          />
          <RepoChatPanel
            analysis={analysis}
            memory={memory}
            queuedQuestion={queuedQuestion}
            onExploreFile={markExplored}
            onQuestionConsumed={() => setQueuedQuestion('')}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-6">
            <SummaryPanel summary={analysis.summary} architecture={analysis.architecture} />
            <TechStackPanel techStack={analysis.techStack} />
            <section className="glass-panel p-4">
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-mintLens" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Folder Tree</h2>
              </div>
              <FolderTree tree={analysis.folderTree} />
            </section>
          </div>

          <DependencyGraph analysis={analysis} graph={analysis.dependencyGraph} onExploreFile={markExplored} />
        </div>
      </section>
    </motion.main>
  );
}
