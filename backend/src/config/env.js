import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';

dotenv.config();

function boolFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  PORT: numberFromEnv(process.env.PORT, 5000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  TEMP_DIR: process.env.REPOLENS_TEMP_DIR || path.join(os.tmpdir(), 'repolens-ai'),
  STORAGE_DIR: process.env.REPOLENS_STORAGE_DIR || path.resolve(process.cwd(), 'storage'),
  AI_PROVIDER: (process.env.AI_PROVIDER || 'none').toLowerCase(),
  OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2',
  OLLAMA_EMBEDDING_ENDPOINT:
    process.env.OLLAMA_EMBEDDING_ENDPOINT || 'http://localhost:11434/api/embeddings',
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY || '',
  HUGGING_FACE_MODEL: process.env.HUGGING_FACE_MODEL || 'HuggingFaceTB/SmolLM3-3B',
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER || 'auto').toLowerCase(),
  EMBEDDING_DIMENSIONS: numberFromEnv(process.env.EMBEDDING_DIMENSIONS, 384),
  XENOVA_EMBEDDING_MODEL: process.env.XENOVA_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
  SENTENCE_TRANSFORMERS_COMMAND: process.env.SENTENCE_TRANSFORMERS_COMMAND || 'python',
  SENTENCE_TRANSFORMERS_MODEL:
    process.env.SENTENCE_TRANSFORMERS_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  VECTOR_DB_PROVIDER: (process.env.VECTOR_DB_PROVIDER || 'lancedb').toLowerCase(),
  VECTOR_DB_DIR:
    process.env.VECTOR_DB_DIR || path.resolve(process.cwd(), 'storage', 'lancedb'),
  MAX_INDEX_FILES: numberFromEnv(process.env.MAX_INDEX_FILES, 350),
  MAX_INDEX_CHUNKS: numberFromEnv(process.env.MAX_INDEX_CHUNKS, 1400),
  MAX_CHAT_CONTEXT_CHUNKS: numberFromEnv(process.env.MAX_CHAT_CONTEXT_CHUNKS, 10),
  MAX_RELATED_CHUNKS: numberFromEnv(process.env.MAX_RELATED_CHUNKS, 5),
  MAX_FILE_SIZE_BYTES: numberFromEnv(process.env.MAX_FILE_SIZE_MB, 1) * 1024 * 1024,
  CLONE_TIMEOUT_MS: numberFromEnv(process.env.CLONE_TIMEOUT_MS, 120000),
  CLEANUP_TEMP: boolFromEnv(process.env.CLEANUP_TEMP, true)
};
