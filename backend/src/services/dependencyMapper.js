import path from 'node:path';
import { createRequire } from 'node:module';
import { readTextFileSafe } from './fileScanner.js';

const require = createRequire(import.meta.url);
const graphExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py']);
const importExtensions = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.py'];

let treeSitterCache;

export async function buildDependencyGraph(scan) {
  const candidateFiles = scan.files
    .filter((file) => graphExtensions.has(file.extension))
    .sort((a, b) => scoreFile(b) - scoreFile(a))
    .slice(0, 180);

  const fileIndex = new Map(scan.files.map((file) => [file.path, file]));
  const nodes = new Map();
  const edges = new Map();
  const externalPackages = new Set();
  const parserState = await loadTreeSitter();

  for (const file of candidateFiles) {
    addFileNode(nodes, file);
  }

  for (const file of candidateFiles) {
    const source = await readTextFileSafe(file.absolutePath, 256 * 1024);
    if (!source) continue;

    const astFacts = extractWithTreeSitter(source, file.extension, parserState);
    const facts = mergeFacts(extractWithRegex(source, file), astFacts);
    enrichFileNode(nodes, file, facts, astFacts?.engine || 'regex');

    for (const importSource of facts.imports) {
      const target = resolveImport(importSource, file.path, fileIndex);
      if (!target) continue;

      if (target.external) {
        if (externalPackages.size >= 35 && !externalPackages.has(target.id)) continue;
        externalPackages.add(target.id);
        addExternalNode(nodes, target.id, target.label);
      } else {
        addFileNode(nodes, target.file);
      }

      addEdge(edges, {
        source: nodeIdForFile(file.path),
        target: target.id,
        type: 'imports',
        label: 'imports'
      });
    }

    for (const route of facts.routes) {
      const routeId = `route:${file.path}:${route.method}:${route.path}`;
      nodes.set(routeId, {
        id: routeId,
        label: `${route.method.toUpperCase()} ${route.path}`,
        type: 'apiRoute',
        path: file.path,
        metadata: { method: route.method, routePath: route.path }
      });
      addEdge(edges, {
        source: nodeIdForFile(file.path),
        target: routeId,
        type: 'defines',
        label: 'defines'
      });
    }
  }

  return {
    parser: parserState.available ? 'tree-sitter' : 'regex-fallback',
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  };
}

function scoreFile(file) {
  let score = 0;
  if (file.path.includes('/src/')) score += 10;
  if (file.path.includes('/components/')) score += 8;
  if (file.path.includes('/routes/') || file.path.includes('/api/')) score += 8;
  if (file.name.match(/^(app|main|index|server)\./)) score += 6;
  if (['.tsx', '.jsx'].includes(file.extension)) score += 4;
  return score;
}

async function loadTreeSitter() {
  if (treeSitterCache) return treeSitterCache;

  try {
    const ParserModule = require('tree-sitter');
    const Parser = ParserModule.default || ParserModule;
    const languages = {};

    try {
      const JavaScript = require('tree-sitter-javascript');
      languages['.js'] = JavaScript.default || JavaScript;
      languages['.jsx'] = JavaScript.default || JavaScript;
      languages['.mjs'] = JavaScript.default || JavaScript;
      languages['.cjs'] = JavaScript.default || JavaScript;
    } catch {
      // Optional grammar unavailable; regex fallback remains active.
    }

    try {
      const TypeScript = require('tree-sitter-typescript');
      languages['.ts'] = TypeScript.typescript;
      languages['.tsx'] = TypeScript.tsx;
    } catch {
      // Optional grammar unavailable; regex fallback remains active.
    }

    treeSitterCache = {
      available: Object.keys(languages).length > 0,
      Parser,
      languages
    };
  } catch {
    treeSitterCache = { available: false, languages: {} };
  }

  return treeSitterCache;
}

function extractWithTreeSitter(source, extension, parserState) {
  const language = parserState.languages?.[extension];
  if (!parserState.available || !language) return null;

  try {
    const parser = new parserState.Parser();
    parser.setLanguage(language);
    const tree = parser.parse(source);
    const facts = {
      engine: 'tree-sitter',
      imports: [],
      exports: [],
      components: [],
      functions: [],
      routes: []
    };

    visit(tree.rootNode, (node) => {
      const text = source.slice(node.startIndex, node.endIndex);

      if (['import_statement', 'import_from_statement', 'call_expression'].includes(node.type)) {
        facts.imports.push(...extractImportSources(text));
      }

      if (['function_declaration', 'function_definition', 'method_definition'].includes(node.type)) {
        const name = extractFunctionName(text);
        if (name) facts.functions.push(name);
      }

      if (['export_statement', 'export_clause'].includes(node.type)) {
        const exported = extractExportName(text);
        if (exported) facts.exports.push(exported);
      }

      if (node.type === 'call_expression') {
        facts.routes.push(...extractExpressRoutes(text));
      }
    });

    facts.components.push(...extractComponentNames(source));
    return facts;
  } catch {
    return null;
  }
}

function visit(node, callback) {
  callback(node);
  for (let index = 0; index < node.namedChildCount; index += 1) {
    visit(node.namedChild(index), callback);
  }
}

function extractWithRegex(source, file) {
  const facts = {
    imports: extractImportSources(source),
    exports: extractExportNames(source),
    components: extractComponentNames(source),
    functions: extractFunctionNames(source),
    routes: extractExpressRoutes(source)
  };

  const nextRoute = inferNextRoute(file.path);
  if (nextRoute) facts.routes.push(nextRoute);
  return facts;
}

function mergeFacts(primary, secondary) {
  if (!secondary) return primary;

  return {
    imports: unique([...primary.imports, ...secondary.imports]),
    exports: unique([...primary.exports, ...secondary.exports]),
    components: unique([...primary.components, ...secondary.components]),
    functions: unique([...primary.functions, ...secondary.functions]),
    routes: uniqueRoutes([...primary.routes, ...secondary.routes])
  };
}

function extractImportSources(source) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.push(match[1]);
    }
  }

  return unique(imports);
}

function extractExportNames(source) {
  const names = [];
  const patterns = [
    /export\s+(?:default\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.push(match[1]);
  }

  return unique(names);
}

function extractExportName(source) {
  return extractExportNames(source)[0] || null;
}

function extractFunctionNames(source) {
  const names = [];
  const patterns = [
    /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /def\s+([A-Za-z_][\w]*)\s*\(/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.push(match[1]);
  }

  return unique(names).slice(0, 12);
}

function extractFunctionName(source) {
  return extractFunctionNames(source)[0] || null;
}

function extractComponentNames(source) {
  const names = [];
  const patterns = [
    /(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
    /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+React\.Component/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.push(match[1]);
  }

  return unique(names).slice(0, 12);
}

function extractExpressRoutes(source) {
  const routes = [];
  const routePattern = /\b(?:app|router)\.(get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/g;

  for (const match of source.matchAll(routePattern)) {
    routes.push({ method: match[1], path: match[2] });
  }

  return uniqueRoutes(routes);
}

function inferNextRoute(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!/(^|\/)(pages|app)\/api\//.test(normalized)) return null;

  const routePath = normalized
    .replace(/^.*?(pages|app)\/api/, '/api')
    .replace(/\/route\.(js|ts)$/, '')
    .replace(/\.(js|ts|jsx|tsx)$/, '')
    .replace(/\/index$/, '');

  return { method: 'api', path: routePath || '/api' };
}

function addFileNode(nodes, file) {
  const id = nodeIdForFile(file.path);
  if (nodes.has(id)) return;

  nodes.set(id, {
    id,
    label: path.basename(file.path),
    type: inferNodeType(file),
    path: file.path,
    metadata: {
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      functions: [],
      exports: [],
      components: [],
      parser: 'pending'
    }
  });
}

function enrichFileNode(nodes, file, facts, parser) {
  const id = nodeIdForFile(file.path);
  const node = nodes.get(id);
  if (!node) return;

  node.type = facts.components.length > 0 ? 'component' : node.type;
  node.metadata = {
    ...node.metadata,
    parser,
    imports: facts.imports.slice(0, 15),
    exports: facts.exports.slice(0, 10),
    components: facts.components.slice(0, 10),
    functions: facts.functions.slice(0, 10),
    routes: facts.routes.slice(0, 10)
  };
}

function addExternalNode(nodes, id, label) {
  if (nodes.has(id)) return;
  nodes.set(id, {
    id,
    label,
    type: 'external',
    path: label,
    metadata: { package: label }
  });
}

function addEdge(edges, edge) {
  const id = `${edge.source}->${edge.target}:${edge.type}:${edge.label}`;
  if (edges.has(id)) return;
  edges.set(id, { id, ...edge });
}

function resolveImport(importSource, fromPath, fileIndex) {
  if (!importSource.startsWith('.')) {
    const label = importSource.startsWith('@')
      ? importSource.split('/').slice(0, 2).join('/')
      : importSource.split('/')[0];
    return { id: `external:${label}`, label, external: true };
  }

  const directory = path.posix.dirname(fromPath);
  const base = path.posix.normalize(path.posix.join(directory, importSource));
  const candidates = [];

  for (const extension of importExtensions) {
    candidates.push(`${base}${extension}`);
  }

  for (const extension of importExtensions.filter(Boolean)) {
    candidates.push(`${base}/index${extension}`);
  }

  for (const candidate of candidates) {
    const file = fileIndex.get(candidate);
    if (file) return { id: nodeIdForFile(file.path), file, external: false };
  }

  return null;
}

function inferNodeType(file) {
  const lowerPath = file.path.toLowerCase();
  if (lowerPath.includes('/api/') || lowerPath.includes('/routes/')) return 'api';
  if (['.tsx', '.jsx'].includes(file.extension)) return 'component';
  if (file.name.match(/^(app|main|index|server)\./)) return 'entry';
  return 'module';
}

function nodeIdForFile(filePath) {
  return `file:${filePath}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueRoutes(routes) {
  const seen = new Set();
  return routes.filter((route) => {
    const key = `${route.method}:${route.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
