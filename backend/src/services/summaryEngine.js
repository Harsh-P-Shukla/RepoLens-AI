import axios from 'axios';
import { env } from '../config/env.js';

export async function generateProjectSummary({ projectName, techStack, architecture, stats }) {
  const prompt = createPrompt({ projectName, techStack, architecture, stats });

  if (env.AI_PROVIDER === 'ollama') {
    return generateWithOllama(prompt).catch(() =>
      deterministicSummary(projectName, techStack, architecture, stats)
    );
  }

  if (env.AI_PROVIDER === 'huggingface') {
    return generateWithHuggingFace(prompt).catch(() =>
      deterministicSummary(projectName, techStack, architecture, stats)
    );
  }

  return deterministicSummary(projectName, techStack, architecture, stats);
}

function createPrompt({ projectName, techStack, architecture, stats }) {
  const techNames = techStack.map((tech) => `${tech.name} (${tech.confidence})`).join(', ') || 'unknown';

  return [
    'Explain this repository to a beginner in 120 words or fewer.',
    'Use direct language and mention architecture, main technologies, and likely data flow.',
    `Project: ${projectName}`,
    `Type: ${architecture.projectType}`,
    `Architecture: ${architecture.architectureStyle}`,
    `Technologies: ${techNames}`,
    `Files: ${stats.totalFiles}`,
    `Entrypoints: ${architecture.entrypoints.join(', ') || 'not detected'}`
  ].join('\n');
}

async function generateWithOllama(prompt) {
  const response = await axios.post(
    env.OLLAMA_ENDPOINT,
    {
      model: env.OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 180
      }
    },
    { timeout: 25000 }
  );

  return response.data?.response?.trim() || '';
}

async function generateWithHuggingFace(prompt) {
  const headers = {};
  if (env.HUGGING_FACE_API_KEY) {
    headers.Authorization = `Bearer ${env.HUGGING_FACE_API_KEY}`;
  }

  const response = await axios.post(
    `https://api-inference.huggingface.co/models/${env.HUGGING_FACE_MODEL}`,
    {
      inputs: prompt,
      parameters: {
        max_new_tokens: 180,
        temperature: 0.2,
        return_full_text: false
      }
    },
    { headers, timeout: 30000 }
  );

  const payload = response.data;
  if (Array.isArray(payload)) return payload[0]?.generated_text?.trim() || '';
  return payload?.generated_text?.trim() || '';
}

function deterministicSummary(projectName, techStack, architecture, stats) {
  const techNames = techStack.slice(0, 6).map((tech) => tech.name);
  const techText = techNames.length ? techNames.join(', ') : 'a lightweight set of source files';
  const entryText = architecture.entrypoints.length
    ? `Primary entrypoints include ${architecture.entrypoints.slice(0, 3).join(', ')}.`
    : 'No obvious single entrypoint was detected, so the repository may be library-style or split across modules.';

  return `${projectName} looks like a ${architecture.projectType.toLowerCase()} using ${techText}. It follows a ${architecture.architectureStyle.toLowerCase()}, with ${stats.totalFiles} analyzed files and ${architecture.modules.length} notable module areas. ${entryText} For a beginner, read the entrypoint first, then follow imports through the dependency graph to see how features connect.`;
}

