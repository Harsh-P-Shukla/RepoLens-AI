# RepoLens AI

RepoLens AI is a local-first GitHub repository intelligence system. Part 1 provides repository ingestion, tech detection, architecture extraction, dependency graphs, and a polished React dashboard. Part 2 adds repository memory, embeddings, LanceDB vector search, RAG prompting, semantic search, source citations, and repo chat.

## Apps

- `backend/` - Node.js + Express API that clones, analyzes, indexes, retrieves, and chats with repositories.
- `frontend/` - React + Vite UI with TailwindCSS, Framer Motion, React Flow, markdown, and syntax highlighting.

## Quick Start

Install dependencies in both apps:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the frontend URL printed by Vite, usually `http://localhost:5173`.

## Free AI Providers

The backend supports only free/local providers:

- `AI_PROVIDER=none` - deterministic local summary, no network needed.
- `AI_PROVIDER=ollama` - local Ollama endpoint.
- `AI_PROVIDER=huggingface` - Hugging Face Inference API free tier.

No paid APIs are required.

## Intelligence Layer

- Smart chunking preserves function, class, route, and module boundaries.
- Embeddings are configurable through Ollama, Python sentence-transformers, or local deterministic vectors.
- LanceDB persists vectors locally under `backend/storage/lancedb`.
- Retrieval blends semantic vector search, lexical search, same-file expansion, and import-aware related chunks.
- Repo chat answers include citations and source previews.

## Test Repositories

Try these public repositories:

- `https://github.com/vercel/next.js`
- `https://github.com/vitejs/vite`
- `https://github.com/expressjs/express`
- `https://github.com/facebook/react`
