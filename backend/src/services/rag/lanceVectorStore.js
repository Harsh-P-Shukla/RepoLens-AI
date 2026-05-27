import fs from 'node:fs/promises';
import * as lancedb from '@lancedb/lancedb';
import { env } from '../../config/env.js';

let connectionPromise;

export async function replaceRepositoryVectors(repoId, chunks) {
  if (env.VECTOR_DB_PROVIDER !== 'lancedb') return;
  if (chunks.length === 0) return;

  const db = await getConnection();
  const name = tableName(repoId);
  const names = await db.tableNames();
  if (names.includes(name)) {
    await db.dropTable(name);
  }

  await db.createTable(name, chunks.map(toLanceRecord), { mode: 'overwrite' });
}

export async function searchRepositoryVectors(repoId, embedding, topK = 10) {
  if (env.VECTOR_DB_PROVIDER !== 'lancedb') return [];

  const db = await getConnection();
  const name = tableName(repoId);
  const names = await db.tableNames();
  if (!names.includes(name)) return [];

  const table = await db.openTable(name);
  const rows = await table.search(embedding).limit(topK).toArray();
  return rows.map(fromLanceRecord);
}

async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = fs
      .mkdir(env.VECTOR_DB_DIR, { recursive: true })
      .then(() => lancedb.connect(env.VECTOR_DB_DIR));
  }
  return connectionPromise;
}

function toLanceRecord(chunk) {
  return {
    id: chunk.id,
    repoId: chunk.repoId,
    filePath: chunk.filePath,
    content: chunk.content,
    summary: chunk.summary,
    language: chunk.language,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    chunkType: chunk.chunkType,
    tokenCount: chunk.tokenCount,
    vector: chunk.embedding,
    importsJson: JSON.stringify(chunk.imports || []),
    symbolsJson: JSON.stringify(chunk.symbols || []),
    metadataJson: JSON.stringify(chunk.metadata || {})
  };
}

function fromLanceRecord(row) {
  return {
    id: row.id,
    repoId: row.repoId,
    filePath: row.filePath,
    content: row.content,
    summary: row.summary,
    language: row.language,
    startLine: row.startLine,
    endLine: row.endLine,
    chunkType: row.chunkType,
    tokenCount: row.tokenCount,
    score: typeof row._distance === 'number' ? 1 / (1 + row._distance) : 0,
    imports: parseJson(row.importsJson, []),
    symbols: parseJson(row.symbolsJson, []),
    metadata: parseJson(row.metadataJson, {}),
    excerpt: row.content?.split(/\r?\n/).slice(0, 12).join('\n') || ''
  };
}

function tableName(repoId) {
  return `repo_${repoId.replace(/-/g, '_')}`;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

