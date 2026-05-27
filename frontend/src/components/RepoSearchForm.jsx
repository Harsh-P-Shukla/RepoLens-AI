import { useState } from 'react';
import { Github, Loader2, ScanLine } from 'lucide-react';

const example = 'https://github.com/vitejs/vite';

export default function RepoSearchForm({ compact = false, loading, onAnalyze }) {
  const [repoUrl, setRepoUrl] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    onAnalyze(repoUrl || example);
  }

  return (
    <form
      className={`command-bar ${compact ? 'p-2' : 'p-3 sm:p-4'}`}
      onSubmit={handleSubmit}
    >
      <Github className="h-5 w-5 shrink-0 text-cyanLens" />
      <input
        aria-label="GitHub repository URL"
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35 sm:text-base"
        disabled={loading}
        onChange={(event) => setRepoUrl(event.target.value)}
        placeholder={example}
        type="url"
        value={repoUrl}
      />
      <button
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-cyanLens/40 bg-cyanLens px-4 text-sm font-semibold text-ink shadow-glow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
        disabled={loading}
        type="submit"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
        <span className="hidden sm:inline">{loading ? 'Analyzing' : 'Analyze'}</span>
      </button>
    </form>
  );
}

