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

Set `VITE_API_BASE_URL` in `.env` to point at your backend. The sample value targets the deployed Render API, while the fallback in code still supports local development at `http://localhost:5000`.

## Screens

- Home page with GitHub URL analysis input.
- Analysis dashboard with overview cards, folder tree, tech stack visualization, dependency graph, and summary.
- AI repo chat workspace with streaming answers, citations, semantic search, and source preview.

## Repo Chat Flow

After analysis, the dashboard polls `GET /repo/:repoId/memory` until indexing is ready. Chat requests stream through `POST /repo/chat/stream`, and citation clicks call `POST /repo/source` to preview the indexed code chunk.
