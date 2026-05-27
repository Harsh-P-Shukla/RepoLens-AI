import { motion } from 'framer-motion';
import { BrainCircuit, Github, Sparkles, TerminalSquare } from 'lucide-react';
import RepoSearchForm from '../components/RepoSearchForm.jsx';
import HeroCanvas from '../components/HeroCanvas.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function Home({ error, loading, onAnalyze }) {
  return (
    <motion.main
      className="relative min-h-screen overflow-hidden bg-ink text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <HeroCanvas />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(103,232,249,0.16),transparent_34%),linear-gradient(180deg,rgba(7,9,13,0.45),#07090d_82%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.06] shadow-glow">
            <BrainCircuit className="h-5 w-5 text-cyanLens" />
          </div>
          <span className="text-sm font-semibold tracking-[0.24em] text-white/80">REPOLENS AI</span>
        </div>
        <div className="hidden items-center gap-2 text-xs text-white/55 sm:flex">
          <TerminalSquare className="h-4 w-4 text-mintLens" />
          Local-first analyzer
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col justify-center px-5 pb-24 pt-10 sm:px-8">
        <motion.div
          className="max-w-4xl"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="mb-5 inline-flex items-center gap-2 border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-cyanLens">
            <Sparkles className="h-4 w-4" />
            Free APIs only. Ollama-ready. AST-assisted.
          </div>

          <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] text-white sm:text-7xl lg:text-8xl">
            RepoLens AI
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68 sm:text-xl">
            Drop in a public GitHub URL and get a clean architectural read: tech stack, folder anatomy,
            dependency relationships, and a graph you can actually navigate.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 max-w-4xl"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.45 }}
        >
          <RepoSearchForm loading={loading} onAnalyze={onAnalyze} />
          <ErrorBanner message={error} />
        </motion.div>

        <div className="mt-10 grid max-w-4xl grid-cols-1 gap-3 text-sm text-white/58 sm:grid-cols-3">
          <div className="border-l border-cyanLens/40 pl-4">Clone and scan repositories safely in temp storage.</div>
          <div className="border-l border-mintLens/40 pl-4">Detect React, Next.js, Express, Python, Docker, and more.</div>
          <div className="border-l border-amberLens/40 pl-4">Render dependency graphs with React Flow.</div>
        </div>
      </section>
    </motion.main>
  );
}

