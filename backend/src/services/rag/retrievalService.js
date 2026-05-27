import path from 'node:path';
import { env } from '../../config/env.js';
import { getRepositoryRecord, loadRepositoryChunks } from '../repositoryRegistry.js';
import { embedTexts } from './embeddingProvider.js';
import { searchRepositoryVectors } from './lanceVectorStore.js';

export async function retrieveRelevantContext(repoId, query, options = {}) {
  const topK = options.topK || env.MAX_CHAT_CONTEXT_CHUNKS;
  const includeRelated = options.includeRelated ?? true;
  const record = await assertReadyRepository(repoId);
  const chunks = await loadRepositoryChunks(repoId);

  if (chunks.length === 0) return { record, chunks: [] };

  const [queryEmbedding] = await embedTexts([query]);
  const semanticResults = await searchRepositoryVectors(repoId, queryEmbedding, Math.max(topK * 2, 16));
  const lexicalResults = lexicalRank(query, chunks).slice(0, Math.max(topK, 8));
  const merged = mergeRankedResults(semanticResults, lexicalResults);
  const related = includeRelated ? addRelatedChunks(merged.slice(0, topK), chunks) : [];
  const ranked = mergeRankedResults(merged, related).slice(0, topK + (includeRelated ? env.MAX_RELATED_CHUNKS : 0));

  return {
    record,
    chunks: ranked.map((chunk) => ({
      ...chunk,
      excerpt: chunk.excerpt || chunk.content.split(/\r?\n/).slice(0, 12).join('\n')
    }))
  };
}

export async function searchKnowledgeBase(repoId, query, options = {}) {
  const { chunks } = await retrieveRelevantContext(repoId, query, {
    topK: options.topK || 10,
    includeRelated: options.includeRelated ?? false
  });
  return chunks;
}

async function assertReadyRepository(repoId) {
  const record = await getRepositoryRecord(repoId);
  if (record.memory?.status !== 'ready') {
    const error = new Error(record.memory?.message || 'Repository memory is still indexing.');
    error.statusCode = 409;
    error.publicMessage = error.message;
    throw error;
  }
  return record;
}

function lexicalRank(query, chunks) {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return [];

  return chunks
    .map((chunk) => {
      const haystack = [
        chunk.filePath,
        chunk.summary,
        chunk.symbols?.join(' '),
        chunk.imports?.join(' '),
        chunk.content.slice(0, 5000)
      ].join(' ');
      const terms = tokenize(haystack);
      let overlap = 0;
      for (const term of terms) {
        if (queryTerms.has(term)) overlap += 1;
      }

      const pathBonus = [...queryTerms].some((term) => chunk.filePath.toLowerCase().includes(term))
        ? 0.25
        : 0;
      const symbolBonus = chunk.symbols?.some((symbol) =>
        [...queryTerms].some((term) => symbol.toLowerCase().includes(term))
      )
        ? 0.35
        : 0;

      return {
        ...chunk,
        score: Math.min(1, overlap / Math.max(4, queryTerms.size * 3)) + pathBonus + symbolBonus
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);
}

function addRelatedChunks(baseChunks, allChunks) {
  const related = [];
  const byFile = groupByFile(allChunks);

  for (const chunk of baseChunks) {
    const sameFile = byFile.get(chunk.filePath) || [];
    related.push(
      ...sameFile
        .filter((candidate) => candidate.id !== chunk.id)
        .slice(0, 2)
        .map((candidate) => ({ ...candidate, score: Math.max(candidate.score || 0, chunk.score * 0.82) }))
    );

    for (const imported of resolveImportedFiles(chunk, allChunks).slice(0, 3)) {
      related.push({ ...imported, score: Math.max(imported.score || 0, chunk.score * 0.76) });
    }

    for (const importer of findImporters(chunk, allChunks).slice(0, 2)) {
      related.push({ ...importer, score: Math.max(importer.score || 0, chunk.score * 0.7) });
    }
  }

  return related;
}

function resolveImportedFiles(chunk, allChunks) {
  const imports = chunk.imports || [];
  if (imports.length === 0) return [];

  return allChunks.filter((candidate) =>
    imports.some((importSource) => {
      const importBase = path.posix.basename(importSource).replace(/\.[^.]+$/, '').toLowerCase();
      const fileBase = path.posix.basename(candidate.filePath).replace(/\.[^.]+$/, '').toLowerCase();
      return importBase && fileBase && importBase === fileBase;
    })
  );
}

function findImporters(chunk, allChunks) {
  const fileBase = path.posix.basename(chunk.filePath).replace(/\.[^.]+$/, '').toLowerCase();
  return allChunks.filter((candidate) =>
    candidate.imports?.some((importSource) =>
      path.posix.basename(importSource).replace(/\.[^.]+$/, '').toLowerCase() === fileBase
    )
  );
}

function mergeRankedResults(...lists) {
  const byId = new Map();

  for (const list of lists) {
    for (const item of list) {
      const existing = byId.get(item.id);
      if (!existing || (item.score || 0) > (existing.score || 0)) {
        byId.set(item.id, item);
      }
    }
  }

  return [...byId.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function groupByFile(chunks) {
  const grouped = new Map();
  for (const chunk of chunks) {
    const current = grouped.get(chunk.filePath) || [];
    current.push(chunk);
    grouped.set(chunk.filePath, current.sort((a, b) => a.startLine - b.startLine));
  }
  return grouped;
}

function tokenize(text) {
  return String(text || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

const stopWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'where',
  'what',
  'how',
  'does',
  'are',
  'into',
  'file',
  'code'
]);

