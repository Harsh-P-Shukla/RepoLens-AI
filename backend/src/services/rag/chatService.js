import { buildRagPrompt } from './promptBuilder.js';
import { generateText } from './llmProvider.js';
import { retrieveRelevantContext } from './retrievalService.js';

export async function answerRepositoryQuestion(repoId, question) {
  const { record, chunks } = await retrieveRelevantContext(repoId, question, {
    topK: 10,
    includeRelated: true
  });

  const prompt = await buildRagPrompt({ record, question, chunks });
  const generated = await generateText(prompt, { maxTokens: 650 });
  const answer = generated || deterministicAnswer(record, question, chunks);
  const sources = chunks.map(toSource);

  return {
    answer,
    sources,
    relevantFiles: [...new Set(sources.map((source) => source.filePath))]
  };
}

export async function streamRepositoryQuestion(repoId, question, callbacks) {
  const result = await answerRepositoryQuestion(repoId, question);
  callbacks.onMeta({
    sources: result.sources,
    relevantFiles: result.relevantFiles
  });

  for (const token of chunkAnswer(result.answer)) {
    callbacks.onToken({ text: token });
    await delay(6);
  }

  callbacks.onDone({ ok: true });
}

function deterministicAnswer(record, question, chunks) {
  const analysis = record.analysis;

  if (chunks.length === 0) {
    return `I could not find enough indexed context to answer "${question}" confidently. Re-run analysis or ask about a more specific file, folder, or feature.`;
  }

  const sourceLines = chunks.slice(0, 6).map((chunk) => {
    const symbolText = chunk.symbols?.length ? ` (${chunk.symbols.slice(0, 3).join(', ')})` : '';
    return `- ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}${symbolText}`;
  });

  const explanation = chunks
    .slice(0, 3)
    .map((chunk) => `${chunk.summary}`)
    .join(' ');

  return [
    `Based on the retrieved repository context, ${analysis.projectName} appears to handle this through the files cited below.`,
    '',
    explanation,
    '',
    'Relevant sources:',
    ...sourceLines,
    '',
    'I am limiting this answer to indexed code context, so inspect the cited files next if you need exact runtime behavior.'
  ].join('\n');
}

function toSource(chunk) {
  return {
    chunkId: chunk.id,
    filePath: chunk.filePath,
    language: chunk.language,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    summary: chunk.summary,
    symbols: chunk.symbols || [],
    score: Number((chunk.score || 0).toFixed(4)),
    excerpt: chunk.excerpt
  };
}

function chunkAnswer(answer) {
  const parts = answer.match(/.{1,42}(\s|$)/g);
  return parts || [answer];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

