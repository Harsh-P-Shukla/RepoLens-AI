import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { binaryExtensions, importantFileNames } from '../constants/ignore.js';
import { extensionOf, sortDirectoryEntries, toPosixPath } from '../utils/pathUtils.js';
import { ignoredDirectoryNames } from '../constants/ignore.js';

export async function scanRepository(repoPath) {
  const stats = {
    totalFiles: 0,
    totalDirectories: 1,
    skippedFiles: 0,
    totalSizeBytes: 0,
    fileTypes: {},
    importantFiles: []
  };

  const files = [];
  const folderTree = await walkDirectory(repoPath, '', stats, files);

  return {
    repoPath,
    folderTree,
    files,
    stats
  };
}

async function walkDirectory(currentPath, relativePath, stats, files) {
  const node = {
    name: relativePath ? path.basename(relativePath) : '.',
    path: relativePath || '.',
    type: 'directory',
    children: []
  };

  const entries = (await fs.readdir(currentPath, { withFileTypes: true })).sort(sortDirectoryEntries);

  for (const entry of entries) {
    const childAbsolutePath = path.join(currentPath, entry.name);
    const childRelativePath = toPosixPath(path.join(relativePath, entry.name));

    if (entry.isSymbolicLink()) {
      stats.skippedFiles += 1;
      continue;
    }

    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name.toLowerCase())) {
        continue;
      }

      stats.totalDirectories += 1;
      node.children.push(await walkDirectory(childAbsolutePath, childRelativePath, stats, files));
      continue;
    }

    if (!entry.isFile()) {
      stats.skippedFiles += 1;
      continue;
    }

    const fileStat = await fs.stat(childAbsolutePath);
    const extension = extensionOf(entry.name);
    const lowerName = entry.name.toLowerCase();

    if (binaryExtensions.has(extension) || fileStat.size > env.MAX_FILE_SIZE_BYTES) {
      stats.skippedFiles += 1;
      continue;
    }

    const fileMeta = {
      name: entry.name,
      path: childRelativePath,
      absolutePath: childAbsolutePath,
      extension,
      sizeBytes: fileStat.size
    };

    files.push(fileMeta);
    stats.totalFiles += 1;
    stats.totalSizeBytes += fileStat.size;
    stats.fileTypes[extension || '[none]'] = (stats.fileTypes[extension || '[none]'] || 0) + 1;

    if (importantFileNames.has(lowerName)) {
      stats.importantFiles.push(childRelativePath);
    }

    node.children.push({
      name: entry.name,
      path: childRelativePath,
      type: 'file',
      extension,
      sizeBytes: fileStat.size
    });
  }

  return node;
}

export async function readTextFileSafe(filePath, maxBytes = 512 * 1024) {
  const stat = await fs.stat(filePath);
  if (stat.size > maxBytes) return '';
  return fs.readFile(filePath, 'utf8');
}

