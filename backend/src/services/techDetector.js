import path from 'node:path';
import { readTextFileSafe } from './fileScanner.js';

const packageSignals = {
  react: 'React',
  next: 'Next.js',
  express: 'Express',
  typescript: 'TypeScript',
  tailwindcss: 'Tailwind',
  mongodb: 'MongoDB',
  mongoose: 'MongoDB',
  firebase: 'Firebase',
  'firebase-admin': 'Firebase'
};

const configSignals = [
  { match: 'tsconfig.json', tech: 'TypeScript', confidence: 0.35 },
  { match: 'tailwind.config', tech: 'Tailwind', confidence: 0.45 },
  { match: 'next.config', tech: 'Next.js', confidence: 0.35 },
  { match: 'dockerfile', tech: 'Docker', confidence: 0.65 },
  { match: 'docker-compose', tech: 'Docker', confidence: 0.65 },
  { match: 'requirements.txt', tech: 'Python', confidence: 0.35 },
  { match: 'pyproject.toml', tech: 'Python', confidence: 0.35 }
];

export async function detectTechStack(scan) {
  const signals = new Map();

  const addSignal = (tech, confidence, evidence, category = 'Framework') => {
    const current = signals.get(tech) || {
      name: tech,
      category,
      confidence: 0,
      evidence: new Set()
    };
    current.confidence = Math.min(1, current.confidence + confidence);
    current.evidence.add(evidence);
    signals.set(tech, current);
  };

  for (const file of scan.files) {
    const lowerPath = file.path.toLowerCase();

    for (const config of configSignals) {
      if (lowerPath.includes(config.match)) {
        addSignal(config.tech, config.confidence, `${file.path} config`);
      }
    }

    if (file.extension === '.ts' || file.extension === '.tsx') {
      addSignal('TypeScript', 0.2, `${file.extension} files`, 'Language');
    }

    if (file.extension === '.py') {
      addSignal('Python', 0.2, 'Python source files', 'Language');
    }

    if (file.extension === '.jsx' || file.extension === '.tsx') {
      addSignal('React', 0.25, 'JSX/TSX source files');
    }
  }

  await inspectPackageJsonFiles(scan, addSignal);
  await inspectPythonRequirementFiles(scan, addSignal);
  await inspectSourceImports(scan, addSignal);

  return [...signals.values()]
    .map((tech) => ({
      ...tech,
      confidence: Number(tech.confidence.toFixed(2)),
      evidence: [...tech.evidence].slice(0, 5)
    }))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

async function inspectPackageJsonFiles(scan, addSignal) {
  const packageFiles = scan.files.filter((file) => file.name === 'package.json');

  for (const file of packageFiles) {
    try {
      const content = await readTextFileSafe(file.absolutePath);
      const manifest = JSON.parse(content);
      const dependencies = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies
      };

      if (Object.keys(dependencies).length > 0 || manifest.scripts) {
        addSignal('Node', 0.55, `${file.path} manifest`, 'Runtime');
      }

      for (const [dependency] of Object.entries(dependencies)) {
        const tech = packageSignals[dependency];
        if (tech) {
          addSignal(tech, 0.65, `${dependency} dependency`);
        }
      }

      if (dependencies.vite || dependencies['@vitejs/plugin-react']) {
        addSignal('React', 0.2, 'Vite React tooling');
      }
    } catch {
      addSignal('Node', 0.2, `${file.path} exists but could not be parsed`, 'Runtime');
    }
  }
}

async function inspectPythonRequirementFiles(scan, addSignal) {
  const requirementFiles = scan.files.filter((file) =>
    ['requirements.txt', 'pyproject.toml'].includes(path.basename(file.path).toLowerCase())
  );

  for (const file of requirementFiles) {
    const content = (await readTextFileSafe(file.absolutePath)).toLowerCase();
    if (!content) continue;

    addSignal('Python', 0.3, `${file.path} dependencies`, 'Language');
    if (content.includes('pymongo')) addSignal('MongoDB', 0.35, 'pymongo dependency', 'Database');
    if (content.includes('firebase-admin')) addSignal('Firebase', 0.35, 'firebase-admin dependency');
  }
}

async function inspectSourceImports(scan, addSignal) {
  const sourceFiles = scan.files
    .filter((file) => ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py'].includes(file.extension))
    .slice(0, 160);

  for (const file of sourceFiles) {
    const content = await readTextFileSafe(file.absolutePath, 128 * 1024);
    if (!content) continue;

    if (/\bfrom\s+['"]react['"]|require\(['"]react['"]\)/.test(content)) {
      addSignal('React', 0.25, `React import in ${file.path}`);
    }
    if (/\bfrom\s+['"]express['"]|require\(['"]express['"]\)/.test(content)) {
      addSignal('Express', 0.35, `Express import in ${file.path}`);
      addSignal('Node', 0.15, 'Express source import', 'Runtime');
    }
    if (/\bfrom\s+['"]next\//.test(content)) {
      addSignal('Next.js', 0.25, `Next import in ${file.path}`);
    }
    if (/\bmongoose\b|\bmongodb\b/.test(content)) {
      addSignal('MongoDB', 0.25, `MongoDB usage in ${file.path}`, 'Database');
    }
    if (/\bfirebase\b/.test(content)) {
      addSignal('Firebase', 0.25, `Firebase usage in ${file.path}`);
    }
    if (/\bclassName\s*=\s*["'`][^"'`]*(?:flex|grid|bg-|text-|p-|m-)/.test(content)) {
      addSignal('Tailwind', 0.15, `Tailwind-like classes in ${file.path}`);
    }
  }
}

