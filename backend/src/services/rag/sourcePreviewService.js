import { loadRepositoryChunks } from '../repositoryRegistry.js';

export async function previewSource(repoId, { chunkId, filePath }) {
  const chunks = await loadRepositoryChunks(repoId);
  const matching = chunkId
    ? chunks.filter((chunk) => chunk.id === chunkId)
    : chunks.filter((chunk) => chunk.filePath === filePath);

  if (matching.length === 0) {
    const error = new Error('Source preview was not found in repository memory.');
    error.statusCode = 404;
    error.publicMessage = error.message;
    throw error;
  }

  const sorted = matching.sort((a, b) => a.startLine - b.startLine);
  const first = sorted[0];

  return {
    repoId,
    filePath: first.filePath,
    language: first.language,
    startLine: first.startLine,
    endLine: sorted.at(-1).endLine,
    symbols: [...new Set(sorted.flatMap((chunk) => chunk.symbols || []))],
    snippets: sorted.map((chunk) => ({
      chunkId: chunk.id,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      summary: chunk.summary,
      content: chunk.content
    }))
  };
}

