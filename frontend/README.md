# RepoLens AI Frontend

React + Vite dashboard for repository analysis.

## Stack

- React + Vite
- TailwindCSS
- Framer Motion
- React Flow via `@xyflow/react`
- Axios
- Lucide icons
- React Markdown
- React Syntax Highlighter

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The app expects the backend at `http://localhost:5000` unless `VITE_API_URL` is changed.

## Screens

- Home page with GitHub URL analysis input.
- Analysis dashboard with overview cards, folder tree, tech stack visualization, dependency graph, and summary.
- AI repo chat workspace with streaming answers, citations, semantic search, and source preview.

## Repo Chat Flow

After analysis, the dashboard polls `GET /repo/:repoId/memory` until indexing is ready. Chat requests stream through `POST /repo/chat/stream`, and citation clicks call `POST /repo/source` to preview the indexed code chunk.
