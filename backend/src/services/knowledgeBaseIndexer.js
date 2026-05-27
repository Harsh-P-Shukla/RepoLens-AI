import { env } from '../config/env.js';
import { cleanupClone } from './cleanup.js';
import { chunkRepositoryFiles } from './rag/codeChunker.js';
import { embedTexts, getActiveEmbeddingProvider } from './rag/embeddingProvider.js';
import {
  saveRepositoryChunks,
  updateRepositoryRecord
} from './repositoryRegistry.js';
import { replaceRepositoryVectors } from './rag/lanceVectorStore.js';

const activeJobs = new Map();

export function startRepositoryIndexing({ repoId, scan, analysis, cleanupPath }) {
  if (activeJobs.has(repoId)) return activeJobs.get(repoId);

  const job = indexRepository({ repoId, scan, analysis })
    .catch(async (error) => {
      await updateRepositoryRecord(repoId, {
        status: 'failed',
        memory: {
          status: 'failed',
          message: error.publicMessage || error.message || 'Repository indexing failed.'
        }
      }).catch(() => {});
    })
    .finally(async () => {
      activeJobs.delete(repoId);
      await cleanupClone(cleanupPath);
    });

  activeJobs.set(repoId, job);
  return job;
}

export async function indexRepository({ repoId, scan, analysis }) {
  await updateRepositoryRecord(repoId, {
    status: 'indexing',
    memory: {
      status: 'indexing',
      message: 'Prioritizing source files and building code chunks.'
    }
  });

  const chunks = (await chunkRepositoryFiles(scan, {
    maxFiles: env.MAX_INDEX_FILES,
    maxChunks: env.MAX_INDEX_CHUNKS
  })).map((chunk) => ({ ...chunk, repoId }));

  await updateRepositoryRecord(repoId, {
    memory: {
      status: 'indexing',
      indexedFiles: new Set(chunks.map((chunk) => chunk.filePath)).size,
      chunkCount: chunks.length,
      languages: collectLanguages(chunks),
      message: 'Embedding code chunks into repository memory.'
    }
  });

  const embeddedChunks = await embedChunks(chunks);
  await saveRepositoryChunks(repoId, embeddedChunks.map(stripVectorForJson));
  await replaceRepositoryVectors(repoId, embeddedChunks);

  await updateRepositoryRecord(repoId, {
    status: 'ready',
    memory: {
      status: 'ready',
      indexedFiles: new Set(chunks.map((chunk) => chunk.filePath)).size,
      chunkCount: chunks.length,
      languages: collectLanguages(chunks),
      embeddingProvider: getActiveEmbeddingProvider(),
      vectorDatabase: env.VECTOR_DB_PROVIDER,
      architectureType: analysis.architecture?.architectureStyle,
      message: 'Repository memory is ready.'
    }
  });

  return embeddedChunks;
}

async function embedChunks(chunks) {
  const batchSize = 12;
  const embedded = [];

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const vectors = await embedTexts(batch.map((chunk) => chunk.embeddingText));

    for (let offset = 0; offset < batch.length; offset += 1) {
      embedded.push({
        ...batch[offset],
        embedding: vectors[offset]
      });
    }
  }

  return embedded;
}

function stripVectorForJson(chunk) {
  const { embedding, ...rest } = chunk;
  return rest;
}

function collectLanguages(chunks) {
  return [...new Set(chunks.map((chunk) => chunk.language).filter(Boolean))].sort();
}
