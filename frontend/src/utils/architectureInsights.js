import {
  Box,
  BrainCircuit,
  Cog,
  Component,
  Database,
  FileCode2,
  Layers3,
  Package,
  Route,
  Shield,
  Sparkles,
  Wrench
} from 'lucide-react';

const VISUAL_META = {
  entry: { label: 'Entry', color: '#67e8f9', Icon: BrainCircuit },
  component: { label: 'Component', color: '#67e8f9', Icon: Component },
  api: { label: 'API', color: '#fbbf24', Icon: Route },
  service: { label: 'Service', color: '#6ee7b7', Icon: Sparkles },
  database: { label: 'Database', color: '#fb7185', Icon: Database },
  utility: { label: 'Utility', color: '#cbd5e1', Icon: Wrench },
  middleware: { label: 'Middleware', color: '#fbbf24', Icon: Shield },
  config: { label: 'Config', color: '#94a3b8', Icon: Cog },
  module: { label: 'Module', color: '#cbd5e1', Icon: Box },
  external: { label: 'Package', color: '#94a3b8', Icon: Package }
};

const TYPE_PRIORITY = {
  entry: 18,
  api: 16,
  middleware: 15,
  service: 14,
  database: 13,
  component: 12,
  config: 10,
  utility: 8,
  module: 9,
  external: 4
};

export function buildArchitectureGraphModel(graph = {}, analysis = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeMap = new Map();
  const adjacency = buildAdjacency(nodes, edges);
  const entrypointIds = new Set((analysis.architecture?.entrypoints || []).map(normalizePath));
  const importantFiles = new Set((analysis.stats?.importantFiles || []).map(normalizePath));

  const visualNodes = nodes.map((node) => {
    const visualType = classifyNode(node);
    const meta = VISUAL_META[visualType] || VISUAL_META.module;
    const importance = scoreNodeImportance(node, visualType, adjacency, analysis, entrypointIds, importantFiles);
    const relatedIds = getRelatedNodeIds(node.id, adjacency);

    const nextNode = {
      ...node,
      visualType,
      importance,
      palette: meta.color,
      typeLabel: meta.label,
      Icon: meta.Icon,
      role: meta.label,
      relatedIds
    };

    nodeMap.set(node.id, nextNode);
    return nextNode;
  });

  const hotspots = [...visualNodes].sort((a, b) => b.importance - a.importance).slice(0, 12);

  return {
    nodes: visualNodes,
    edges: edges.map((edge) => ({
      ...edge,
      sourceRole: nodeMap.get(edge.source)?.visualType || 'module',
      targetRole: nodeMap.get(edge.target)?.visualType || 'module'
    })),
    nodeMap,
    adjacency,
    hotspots,
    entrypointIds,
    importantFiles
  };
}

export function getArchitectureNodeDetails(node, model, analysis = {}) {
  if (!node) return null;

  const nodeMap = model?.nodeMap || new Map();
  const adjacency = model?.adjacency || buildAdjacency(model?.nodes || [], model?.edges || []);
  const current = nodeMap.get(node.id) || node;
  const incoming = (adjacency.incoming.get(node.id) || []).map((id) => nodeMap.get(id)).filter(Boolean);
  const outgoing = (adjacency.outgoing.get(node.id) || []).map((id) => nodeMap.get(id)).filter(Boolean);
  const related = uniqueNodes([...incoming, ...outgoing])
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 6);

  return {
    ...current,
    imports: current.metadata?.imports || [],
    exports: current.metadata?.exports || [],
    functions: current.metadata?.functions || [],
    components: current.metadata?.components || [],
    routes: current.metadata?.routes || [],
    relatedFiles: related.map((item) => item.path).filter(Boolean),
    dependencyChain: buildDependencyChain(current.id, model, 4),
    explanation: explainNode(current, analysis),
    architecturalRole: architecturalRoleText(current, analysis)
  };
}

export function buildLearningProgressModel(analysis = {}, exploredFiles = []) {
  const graph = analysis.dependencyGraph || {};
  const model = buildArchitectureGraphModel(graph, analysis);
  const uniqueExplored = [...new Set((exploredFiles || []).filter(Boolean).map(normalizePath))];
  const exploredNodes = model.nodes.filter((node) => uniqueExplored.includes(normalizePath(node.path)));
  const totalFiles = analysis.stats?.totalFiles || graph.nodes?.length || 0;
  const fileCoverage = totalFiles > 0 ? Math.min(1, uniqueExplored.length / totalFiles) : 0;
  const roleCoverage = model.nodes.length > 0 ? exploredNodes.length / model.nodes.length : 0;
  const learnedRoles = [...new Set(exploredNodes.map((node) => node.visualType))];
  const hotspots = model.hotspots;
  const nextTopics = hotspots.filter((node) => !uniqueExplored.includes(normalizePath(node.path))).slice(0, 4);

  return {
    totalFiles,
    exploredFiles: uniqueExplored.length,
    fileCoverage,
    roleCoverage,
    learnedRoles,
    hotspots,
    nextTopics,
    exploredNodes,
    architectureStyle: analysis.architecture?.architectureStyle || 'Modular repository architecture',
    projectType: analysis.architecture?.projectType || 'Repository'
  };
}

export function classifyNode(node = {}) {
  const pathText = normalizePath(node.path || '');
  const labelText = String(node.label || '').toLowerCase();
  const metaText = [
    node.metadata?.imports,
    node.metadata?.exports,
    node.metadata?.functions,
    node.metadata?.components,
    node.metadata?.routes?.map((route) => `${route.method} ${route.path}`)
  ]
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (node.type === 'external' || /node_modules/.test(pathText)) return 'external';
  if (/\/(middleware|middlewares)\//.test(pathText) || /auth|jwt|guard|verify/.test(pathText + labelText + metaText)) return 'middleware';
  if (/\/(services|service|usecases|use-cases)\//.test(pathText)) return 'service';
  if (/\/(routes|route|controllers|controller|api)\//.test(pathText) || (node.metadata?.routes?.length || 0) > 0) return 'api';
  if (/\/(db|database|models|model|schema|repositories|repository|store)\//.test(pathText)) return 'database';
  if (/\/(config|configs|constants)\//.test(pathText)) return 'config';
  if (/\/(utils|helper|helpers)\//.test(pathText)) return 'utility';
  if (/\/(components|pages|app)\//.test(pathText)) return 'component';
  if (/^(src\/)?(main|index|app|server)\./.test(pathText) || /\/(main|index|server)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(pathText)) return 'entry';
  if (/component|view|screen|page/.test(labelText)) return 'component';
  return 'module';
}

function buildAdjacency(nodes, edges) {
  const incoming = new Map();
  const outgoing = new Map();

  for (const node of nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  for (const edge of edges) {
    if (outgoing.has(edge.source)) outgoing.get(edge.source).push(edge.target);
    if (incoming.has(edge.target)) incoming.get(edge.target).push(edge.source);
  }

  return { incoming, outgoing };
}

function scoreNodeImportance(node, visualType, adjacency, analysis, entrypointIds, importantFiles) {
  const incoming = adjacency.incoming.get(node.id)?.length || 0;
  const outgoing = adjacency.outgoing.get(node.id)?.length || 0;
  const metadata = node.metadata || {};

  const score =
    TYPE_PRIORITY[visualType] +
    Math.min(30, incoming * 2.4 + outgoing * 1.8) +
    (entrypointIds.has(normalizePath(node.path)) ? 18 : 0) +
    (importantFiles.has(normalizePath(node.path)) ? 14 : 0) +
    (metadata.imports?.length || 0) * 0.7 +
    (metadata.exports?.length || 0) * 1.2 +
    (metadata.functions?.length || 0) * 0.5 +
    (metadata.components?.length || 0) * 1 +
    (metadata.routes?.length || 0) * 2;

  return Math.min(100, Math.max(4, Math.round(score)));
}

function getRelatedNodeIds(nodeId, adjacency) {
  return [
    ...(adjacency.incoming.get(nodeId) || []),
    ...(adjacency.outgoing.get(nodeId) || [])
  ];
}

function buildDependencyChain(nodeId, model, maxDepth = 4) {
  const adjacency = model?.adjacency;
  const nodeMap = model?.nodeMap || new Map();
  if (!adjacency || !nodeMap.has(nodeId)) return [];

  const chain = [];
  const visited = new Set();
  let currentId = nodeId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const incoming = adjacency.incoming.get(currentId) || [];
    const nextId = incoming.find((candidateId) => !visited.has(candidateId));
    if (!nextId) break;

    visited.add(nextId);
    const nextNode = nodeMap.get(nextId);
    if (nextNode) chain.unshift(nextNode.path);
    currentId = nextId;
  }

  const current = nodeMap.get(nodeId);
  if (current?.path) chain.push(current.path);
  return chain;
}

function explainNode(node, analysis) {
  const role = node.visualType;
  const base = architecturalRoleText(node, analysis);
  const importanceText = node.importance >= 70 ? ' It behaves like a core brain of the repository.' : ' It is a supporting but still meaningful part of the system.';
  return `${base}${importanceText}`;
}

function architecturalRoleText(node, analysis) {
  switch (node.visualType) {
    case 'entry':
      return 'This file starts execution and anchors the runtime path.';
    case 'component':
      return 'This is a user-facing interaction surface or component boundary.';
    case 'api':
      return 'This file exposes the request boundary and routes work into the app.';
    case 'service':
      return 'This layer contains orchestration and domain logic.';
    case 'database':
      return 'This layer handles persistence, models, or storage access.';
    case 'utility':
      return 'This file is a shared helper used across multiple parts of the app.';
    case 'middleware':
      return 'This file guards or shapes requests before they reach the core logic.';
    case 'config':
      return 'This file configures boot-time behavior and shared constants.';
    case 'external':
      return 'This is an external dependency used by the repository.';
    default:
      return `This file sits inside ${analysis.architecture?.architectureStyle || 'the active architecture'}.`;
  }
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (!node?.id || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').toLowerCase();
}
