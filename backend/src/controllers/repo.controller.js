import {
  answerRepositoryQuestion,
  streamRepositoryQuestion
} from '../services/rag/chatService.js';
import { getRepositoryMemory, getRepositoryRecord } from '../services/repositoryRegistry.js';
import { previewSource } from '../services/rag/sourcePreviewService.js';
import { searchKnowledgeBase } from '../services/rag/retrievalService.js';
import {
  buildRepositoryFlow,
  buildRepositoryWalkthrough
} from '../services/repositoryInsights.js';

export async function getRepositoryMemoryStatus(req, res, next) {
  try {
    const repoId = validateRepoId(req.params.repoId);
    res.json(await getRepositoryMemory(repoId));
  } catch (error) {
    next(error);
  }
}

export async function chatWithRepository(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const question = validateQuestion(req.body?.question);
    res.json(await answerRepositoryQuestion(repoId, question));
  } catch (error) {
    next(error);
  }
}

export async function streamRepositoryChat(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const question = validateQuestion(req.body?.question);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    await streamRepositoryQuestion(repoId, question, {
      onMeta: (payload) => writeSse(res, 'meta', payload),
      onToken: (payload) => writeSse(res, 'token', payload),
      onDone: (payload) => writeSse(res, 'done', payload)
    });

    res.end();
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, 'error', { message: error.publicMessage || error.message });
      res.end();
      return;
    }
    next(error);
  }
}

export async function searchRepository(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const query = validateQuestion(req.body?.query, 'Search query');
    const results = await searchKnowledgeBase(repoId, query, {
      topK: Number(req.body?.topK) || 10,
      includeRelated: true
    });

    res.json({
      query,
      results: results.map((result) => ({
        chunkId: result.id,
        filePath: result.filePath,
        language: result.language,
        startLine: result.startLine,
        endLine: result.endLine,
        score: Number(result.score.toFixed(4)),
        summary: result.summary,
        symbols: result.symbols,
        excerpt: result.excerpt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function previewRepositorySource(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const chunkId = req.body?.chunkId;
    const filePath = req.body?.filePath;

    if (!chunkId && !filePath) {
      throw createHttpError(400, 'Provide a chunkId or filePath to preview source.');
    }

    res.json(await previewSource(repoId, { chunkId, filePath }));
  } catch (error) {
    next(error);
  }
}

export async function getRepositoryFlow(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const query = validateQuestion(req.body?.query, 'Flow query');
    const record = await getRepositoryMemoryRecord(repoId);
    const flow = await buildRepositoryFlow(record, query);

    res.json(flow);
  } catch (error) {
    next(error);
  }
}

export async function getRepositoryWalkthrough(req, res, next) {
  try {
    const repoId = validateRepoId(req.body?.repoId);
    const level = validateWalkthroughLevel(req.body?.level);
    const record = await getRepositoryMemoryRecord(repoId);

    res.json(buildRepositoryWalkthrough(record, level));
  } catch (error) {
    next(error);
  }
}

function validateRepoId(repoId) {
  if (!repoId || typeof repoId !== 'string' || !/^[a-f0-9-]{32,40}$/i.test(repoId)) {
    throw createHttpError(400, 'A valid repoId is required.');
  }
  return repoId;
}

function validateQuestion(value, label = 'Question') {
  if (!value || typeof value !== 'string') {
    throw createHttpError(400, `${label} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length < 2) throw createHttpError(400, `${label} is too short.`);
  if (trimmed.length > 2000) throw createHttpError(400, `${label} is too long.`);
  return trimmed;
}

function validateWalkthroughLevel(value) {
  if (!value || typeof value !== 'string') return 'beginner';

  const level = value.trim().toLowerCase();
  if (['beginner', 'intermediate', 'advanced'].includes(level)) return level;
  throw createHttpError(400, 'Walkthrough level must be beginner, intermediate, or advanced.');
}

async function getRepositoryMemoryRecord(repoId) {
  await getRepositoryMemory(repoId);
  return getRepositoryRecord(repoId);
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
}

