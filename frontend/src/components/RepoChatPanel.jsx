import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  FileCode2,
  FileSearch,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  User
} from 'lucide-react';
import {
  getSourcePreview,
  searchRepository,
  streamRepositoryChat
} from '../services/api.js';
import MarkdownMessage from './chat/MarkdownMessage.jsx';
import SourcePreview from './chat/SourcePreview.jsx';

export default function RepoChatPanel({ analysis, memory, queuedQuestion, onQuestionConsumed, onExploreFile }) {
  const ready = memory?.status === 'ready';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  const suggestions = useMemo(() => [
    'Trace the main runtime flow.',
    'Where is configuration loaded?',
    'Explain the most important files.',
    'Find authentication or authorization logic.'
  ], []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (queuedQuestion && ready && !streaming) {
      sendQuestion(queuedQuestion);
      onQuestionConsumed();
    }
  }, [queuedQuestion, ready, streaming]);

  useEffect(() => {
    setMessages([]);
    setPreview(null);
    setSearchResults([]);
    setChatError('');
  }, [analysis.repoId]);

  async function sendQuestion(questionText = input) {
    const question = questionText.trim();
    if (!question || !ready || streaming) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setInput('');
    setChatError('');
    setStreaming(true);

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      relevantFiles: []
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      await streamRepositoryChat({
        repoId: analysis.repoId,
        question,
        signal: abortRef.current.signal,
        onMeta: (payload) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, sources: payload.sources || [], relevantFiles: payload.relevantFiles || [] }
                : message
            )
          );
        },
        onToken: (payload) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${payload.text || ''}` }
                : message
            )
          );
        },
        onError: (payload) => {
          throw new Error(payload.message || 'Streaming failed.');
        }
      });
    } catch (error) {
      setChatError(error.message);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId && !message.content
            ? { ...message, content: `I could not answer that yet: ${error.message}` }
            : message
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  async function runSearch(event) {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query || !ready) return;

    setSearching(true);
    try {
      const payload = await searchRepository(analysis.repoId, query, 10);
      setSearchResults(payload.results || []);
    } catch (error) {
      setSearchResults([]);
      setChatError(error.response?.data?.message || error.message);
    } finally {
      setSearching(false);
    }
  }

  async function openPreview(source) {
    onExploreFile?.(source.filePath);
    setPreviewLoading(true);
    try {
      const payload = await getSourcePreview({
        repoId: analysis.repoId,
        chunkId: source.chunkId,
        filePath: source.filePath
      });
      setPreview(payload);
    } catch (error) {
      setChatError(error.response?.data?.message || error.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyanLens">
              <Sparkles className="h-4 w-4" />
              AI Repository Chat
            </div>
            <h2 className="text-2xl font-semibold text-white">Ask against indexed code context</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/45">
            <span className={`h-2 w-2 rounded-full ${ready ? 'bg-mintLens' : 'animate-pulse bg-amberLens'}`} />
            {ready ? 'RAG ready' : memory?.message || 'Indexing'}
          </div>
        </div>
      </div>

      <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-[620px] flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <EmptyChat ready={ready} suggestions={suggestions} onSelect={sendQuestion} />
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} onOpenSource={openPreview} />
                ))}
              </AnimatePresence>
            )}
            {streaming ? <TypingPulse /> : null}
          </div>

          {chatError ? (
            <div className="mx-4 mb-3 border border-roseLens/30 bg-roseLens/10 px-3 py-2 text-sm text-rose-100">
              {chatError}
            </div>
          ) : null}

          <form className="border-t border-white/10 p-4" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}>
            <div className="command-bar p-2">
              <MessageSquare className="h-5 w-5 shrink-0 text-cyanLens" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                disabled={!ready || streaming}
                onChange={(event) => setInput(event.target.value)}
                placeholder={ready ? 'Ask about architecture, files, flows, dependencies...' : 'Repository memory is indexing...'}
                value={input}
              />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center border border-cyanLens/40 bg-cyanLens text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!ready || streaming || !input.trim()}
                type="submit"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        <div className="grid min-h-[620px] grid-rows-[auto_minmax(0,1fr)]">
          <form className="border-b border-white/10 p-4" onSubmit={runSearch}>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <FileSearch className="h-4 w-4 text-mintLens" />
              Semantic Search
            </div>
            <div className="command-bar p-2">
              <Search className="h-4 w-4 shrink-0 text-mintLens" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                disabled={!ready || searching}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={ready ? 'Search functions, flows, concepts...' : 'Waiting for index'}
                value={searchQuery}
              />
              <button
                className="grid h-9 w-9 place-items-center border border-white/10 bg-white/[0.06] text-white transition hover:border-mintLens/40 disabled:opacity-45"
                disabled={!ready || searching || !searchQuery.trim()}
                type="submit"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </button>
            </div>
            <SearchResults results={searchResults} onOpenSource={openPreview} />
          </form>

          <SourcePreview preview={preview} loading={previewLoading} />
        </div>
      </div>
    </section>
  );
}

function EmptyChat({ ready, suggestions, onSelect }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[8px] border border-cyanLens/30 bg-cyanLens/10 shadow-glow">
          <Bot className="h-7 w-7 text-cyanLens" />
        </div>
        <h3 className="text-2xl font-semibold text-white">Repository context is the prompt</h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/55">
          {ready
            ? 'Answers are built from retrieved chunks, related files, architecture metadata, and citations.'
            : 'The indexer is chunking source files, embedding them, and storing vectors locally.'}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              className="border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-sm text-white/68 transition hover:border-cyanLens/40 hover:text-white disabled:opacity-45"
              disabled={!ready}
              key={suggestion}
              onClick={() => onSelect(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message, onOpenSource }) {
  const isUser = message.role === 'user';

  return (
    <motion.article
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
    >
      {!isUser ? <Avatar icon={Bot} accent="cyan" /> : null}
      <div className={`max-w-[820px] ${isUser ? 'order-first' : ''}`}>
        <div className={`border px-4 py-3 ${isUser ? 'border-cyanLens/25 bg-cyanLens/10' : 'border-white/10 bg-white/[0.04]'}`}>
          {isUser ? (
            <p className="text-sm leading-6 text-white/82">{message.content}</p>
          ) : (
            <div className="space-y-3">
              <MarkdownMessage content={message.content || 'Thinking through retrieved code context...'} />
              {message.sources?.length ? <VisualSourceCards sources={message.sources} onOpenSource={onOpenSource} /> : null}
              {message.relevantFiles?.length ? <FileChips files={message.relevantFiles} /> : null}
            </div>
          )}
        </div>

        {!isUser && message.sources?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.sources.slice(0, 8).map((source) => (
              <button
                className="border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-white/58 transition hover:border-cyanLens/40 hover:text-white"
                key={source.chunkId}
                onClick={() => onOpenSource(source)}
                type="button"
              >
                {source.filePath}:{source.startLine}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {isUser ? <Avatar icon={User} accent="mint" /> : null}
    </motion.article>
  );
}

function Avatar({ icon: Icon, accent }) {
  const classes = accent === 'cyan' ? 'border-cyanLens/30 bg-cyanLens/10 text-cyanLens' : 'border-mintLens/30 bg-mintLens/10 text-mintLens';
  return (
    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border ${classes}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function TypingPulse() {
  return (
    <div className="flex items-center gap-2 pl-12 text-xs text-white/42">
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyanLens" />
      streaming response
    </div>
  );
}

function SearchResults({ results, onOpenSource }) {
  if (results.length === 0) return null;

  return (
    <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
      {results.map((result) => (
        <button
          className="w-full border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-mintLens/40"
          key={result.chunkId}
          onClick={() => onOpenSource(result)}
          type="button"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-white">{result.filePath}</span>
            <span className="text-xs text-mintLens">{Math.round(result.score * 100)}%</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{result.summary}</p>
        </button>
      ))}
    </div>
  );
}

function VisualSourceCards({ sources, onOpenSource }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sources.slice(0, 4).map((source) => (
        <button
          className="group rounded-[12px] border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyanLens/35 hover:bg-white/[0.05]"
          key={source.chunkId}
          onClick={() => onOpenSource(source)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                <FileCode2 className="h-3.5 w-3.5 text-cyanLens" />
                Source
              </div>
              <div className="mt-2 truncate text-sm font-medium text-white">{source.filePath}</div>
            </div>
            <span className="shrink-0 rounded-full border border-mintLens/20 bg-mintLens/10 px-2 py-1 text-[11px] text-mintLens">
              {Math.round(source.score * 100)}%
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/52">{source.summary}</p>
          {source.symbols?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {source.symbols.slice(0, 3).map((symbol) => (
                <span key={symbol} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/50">
                  {symbol}
                </span>
              ))}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function FileChips({ files }) {
  return (
    <div className="flex flex-wrap gap-2">
      {files.slice(0, 6).map((filePath) => (
        <span key={filePath} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/45">
          {filePath}
        </span>
      ))}
    </div>
  );
}

