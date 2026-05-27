import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import simpleGit from 'simple-git';
import { env } from '../config/env.js';

export async function cloneRepository(repository) {
  await fs.mkdir(env.TEMP_DIR, { recursive: true });

  const folderName = `${repository.owner}-${repository.repo}-${crypto.randomUUID()}`;
  const repoPath = path.join(env.TEMP_DIR, folderName);
  const git = simpleGit({
    baseDir: env.TEMP_DIR,
    maxConcurrentProcesses: 1,
    trimmed: false
  });

  try {
    await withTimeout(
      git.clone(repository.cloneUrl, repoPath, ['--depth', '1', '--single-branch']),
      env.CLONE_TIMEOUT_MS,
      'Repository clone timed out. Try a smaller repository or increase CLONE_TIMEOUT_MS.'
    );
    return {
      repoPath,
      clonedAt: new Date().toISOString()
    };
  } catch (error) {
    const wrapped = new Error('Unable to clone repository. Check that the URL is public and reachable.');
    wrapped.statusCode = 422;
    wrapped.publicMessage = wrapped.message;
    wrapped.cause = error;
    throw wrapped;
  }
}

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.statusCode = 408;
      error.publicMessage = message;
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
