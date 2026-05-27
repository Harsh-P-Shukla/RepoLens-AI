import { spawn } from 'node:child_process';
import axios from 'axios';
import { env } from '../../config/env.js';

let activeProvider = env.EMBEDDING_PROVIDER;
let ollamaUnavailableUntil = 0;
let xenovaExtractorPromise;

export async function embedTexts(texts) {
  const normalizedTexts = texts.map((text) => normalizeEmbeddingInput(text));
  const provider = env.EMBEDDING_PROVIDER;

  if (provider === 'ollama') return embedWithOllama(normalizedTexts);
  if (provider === 'sentence-transformers') return embedWithSentenceTransformers(normalizedTexts);
  if (provider === 'xenova') return embedWithXenova(normalizedTexts);
  if (provider === 'local') return embedWithLocalHash(normalizedTexts);

  return embedWithAuto(normalizedTexts);
}

export function getActiveEmbeddingProvider() {
  return activeProvider;
}

async function embedWithAuto(texts) {
  if (Date.now() > ollamaUnavailableUntil) {
    try {
      const vectors = await embedWithOllama(texts);
      activeProvider = 'ollama';
      return vectors;
    } catch {
      ollamaUnavailableUntil = Date.now() + 60000;
    }
  }

  activeProvider = 'local';
  return embedWithLocalHash(texts);
}

async function embedWithOllama(texts) {
  const vectors = [];

  for (const text of texts) {
    const useEmbedEndpoint = env.OLLAMA_EMBEDDING_ENDPOINT.includes('/api/embed');
    const body = useEmbedEndpoint
      ? { model: env.OLLAMA_EMBEDDING_MODEL, input: text }
      : { model: env.OLLAMA_EMBEDDING_MODEL, prompt: text };

    const response = await axios.post(env.OLLAMA_EMBEDDING_ENDPOINT, body, { timeout: 10000 });
    const embedding = useEmbedEndpoint
      ? response.data?.embeddings?.[0]
      : response.data?.embedding;

    if (!Array.isArray(embedding)) {
      throw new Error('Ollama did not return an embedding vector.');
    }

    vectors.push(normalizeVector(embedding));
  }

  activeProvider = 'ollama';
  return vectors;
}

async function embedWithXenova(texts) {
  if (!xenovaExtractorPromise) {
    xenovaExtractorPromise = import('@xenova/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', env.XENOVA_EMBEDDING_MODEL))
      .catch((error) => {
        const wrapped = new Error(
          'Xenova embeddings require installing @xenova/transformers. Use EMBEDDING_PROVIDER=auto, ollama, sentence-transformers, or local.'
        );
        wrapped.cause = error;
        throw wrapped;
      });
  }

  const extractor = await xenovaExtractorPromise;
  const vectors = [];

  for (const text of texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    vectors.push(normalizeVector(Array.from(output.data)));
  }

  activeProvider = 'xenova';
  return vectors;
}

async function embedWithSentenceTransformers(texts) {
  const script = [
    'import json, sys',
    'from sentence_transformers import SentenceTransformer',
    'payload=json.load(sys.stdin)',
    'model=SentenceTransformer(payload["model"])',
    'vectors=model.encode(payload["texts"], normalize_embeddings=True).tolist()',
    'print(json.dumps(vectors))'
  ].join('\n');

  const output = await runPythonEmbeddingScript(script, {
    model: env.SENTENCE_TRANSFORMERS_MODEL,
    texts
  });

  activeProvider = 'sentence-transformers';
  return output.map(normalizeVector);
}

function runPythonEmbeddingScript(script, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(env.SENTENCE_TRANSFORMERS_COMMAND, ['-c', script], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'sentence-transformers embedding process failed.'));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function embedWithLocalHash(texts) {
  activeProvider = 'local';
  return texts.map((text) => normalizeVector(hashEmbedding(text, env.EMBEDDING_DIMENSIONS)));
}

function hashEmbedding(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = fnv1a(token);
    const index = Math.abs(hash) % dimensions;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.min(token.length, 24) / 24);
  }

  return vector;
}

function tokenize(text) {
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ');

  return expanded.split(/\s+/).filter((token) => token.length > 1).slice(0, 2000);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function normalizeEmbeddingInput(text) {
  return String(text || '').slice(0, 12000);
}
