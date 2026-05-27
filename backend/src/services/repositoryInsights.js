import path from 'node:path';
import { retrieveRelevantContext } from './rag/retrievalService.js';

const FLOW_STAGES = [
  { key: 'entry', kind: 'entry' },
  { key: 'route', kind: 'api' },
  { key: 'middleware', kind: 'middleware' },
  { key: 'service', kind: 'service' },
  { key: 'database', kind: 'database' },
  { key: 'response', kind: 'response' }
];

const WALKTHROUGH_LEVELS = {
  beginner: 5,
  intermediate: 6,
  advanced: 8
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'during',
  'for',
  'from',
  'how',
  'is',
  'it',
  'of',
  'the',
  'to',
  'what',
  'when',
  'where',
  'why',
  'with',
  'does',
  'do',
  'happens',
  'flow',
  'process',
  'please'
]);

export async function buildRepositoryFlow(record, query) {
  const analysis = record.analysis || {};
  const graph = analysis.dependencyGraph || { nodes: [], edges: [] };
  const topic = extractTopic(query) || 'Execution';

  let chunks = [];
  try {
    if (record.memory?.status === 'ready') {
      const context = await retrieveRelevantContext(record.repoId, query, {
        topK: 12,
        includeRelated: true
      });
      chunks = context.chunks || [];
    }
  } catch {
    chunks = [];
  }

  const candidates = buildCandidateNodes(graph.nodes || [], graph.edges || [], analysis, chunks, query);
  const usedNodeIds = new Set();
  const steps = [];

  for (const stage of FLOW_STAGES) {
    const candidate = pickStageCandidate(stage, candidates, usedNodeIds, query);
    if (!candidate) continue;

    usedNodeIds.add(candidate.node.id);
    steps.push(buildFlowStep(stage, candidate, topic, query));
  }

  if (steps.length < 3) {
    for (const candidate of candidates) {
      if (steps.length >= 3) break;
      if (usedNodeIds.has(candidate.node.id)) continue;

      usedNodeIds.add(candidate.node.id);
      steps.push(buildFlowStep({ key: candidate.role, kind: candidate.role }, candidate, topic, query));
    }
  }

  const connections = steps.slice(0, -1).map((step, index) => ({
    from: step.id,
    to: steps[index + 1].id,
    label: connectionLabelForStep(step.kind, steps[index + 1].kind, topic),
    animated: true
  }));

  return {
    title: `${titleCase(topic)} flow`,
    steps,
    connections
  };
}

export function buildRepositoryWalkthrough(record, level = 'beginner') {
  const analysis = record.analysis || {};
  const graph = analysis.dependencyGraph || { nodes: [], edges: [] };
  const stepCount = WALKTHROUGH_LEVELS[level] || WALKTHROUGH_LEVELS.beginner;
  const hotspots = rankHotspotFiles(graph.nodes || [], graph.edges || [], analysis).slice(0, 12);
  const entrypoints = (analysis.architecture?.entrypoints || []).slice(0, 4);
  const readingOrder = [...entrypoints];

  const priorityPatterns = getPriorityPatterns(analysis);
  for (const pattern of priorityPatterns) {
    const match = graph.nodes?.find((node) => node.path && normalizePath(node.path).includes(pattern));
    if (match) readingOrder.push(match.path);
  }

  for (const hotspot of hotspots) {
    if (readingOrder.length >= stepCount + 2) break;
    if (!readingOrder.includes(hotspot.path)) readingOrder.push(hotspot.path);
  }

  const uniqueOrder = [...new Set(readingOrder)].filter(Boolean).slice(0, stepCount);
  const steps = uniqueOrder.map((filePath, index) => {
    const node = graph.nodes?.find((item) => item.path === filePath) || null;
    const role = classifyRole(filePath);

    return {
      id: `walkthrough-${index + 1}`,
      order: index + 1,
      title: walkthroughTitleForRole(role, node, index),
      file: filePath,
      reason: walkthroughReasonForRole(role, node, analysis),
      focus: walkthroughFocusForRole(role, analysis),
      kind: role,
      supportingFiles: collectSupportingFiles(graph.nodes || [], filePath, hotspots)
    };
  });

  return {
    steps,
    estimatedTime: `${estimateWalkthroughMinutes(steps.length, analysis)} min`,
    learningGoals: buildLearningGoals(analysis, steps)
  };
}

function buildCandidateNodes(nodes, edges, analysis, chunks, query) {
  const degreeMap = buildDegreeMap(nodes, edges);
  const entrypoints = new Set((analysis.architecture?.entrypoints || []).map(normalizePath));
  const importantFiles = new Set((analysis.stats?.importantFiles || []).map(normalizePath));
  const chunkByFile = new Map();

  for (const chunk of chunks) {
    const current = chunkByFile.get(chunk.filePath) || [];
    current.push(chunk);
    chunkByFile.set(chunk.filePath, current);
  }

  return [...nodes]
    .filter((node) => node.path)
    .map((node) => {
      const role = classifyRole(node.path || node.label || '');
      const degree = degreeMap.get(node.id) || { incoming: 0, outgoing: 0 };
      const bestChunk = (chunkByFile.get(node.path) || [])[0];
      const score =
        roleWeight(role) +
        Math.min(24, Math.round(degree.incoming * 2.2 + degree.outgoing * 1.6)) +
        (entrypoints.has(normalizePath(node.path)) ? 18 : 0) +
        (importantFiles.has(normalizePath(node.path)) ? 12 : 0) +
        metadataScore(node.metadata || {}) +
        scoreQueryMatch(node, query) +
        (bestChunk ? Math.min(18, Math.round((bestChunk.score || 0) * 18)) : 0);

      return {
        node,
        role,
        evidence: bestChunk?.summary || '',
        relatedFiles: gatherRelatedFiles(node, nodes, edges),
        relevance: Math.min(100, Math.max(0, Math.round(score)))
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

function pickStageCandidate(stage, candidates, usedNodeIds, query) {
  const filtered = candidates.filter((candidate) => !usedNodeIds.has(candidate.node.id) && matchesStage(candidate, stage, query));
  if (filtered.length > 0) return filtered[0];

  const fallback = candidates.find((candidate) => !usedNodeIds.has(candidate.node.id));
  return fallback || null;
}

function matchesStage(candidate, stage, query) {
  const text = `${normalizePath(candidate.node.path || '')} ${String(candidate.node.label || '').toLowerCase()} ${String(query || '').toLowerCase()}`;

  switch (stage.key) {
    case 'entry':
      return candidate.role === 'entry' || candidate.role === 'component' || /main|index|app|page|server|login|signin/.test(text);
    case 'route':
      return candidate.role === 'api' || /route|controller|api/.test(text) || (candidate.node.metadata?.routes?.length || 0) > 0;
    case 'middleware':
      return candidate.role === 'middleware' || /middleware|auth|jwt|session|guard|verify/.test(text);
    case 'service':
      return candidate.role === 'service' || /service|logic|usecase|manager|handler/.test(text);
    case 'database':
      return candidate.role === 'database' || /db|database|model|schema|store|repository|prisma|mongo/.test(text);
    case 'response':
      return candidate.role === 'component' || candidate.role === 'utility' || /client|ui|state|view|response|render/.test(text);
    default:
      return true;
  }
}

function buildFlowStep(stage, candidate, topic, query) {
  return {
    id: `flow-${stage.key}-${slugify(candidate.node.path || candidate.node.label || stage.key)}`,
    title: buildFlowTitle(stage.key, candidate, topic),
    description: buildFlowDescription(stage.key, candidate, topic, query, candidate.evidence),
    files: [...new Set([candidate.node.path, ...candidate.relatedFiles].filter(Boolean))].slice(0, 4),
    kind: stage.kind,
    role: candidate.role,
    importance: candidate.relevance
  };
}

function buildFlowTitle(stageKey, candidate, topic) {
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('login')) {
    switch (stageKey) {
      case 'entry':
        return 'Frontend Login Form';
      case 'route':
        return routeTitle(candidate.node, 'POST /auth/login');
      case 'middleware':
        return 'Auth Middleware';
      case 'service':
        return 'JWT Validation';
      case 'database':
        return 'Database Query';
      case 'response':
        return 'Session Created';
      default:
        break;
    }
  }

  switch (stageKey) {
    case 'entry':
      return candidate.node.label || 'Entry Point';
    case 'route':
      return routeTitle(candidate.node, 'Request Boundary');
    case 'middleware':
      return candidate.node.label || 'Middleware Layer';
    case 'service':
      return candidate.node.label || 'Service Layer';
    case 'database':
      return candidate.node.label || 'Persistence Layer';
    case 'response':
      return candidate.node.label || 'Response';
    default:
      return candidate.node.label || stageKey;
  }
}

function buildFlowDescription(stageKey, candidate, topic, query, evidence) {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('login')) {
    switch (stageKey) {
      case 'entry':
        return `The login experience begins in the UI and captures credentials. ${evidence || ''}`.trim();
      case 'route':
        return `The request crosses the auth boundary and lands in the login handler. ${evidence || ''}`.trim();
      case 'middleware':
        return `Middleware validates tokens, sessions, or request guards before the request continues. ${evidence || ''}`.trim();
      case 'service':
        return `Service logic validates identity and prepares the authenticated session. ${evidence || ''}`.trim();
      case 'database':
        return `Persistence reads or updates the user/session record. ${evidence || ''}`.trim();
      case 'response':
        return `The application returns the signed-in state to the user. ${evidence || ''}`.trim();
      default:
        break;
    }
  }

  return `${roleDescriptionFor(candidate.role, stageKey)}${evidence ? ` ${evidence}` : ''}`.trim();
}

function roleDescriptionFor(role, stageKey) {
  switch (role) {
    case 'entry':
      return 'This is the user or process entrypoint where execution begins.';
    case 'api':
      return 'This file defines the request boundary and forwards work to deeper layers.';
    case 'middleware':
      return 'This layer guards, normalizes, or enriches the request before it reaches core logic.';
    case 'service':
      return 'This file contains business logic and orchestration.';
    case 'database':
      return 'This file manages persistence, models, or data access.';
    case 'component':
      return stageKey === 'response'
        ? 'This UI layer shows the final state or result to the user.'
        : 'This file drives a UI boundary or major interaction surface.';
    case 'config':
      return 'This file configures environment, constants, or boot behavior.';
    case 'utility':
      return 'This helper supports multiple parts of the repository.';
    default:
      return 'This node sits inside the active execution path.';
  }
}

function connectionLabelForStep(fromKind, toKind, topic) {
  if (topic.toLowerCase().includes('login')) {
    if (fromKind === 'entry' && toKind === 'api') return 'submits credentials';
    if (fromKind === 'api' && toKind === 'middleware') return 'passes auth';
    if (fromKind === 'middleware' && toKind === 'service') return 'validates identity';
    if (fromKind === 'service' && toKind === 'database') return 'queries persistence';
    if (fromKind === 'database' && toKind === 'response') return 'returns session';
  }

  if (fromKind === 'entry' && toKind === 'api') return 'dispatches';
  if (fromKind === 'api' && toKind === 'middleware') return 'guards';
  if (fromKind === 'middleware' && toKind === 'service') return 'delegates';
  if (fromKind === 'service' && toKind === 'database') return 'queries';
  if (fromKind === 'database' && toKind === 'response') return 'responds';
  return 'connects';
}

function getPriorityPatterns(analysis) {
  const style = String(analysis.architecture?.architectureStyle || '').toLowerCase();
  const projectType = String(analysis.architecture?.projectType || '').toLowerCase();

  if (projectType.includes('full-stack')) {
    return ['frontend/src/main.jsx', 'frontend/src/app.jsx', 'backend/src/server.js', 'backend/src/app.js'];
  }

  if (style.includes('express')) {
    return ['backend/src/server.js', 'backend/src/app.js', 'backend/src/routes/', 'backend/src/controllers/', 'backend/src/services/'];
  }

  if (style.includes('next')) {
    return ['app/page', 'app/api', 'components/', 'services/', 'lib/'];
  }

  if (style.includes('spa') || projectType.includes('frontend')) {
    return ['src/main', 'src/app', 'components/', 'pages/', 'services/'];
  }

  return ['src/main', 'src/index', 'src/app', 'routes/', 'services/', 'components/'];
}

function walkthroughTitleForRole(role, node, index) {
  const basename = path.basename(node?.path || `step-${index + 1}`);

  switch (role) {
    case 'entry':
      return `Start with ${basename}`;
    case 'api':
      return `Trace the request boundary: ${basename}`;
    case 'middleware':
      return `Inspect the guard layer: ${basename}`;
    case 'service':
      return `Read the core logic: ${basename}`;
    case 'database':
      return `Study persistence: ${basename}`;
    case 'component':
      return `Study the UI boundary: ${basename}`;
    case 'config':
      return `Review configuration: ${basename}`;
    case 'utility':
      return `Understand shared helpers: ${basename}`;
    default:
      return `Read ${basename}`;
  }
}

function walkthroughReasonForRole(role, node, analysis) {
  const pathLabel = node?.path || 'the repository';

  switch (role) {
    case 'entry':
      return `${pathLabel} bootstraps the app and shows where execution begins.`;
    case 'api':
      return `${pathLabel} exposes the public request surface and links callers to deeper layers.`;
    case 'middleware':
      return `${pathLabel} usually handles authentication, validation, or request shaping.`;
    case 'service':
      return `${pathLabel} contains the orchestration and business logic worth reading early.`;
    case 'database':
      return `${pathLabel} connects the architecture to state, storage, or persistence.`;
    case 'component':
      return `${pathLabel} drives the primary user-facing interaction flow.`;
    case 'config':
      return `${pathLabel} explains environment and bootstrap choices used across the app.`;
    case 'utility':
      return `${pathLabel} is a reusable helper that supports multiple areas of the system.`;
    default:
      return `${pathLabel} is a useful structural waypoint in ${analysis.projectName}.`;
  }
}

function walkthroughFocusForRole(role, analysis) {
  const projectType = String(analysis.architecture?.projectType || '').toLowerCase();

  switch (role) {
    case 'entry':
      return 'Entry flow and startup sequence';
    case 'api':
      return 'Routing and request boundaries';
    case 'middleware':
      return 'Guards, validation, and request shaping';
    case 'service':
      return 'Business logic and orchestration';
    case 'database':
      return 'State, models, and persistence';
    case 'component':
      return projectType.includes('frontend') ? 'UI composition and interactions' : 'User-facing structure';
    case 'config':
      return 'Boot-time configuration';
    case 'utility':
      return 'Shared helper behavior';
    default:
      return 'Structural context';
  }
}

function collectSupportingFiles(nodes, filePath, hotspots) {
  const current = normalizePath(filePath);
  const support = [];

  for (const hotspot of hotspots) {
    if (normalizePath(hotspot.path) === current) continue;
    support.push(hotspot.path);
    if (support.length >= 2) break;
  }

  if (support.length === 0) {
    const node = nodes.find((item) => normalizePath(item.path) === current);
    if (node?.metadata?.imports?.length) support.push(...node.metadata.imports.slice(0, 2));
  }

  return [...new Set(support)].slice(0, 3);
}

function estimateWalkthroughMinutes(stepCount, analysis) {
  const moduleCount = analysis.architecture?.modules?.length || 0;
  const fileCount = analysis.stats?.totalFiles || 0;
  const minutes = Math.max(10, Math.round(stepCount * 3 + Math.min(20, moduleCount * 1.2) + Math.min(10, fileCount / 180)));
  return Math.round(minutes / 5) * 5;
}

function buildLearningGoals(analysis, steps) {
  const goals = [];
  const projectType = String(analysis.architecture?.projectType || '').toLowerCase();

  if (projectType.includes('full-stack')) goals.push('Map frontend requests to backend responses');
  if (projectType.includes('frontend') || projectType.includes('react')) goals.push('Understand component composition and UI state');
  if (projectType.includes('node') || projectType.includes('express')) goals.push('Trace requests through routes, controllers, and services');
  if (projectType.includes('python')) goals.push('Follow the module layout and execution entrypoints');

  goals.push('Identify the core execution path');
  goals.push('Spot architectural hotspots and helpers');

  for (const step of steps.slice(0, 3)) {
    goals.push(`Read ${path.basename(step.file)}`);
  }

  return [...new Set(goals)].slice(0, 5);
}

function rankHotspotFiles(nodes, edges, analysis) {
  const degreeMap = buildDegreeMap(nodes, edges);
  const entrypoints = new Set((analysis.architecture?.entrypoints || []).map(normalizePath));
  const importantFiles = new Set((analysis.stats?.importantFiles || []).map(normalizePath));

  return [...nodes]
    .filter((node) => node.path)
    .map((node) => {
      const role = classifyRole(node.path);
      const degree = degreeMap.get(node.id) || { incoming: 0, outgoing: 0 };
      const score =
        roleWeight(role) +
        Math.min(28, Math.round(degree.incoming * 2.6 + degree.outgoing * 1.8)) +
        (entrypoints.has(normalizePath(node.path)) ? 18 : 0) +
        (importantFiles.has(normalizePath(node.path)) ? 12 : 0) +
        metadataScore(node.metadata || {});

      return { path: node.path, score };
    })
    .sort((a, b) => b.score - a.score);
}

function buildDegreeMap(nodes, edges) {
  const map = new Map();

  for (const node of nodes) {
    map.set(node.id, { incoming: 0, outgoing: 0 });
  }

  for (const edge of edges) {
    const outgoing = map.get(edge.source);
    const incoming = map.get(edge.target);
    if (outgoing) outgoing.outgoing += 1;
    if (incoming) incoming.incoming += 1;
  }

  return map;
}

function gatherRelatedFiles(node, nodes, edges) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]));
  const relatedIds = new Set();

  for (const edge of edges) {
    if (edge.source === node.id) relatedIds.add(edge.target);
    if (edge.target === node.id) relatedIds.add(edge.source);
  }

  return [...relatedIds]
    .map((id) => nodeById.get(id))
    .filter(Boolean)
    .map((item) => item.path)
    .slice(0, 6);
}

function routeTitle(node, fallback) {
  const route = node?.metadata?.routePath;
  const method = node?.metadata?.method?.toUpperCase();
  if (route && method) return `${method} ${route}`;
  if (route) return route;
  return node?.label || fallback;
}

function scoreQueryMatch(node, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return 0;

  const haystack = [
    node.label,
    node.path,
    node.metadata?.imports?.join(' '),
    node.metadata?.exports?.join(' '),
    node.metadata?.functions?.join(' '),
    node.metadata?.components?.join(' '),
    node.metadata?.routes?.map((route) => `${route.method} ${route.path}`).join(' ')
  ]
    .join(' ')
    .toLowerCase();

  let overlap = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) overlap += 1;
  }

  return Math.min(18, overlap * 4);
}

function metadataScore(metadata) {
  return (
    (metadata.imports?.length || 0) * 0.8 +
    (metadata.exports?.length || 0) * 1.5 +
    (metadata.functions?.length || 0) * 0.8 +
    (metadata.components?.length || 0) * 1.2 +
    (metadata.routes?.length || 0) * 2
  );
}

function roleWeight(role) {
  switch (role) {
    case 'entry':
      return 18;
    case 'api':
      return 16;
    case 'middleware':
      return 15;
    case 'service':
      return 14;
    case 'database':
      return 13;
    case 'component':
      return 12;
    case 'config':
      return 10;
    case 'utility':
      return 8;
    case 'external':
      return 4;
    default:
      return 9;
  }
}

function classifyRole(filePath = '') {
  const normalized = normalizePath(filePath);

  if (/\/(middleware|middlewares)\//.test(normalized) || /auth|jwt|guard|verify/.test(normalized)) return 'middleware';
  if (/\/(services|service|usecases|use-cases)\//.test(normalized)) return 'service';
  if (/\/(routes|route|controllers|controller|api)\//.test(normalized)) return 'api';
  if (/\/(db|database|models|model|schema|repositories|repository|store)\//.test(normalized)) return 'database';
  if (/\/(config|configs|constants)\//.test(normalized)) return 'config';
  if (/\/(utils|helper|helpers)\//.test(normalized)) return 'utility';
  if (/\/(components|pages|app)\//.test(normalized)) return 'component';
  if (/^(src\/)?(main|index|app|server)\./.test(normalized) || /\/(main|index|server)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(normalized)) return 'entry';
  return 'module';
}

function extractTopic(query = '') {
  return tokenize(query)
    .filter((token) => !STOP_WORDS.has(token))
    .slice(0, 4)
    .join(' ');
}

function tokenize(value = '') {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').toLowerCase();
}

function titleCase(value = '') {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
