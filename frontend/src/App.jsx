import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { analyzeRepository } from './services/api.js';
import Dashboard from './pages/Dashboard.jsx';
import Home from './pages/Home.jsx';

export default function App() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze(repoUrl) {
    setLoading(true);
    setError('');

    try {
      const result = await analyzeRepository(repoUrl);
      setAnalysis(result);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Analysis failed. Check the repository URL and backend server.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {analysis ? (
        <Dashboard
          key="dashboard"
          analysis={analysis}
          error={error}
          loading={loading}
          onAnalyze={handleAnalyze}
          onReset={() => {
            setAnalysis(null);
            setError('');
          }}
        />
      ) : (
        <Home key="home" error={error} loading={loading} onAnalyze={handleAnalyze} />
      )}
    </AnimatePresence>
  );
}

