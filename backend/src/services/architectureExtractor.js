export function extractArchitecture({ scan, techStack, dependencyGraph, projectName }) {
  const techNames = new Set(techStack.map((tech) => tech.name));
  const entrypoints = findEntrypoints(scan.files);
  const modules = findArchitecturalModules(scan.files);
  const projectType = inferProjectType(techNames, scan.files);
  const architectureStyle = inferArchitectureStyle(techNames, scan.files);

  return {
    projectName,
    projectType,
    architectureStyle,
    entrypoints,
    modules,
    conventions: inferConventions(scan.files),
    graphHealth: {
      nodeCount: dependencyGraph.nodes.length,
      edgeCount: dependencyGraph.edges.length,
      parser: dependencyGraph.parser
    },
    dataFlow: inferDataFlow(techNames)
  };
}

function inferProjectType(techNames, files) {
  const hasFrontend = techNames.has('React') || techNames.has('Next.js');
  const hasBackend = techNames.has('Express') || files.some((file) => file.path.includes('/api/'));

  if (hasFrontend && hasBackend) return 'Full-stack JavaScript application';
  if (techNames.has('Next.js')) return 'Next.js web application';
  if (techNames.has('React')) return 'Frontend single-page application';
  if (techNames.has('Express')) return 'Node/Express API service';
  if (techNames.has('Python')) return 'Python application';
  if (techNames.has('Docker')) return 'Containerized application';
  return 'General software repository';
}

function inferArchitectureStyle(techNames, files) {
  const topLevelFolders = new Set(
    files
      .map((file) => file.path.split('/')[0])
      .filter(Boolean)
  );

  if (topLevelFolders.has('frontend') && topLevelFolders.has('backend')) {
    return 'Client-server monorepo';
  }

  if (techNames.has('Next.js')) return 'File-system routed Next.js architecture';
  if (techNames.has('React')) return 'Component-driven SPA architecture';
  if (techNames.has('Express')) return 'Layered Express service architecture';
  if (techNames.has('Python')) return 'Script or package-oriented Python architecture';
  return 'Modular repository architecture';
}

function findEntrypoints(files) {
  const patterns = [
    /(^|\/)main\.(jsx|tsx|js|ts)$/,
    /(^|\/)index\.(jsx|tsx|js|ts)$/,
    /(^|\/)app\.(jsx|tsx|js|ts)$/,
    /(^|\/)server\.(js|ts|mjs)$/,
    /(^|\/)app\/page\.(jsx|tsx|js|ts)$/,
    /(^|\/)pages\/index\.(jsx|tsx|js|ts)$/,
    /(^|\/)__main__\.py$/,
    /(^|\/)main\.py$/
  ];

  return files
    .filter((file) => patterns.some((pattern) => pattern.test(file.path)))
    .map((file) => file.path)
    .slice(0, 12);
}

function findArchitecturalModules(files) {
  const folderSignals = new Map();
  const interestingNames = new Set([
    'api',
    'app',
    'components',
    'config',
    'controllers',
    'hooks',
    'lib',
    'models',
    'pages',
    'routes',
    'services',
    'src',
    'store',
    'utils'
  ]);

  for (const file of files) {
    const parts = file.path.split('/').slice(0, -1);
    for (const part of parts) {
      if (!interestingNames.has(part)) continue;
      const current = folderSignals.get(part) || { name: part, fileCount: 0 };
      current.fileCount += 1;
      folderSignals.set(part, current);
    }
  }

  return [...folderSignals.values()]
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 10);
}

function inferConventions(files) {
  const conventions = [];
  if (files.some((file) => file.path.includes('/components/'))) conventions.push('Reusable UI components');
  if (files.some((file) => file.path.includes('/services/'))) conventions.push('Service layer separation');
  if (files.some((file) => file.path.includes('/routes/'))) conventions.push('Route modules');
  if (files.some((file) => file.path.includes('/controllers/'))) conventions.push('Controller layer');
  if (files.some((file) => file.path.includes('/hooks/'))) conventions.push('React hooks');
  if (files.some((file) => file.path.includes('/models/'))) conventions.push('Data models');
  return conventions.length ? conventions : ['Lightweight folder organization'];
}

function inferDataFlow(techNames) {
  if (techNames.has('React') && techNames.has('Express')) {
    return ['React UI', 'API service', 'Data or external service layer'];
  }
  if (techNames.has('Next.js')) {
    return ['File-system routes', 'Server or client components', 'Rendered pages'];
  }
  if (techNames.has('Express')) {
    return ['HTTP request', 'Express route', 'Controller/service logic', 'JSON response'];
  }
  return ['Source files', 'Application modules', 'Runtime entrypoint'];
}

