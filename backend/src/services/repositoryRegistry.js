import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

const repositoriesDir = path.join(env.STORAGE_DIR, 'repositories');

export async function createRepositoryRecord(repoId, analysis) {
  await fs.mkdir(repositoryDir(repoId), { recursive: true });

  const record = {
    repoId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'indexing',
    analysis,
    memory: {
      status: 'indexing',
      indexedFiles: 0,
      chunkCount: 0,
      languages: [],
      embeddingProvider: env.EMBEDDING_PROVIDER,
      vectorDatabase: env.VECTOR_DB_PROVIDER,
      message: 'Repository memory is being indexed.'
    }
  };

  await writeJson(recordPath(repoId), record);
  return record;
}

export async function getRepositoryRecord(repoId) {
  try {
    return await readJson(recordPath(repoId));
  } catch {
    throw createHttpError(404, 'Repository memory was not found. Re-run analysis for this repository.');
  }
}

export async function updateRepositoryRecord(repoId, patch) {
  const current = await getRepositoryRecord(repoId);
  const next = {
    ...current,
    ...patch,
    memory: {
      ...current.memory,
      ...patch.memory
    },
    updatedAt: new Date().toISOString()
  };

  await writeJson(recordPath(repoId), next);
  return next;
}

export async function getRepositoryMemory(repoId) {
  const record = await getRepositoryRecord(repoId);
  return {
    repoId,
    projectName: record.analysis.projectName,
    architectureType: record.analysis.architecture?.architectureStyle,
    projectType: record.analysis.architecture?.projectType,
    ...record.memory
  };
}

export async function saveRepositoryChunks(repoId, chunks) {
  await fs.mkdir(repositoryDir(repoId), { recursive: true });
  await writeJson(chunksPath(repoId), chunks);
}

export async function loadRepositoryChunks(repoId) {
  try {
    return await readJson(chunksPath(repoId));
  } catch {
    return [];
  }
}

export function repositoryDir(repoId) {
  return path.join(repositoriesDir, safeRepoId(repoId));
}

function recordPath(repoId) {
  return path.join(repositoryDir(repoId), 'manifest.json');
}

function chunksPath(repoId) {
  return path.join(repositoryDir(repoId), 'chunks.json');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function safeRepoId(repoId) {
  if (!/^[a-f0-9-]{32,40}$/i.test(repoId)) {
    throw createHttpError(400, 'Invalid repoId.');
  }
  return repoId;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
}

