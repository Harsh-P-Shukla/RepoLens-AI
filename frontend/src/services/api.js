import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000
});

export async function analyzeRepository(repoUrl) {
  const response = await api.post('/analyze', { repoUrl });
  return response.data;
}

export async function getRepoMemory(repoId) {
  const response = await api.get(`/repo/${repoId}/memory`);
  return response.data;
}

export async function chatRepository(repoId, question) {
  const response = await api.post('/repo/chat', { repoId, question });
  return response.data;
}

export async function searchRepository(repoId, query, topK = 10) {
  const response = await api.post('/repo/search', { repoId, query, topK });
  return response.data;
}

export async function getSourcePreview({ repoId, chunkId, filePath }) {
  const response = await api.post('/repo/source', { repoId, chunkId, filePath });
  return response.data;
}

export async function getRepoFlow(repoId, query) {
  const response = await api.post('/repo/flow', { repoId, query });
  return response.data;
}

export async function getRepoWalkthrough(repoId, level = 'beginner') {
  const response = await api.post('/repo/walkthrough', { repoId, level });
  return response.data;
}

export async function streamRepositoryChat({ repoId, question, onMeta, onToken, onDone, onError, signal }) {
  const response = await fetch(`${API_URL}/repo/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ repoId, question }),
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Repository chat failed.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const block of events) {
      const event = parseSseBlock(block);
      if (!event) continue;
      if (event.type === 'meta') onMeta?.(event.data);
      if (event.type === 'token') onToken?.(event.data);
      if (event.type === 'done') onDone?.(event.data);
      if (event.type === 'error') onError?.(event.data);
    }

    if (done) break;
  }
}

function parseSseBlock(block) {
  const lines = block.split('\n');
  const type = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim();
  const dataLine = lines.find((line) => line.startsWith('data:'));
  if (!type || !dataLine) return null;

  try {
    return {
      type,
      data: JSON.parse(dataLine.replace('data:', '').trim())
    };
  } catch {
    return null;
  }
}
