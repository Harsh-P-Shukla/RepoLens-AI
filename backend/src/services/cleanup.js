import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export async function cleanupClone(repoPath) {
  if (!repoPath || !env.CLEANUP_TEMP) return;

  const resolvedTemp = path.resolve(env.TEMP_DIR);
  const resolvedRepo = path.resolve(repoPath);
  if (!resolvedRepo.startsWith(resolvedTemp)) return;

  await fs.rm(resolvedRepo, { recursive: true, force: true });
}

