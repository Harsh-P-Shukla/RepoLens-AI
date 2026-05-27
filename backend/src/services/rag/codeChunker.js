import path from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { readTextFileSafe } from '../fileScanner.js';

const chunkNamespace = '30dbb05d-8e16-44a5-b760-019944df3c7d';
const targetMinTokens = 300;
const targetMaxTokens = 1200;
const sourceExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.py',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml'
]);
const ignoredIndexFiles = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb'
]);

export async function chunkRepositoryFiles(scan, { maxFiles, maxChunks }) {
  const prioritized = prioritizeFiles(scan.files).slice(0, maxFiles);
  const chunks = [];

  for (const file of prioritized) {
    if (chunks.length >= maxChunks) break;

    const content = await readTextFileSafe(file.absolutePath, 768 * 1024);
    if (!content || isProbablyGenerated(content)) continue;

    const fileChunks = chunkFile(file, content);
    for (const chunk of fileChunks) {
      chunks.push(chunk);
      if (chunks.length >= maxChunks) break;
    }
  }

  return chunks;
}

function prioritizeFiles(files) {
  return files
    .filter((file) => sourceExtensions.has(file.extension) || isImportantName(file.name))
    .filter((file) => !ignoredIndexFiles.has(file.name.toLowerCase()))
    .sort((a, b) => scoreFile(b) - scoreFile(a));
}

function scoreFile(file) {
  const lower = file.path.toLowerCase();
  let score = 0;

  if (lower.includes('/src/')) score += 20;
  if (lower.includes('/app/')) score += 16;
  if (lower.includes('/pages/')) score += 16;
  if (lower.includes('/api/')) score += 18;
  if (lower.includes('/routes/')) score += 18;
  if (lower.includes('/controllers/')) score += 16;
  if (lower.includes('/services/')) score += 16;
  if (lower.includes('/components/')) score += 14;
  if (lower.includes('/hooks/')) score += 12;
  if (lower.includes('/models/')) score += 12;
  if (file.name.match(/^(app|main|index|server|route)\./i)) score += 10;
  if (['.tsx', '.jsx', '.ts', '.js', '.py'].includes(file.extension)) score += 8;
  if (['package.json', 'requirements.txt', 'pyproject.toml'].includes(file.name.toLowerCase())) score += 6;
  score -= Math.min(10, file.sizeBytes / 150000);

  return score;
}

function chunkFile(file, content) {
  const language = languageForFile(file);
  const lines = content.split(/\r?\n/);
  const imports = extractImports(content);
  const symbols = extractSymbols(content, language);

  if (estimateTokens(content) <= targetMaxTokens) {
    return [createChunk(file, content, 1, lines.length, language, imports, symbols, 'module')];
  }

  const boundaryChunks = createBoundaryChunks(file, lines, language, imports, symbols);
  if (boundaryChunks.length > 0) return mergeSmallChunks(boundaryChunks);

  return createWindowChunks(file, lines, language, imports, symbols);
}

function createBoundaryChunks(file, lines, language, imports, symbols) {
  const boundaries = findBoundaries(lines, language);
  if (boundaries.length === 0) return [];

  const chunks = [];
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];
    const next = boundaries[index + 1];
    const startLine = boundary.line;
    const endLine = next ? next.line - 1 : lines.length;
    const content = lines.slice(startLine - 1, endLine).join('\n').trim();
    if (!content) continue;

    if (estimateTokens(content) > targetMaxTokens) {
      chunks.push(...createWindowChunks(file, content.split(/\r?\n/), language, imports, [boundary.name], boundary.kind, startLine));
    } else {
      chunks.push(createChunk(file, content, startLine, endLine, language, imports, [boundary.name], boundary.kind));
    }
  }

  return chunks;
}

function createWindowChunks(file, lines, language, imports, symbols, chunkType = 'module', offsetLine = 1) {
  const chunks = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let tokenCount = 0;

    while (end < lines.length && tokenCount < targetMaxTokens) {
      tokenCount += estimateTokens(lines[end]);
      end += 1;
    }

    const content = lines.slice(start, end).join('\n').trim();
    if (content) {
      chunks.push(
        createChunk(
          file,
          content,
          offsetLine + start,
          offsetLine + end - 1,
          language,
          imports,
          symbols,
          chunkType
        )
      );
    }

    start = end;
  }

  return chunks;
}

function mergeSmallChunks(chunks) {
  const merged = [];
  let current = null;

  for (const chunk of chunks) {
    if (
      current &&
      current.filePath === chunk.filePath &&
      current.tokenCount + chunk.tokenCount <= targetMaxTokens &&
      current.tokenCount < targetMinTokens
    ) {
      current.content = `${current.content}\n\n${chunk.content}`;
      current.endLine = chunk.endLine;
      current.tokenCount = estimateTokens(current.content);
      current.symbols = [...new Set([...current.symbols, ...chunk.symbols])].slice(0, 12);
      current.summary = summarizeChunk(current);
      current.embeddingText = buildEmbeddingText(current);
    } else {
      current = { ...chunk };
      merged.push(current);
    }
  }

  return merged;
}

function createChunk(file, content, startLine, endLine, language, imports, symbols, chunkType) {
  const tokenCount = estimateTokens(content);
  const stableId = uuidv5(`${file.path}:${startLine}:${endLine}:${content.slice(0, 80)}`, chunkNamespace);
  const chunk = {
    id: stableId,
    filePath: file.path,
    content,
    language,
    imports,
    symbols: symbols.slice(0, 16),
    startLine,
    endLine,
    chunkType,
    tokenCount,
    metadata: {
      extension: file.extension,
      sizeBytes: file.sizeBytes
    }
  };

  chunk.summary = summarizeChunk(chunk);
  chunk.embeddingText = buildEmbeddingText(chunk);
  chunk.excerpt = content.split(/\r?\n/).slice(0, 12).join('\n');
  return chunk;
}

function summarizeChunk(chunk) {
  const symbolText = chunk.symbols.length ? `Symbols: ${chunk.symbols.slice(0, 5).join(', ')}. ` : '';
  const importText = chunk.imports.length ? `Imports: ${chunk.imports.slice(0, 6).join(', ')}.` : '';
  return `${chunk.chunkType} chunk in ${chunk.filePath} lines ${chunk.startLine}-${chunk.endLine}. ${symbolText}${importText}`.trim();
}

function buildEmbeddingText(chunk) {
  return [
    `File: ${chunk.filePath}`,
    `Language: ${chunk.language}`,
    `Type: ${chunk.chunkType}`,
    `Summary: ${chunk.summary}`,
    `Symbols: ${chunk.symbols.join(', ')}`,
    `Imports: ${chunk.imports.join(', ')}`,
    chunk.content
  ].join('\n');
}

function findBoundaries(lines, language) {
  const boundaries = [];
  const patterns = boundaryPatterns(language);

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        boundaries.push({
          line: index + 1,
          name: match[1] || match[2] || 'anonymous',
          kind: pattern.kind
        });
        return;
      }
    }
  });

  return boundaries;
}

function boundaryPatterns(language) {
  if (language === 'python') {
    return [
      { kind: 'class', regex: /^\s*class\s+([A-Za-z_][\w]*)/ },
      { kind: 'function', regex: /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/ }
    ];
  }

  return [
    { kind: 'class', regex: /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { kind: 'function', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
    {
      kind: 'function',
      regex: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/
    },
    { kind: 'route', regex: /^\s*(?:app|router)\.(get|post|put|patch|delete|use)\s*\(/ }
  ];
}

function extractImports(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*from\s+([A-Za-z0-9_./]+)\s+import\s+/gm,
    /^\s*import\s+([A-Za-z0-9_./]+)/gm
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) imports.push(match[1]);
  }

  return [...new Set(imports)].slice(0, 30);
}

function extractSymbols(content, language) {
  const symbols = [];
  const patterns = boundaryPatterns(language);

  for (const pattern of patterns) {
    for (const match of content.matchAll(new RegExp(pattern.regex.source, 'gm'))) {
      symbols.push(match[1] || match[2]);
    }
  }

  return [...new Set(symbols.filter(Boolean))].slice(0, 24);
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.25));
}

function languageForFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.startsWith('readme')) return 'markdown';
  if (lowerName === 'license') return 'text';
  if (lowerName === '.env.example') return 'env';
  if (lowerName === 'dockerfile') return 'dockerfile';

  const extensionMap = {
    '.cjs': 'javascript',
    '.css': 'css',
    '.html': 'html',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.json': 'json',
    '.md': 'markdown',
    '.mjs': 'javascript',
    '.py': 'python',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.vue': 'vue',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };

  return extensionMap[file.extension] || path.extname(file.name).replace('.', '') || 'text';
}

function isImportantName(name) {
  const lowerName = name.toLowerCase();
  return (
    lowerName.startsWith('readme') ||
    ['dockerfile', '.env.example', 'license', 'requirements.txt', 'pyproject.toml'].includes(lowerName)
  );
}

function isProbablyGenerated(content) {
  if (content.length > 800000) return true;
  const firstLines = content.slice(0, 1000).toLowerCase();
  return firstLines.includes('generated file') || firstLines.includes('do not edit');
}
