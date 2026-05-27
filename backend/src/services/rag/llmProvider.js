import axios from 'axios';
import { env } from '../../config/env.js';

export async function generateText(prompt, options = {}) {
  if (env.AI_PROVIDER === 'ollama') {
    return generateWithOllama(prompt, options).catch(() => '');
  }

  if (env.AI_PROVIDER === 'huggingface') {
    return generateWithHuggingFace(prompt, options).catch(() => '');
  }

  return '';
}

async function generateWithOllama(prompt, options) {
  const response = await axios.post(
    env.OLLAMA_ENDPOINT,
    {
      model: env.OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        num_predict: options.maxTokens ?? 500
      }
    },
    { timeout: options.timeout ?? 45000 }
  );

  return response.data?.response?.trim() || '';
}

async function generateWithHuggingFace(prompt, options) {
  const headers = {};
  if (env.HUGGING_FACE_API_KEY) {
    headers.Authorization = `Bearer ${env.HUGGING_FACE_API_KEY}`;
  }

  const response = await axios.post(
    `https://api-inference.huggingface.co/models/${env.HUGGING_FACE_MODEL}`,
    {
      inputs: prompt,
      parameters: {
        max_new_tokens: options.maxTokens ?? 500,
        temperature: options.temperature ?? 0.2,
        return_full_text: false
      }
    },
    { headers, timeout: options.timeout ?? 45000 }
  );

  const payload = response.data;
  if (Array.isArray(payload)) return payload[0]?.generated_text?.trim() || '';
  return payload?.generated_text?.trim() || '';
}

