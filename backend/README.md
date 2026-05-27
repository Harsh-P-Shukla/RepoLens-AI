# RepoLens AI Backend

Express API for cloning, analyzing, indexing, and chatting with GitHub repositories.

## Features

- Validates public GitHub repository URLs.
- Clones repositories into a temporary folder with `simple-git`.
- Scans folder structure while ignoring dependencies, build output, binaries, and large assets.
- Detects common technologies from manifests, configs, imports, and file types.
- Builds AST-assisted dependency metadata with tree-sitter when available.
- Falls back gracefully to deterministic parsing if optional native tree-sitter packages are unavailable.
- Generates beginner-friendly summaries with local deterministic logic, Ollama, or Hugging Face free tier.
- Builds a local repository knowledge base with smart chunks, embeddings, LanceDB vectors, and citations.
- Supports repo chat, semantic search, source preview, and memory status APIs.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:5000` by default.

## RAG Pipeline

1. `/analyze` clones and scans a public GitHub repository.
2. The analyzer returns architecture metadata and a `repoId`.
3. A background indexer prioritizes source/config/doc files.
4. Files are chunked by module, function, class, route, or bounded windows.
5. Chunks are embedded with `EMBEDDING_PROVIDER`.
6. Vectors are stored locally in LanceDB under `storage/lancedb`.
7. `/repo/chat` embeds the question, retrieves semantic + lexical matches, expands related chunks, builds a contextual prompt, and returns cited answers.

The app never sends entire repositories to an LLM prompt.

## Analyze Endpoint

`POST /analyze`

```json
{
  "repoUrl": "https://github.com/vitejs/vite"
}
```

Response shape:

```json
{
  "projectName": "vite",
  "repoId": "",
  "techStack": [],
  "summary": "",
  "architecture": {},
  "folderTree": {},
  "dependencyGraph": {
    "nodes": [],
    "edges": []
  },
  "stats": {}
}
```

## Repo Memory APIs

`GET /repo/:repoId/memory`

Returns indexing status, chunk count, indexed files, languages, embedding provider, and vector database.

`POST /repo/chat`

```json
{
  "repoId": "",
  "question": "Where are API routes defined?"
}
```

`POST /repo/chat/stream`

Streams Server-Sent Events with `meta`, `token`, and `done` events.

`POST /repo/search`

```json
{
  "repoId": "",
  "query": "authentication middleware"
}
```

`POST /repo/source`

```json
{
  "repoId": "",
  "chunkId": ""
}
```

## AI Provider Modes

- `AI_PROVIDER=none` uses the built-in summary engine and requires no network.
- `AI_PROVIDER=ollama` calls your local Ollama instance.
- `AI_PROVIDER=huggingface` calls Hugging Face Inference API with `HUGGING_FACE_API_KEY`.

All supported providers are free-to-use or local.

## Embeddings

- `EMBEDDING_PROVIDER=auto` tries Ollama embeddings first, then falls back to local deterministic embeddings.
- `EMBEDDING_PROVIDER=ollama` uses `nomic-embed-text` or any local Ollama embedding model.
- `EMBEDDING_PROVIDER=sentence-transformers` shells out to Python with `sentence-transformers` installed.
- `EMBEDDING_PROVIDER=local` uses deterministic local vectors and needs no network.

Xenova support is intentionally left opt-in because current `@xenova/transformers` releases pull vulnerable ONNX/protobuf transitive packages in npm audit.

## Example Questions

- `Explain the backend request flow.`
- `Where are API routes defined?`
- `Which files should I read first?`
- `How is state managed?`
- `Which file handles database connections?`
