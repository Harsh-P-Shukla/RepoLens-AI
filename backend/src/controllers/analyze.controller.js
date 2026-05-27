import { extractArchitecture } from '../services/architectureExtractor.js';
import { cleanupClone } from '../services/cleanup.js';
import { buildDependencyGraph } from '../services/dependencyMapper.js';
import { scanRepository } from '../services/fileScanner.js';
import { createRepositoryRecord, getRepositoryMemory } from '../services/repositoryRegistry.js';
import { startRepositoryIndexing } from '../services/knowledgeBaseIndexer.js';
import { cloneRepository } from '../services/repoCloner.js';
import { generateProjectSummary } from '../services/summaryEngine.js';
import { detectTechStack } from '../services/techDetector.js';
import { normalizeGitHubUrl } from '../utils/repoUrl.js';
import { v4 as uuidv4 } from 'uuid';

export async function analyzeRepository(req, res, next) {
  let clone;

  try {
    const repoUrl = req.body?.repoUrl;
    const normalized = normalizeGitHubUrl(repoUrl);

    clone = await cloneRepository(normalized);
    const scan = await scanRepository(clone.repoPath);
    const techStack = await detectTechStack(scan);
    const dependencyGraph = await buildDependencyGraph(scan);
    const architecture = extractArchitecture({
      scan,
      techStack,
      dependencyGraph,
      projectName: normalized.projectName
    });
    const summary = await generateProjectSummary({
      projectName: normalized.projectName,
      techStack,
      architecture,
      stats: scan.stats
    });
    const repoId = uuidv4();

    const payload = {
      repoId,
      projectName: normalized.projectName,
      repository: {
        owner: normalized.owner,
        name: normalized.projectName,
        url: normalized.htmlUrl,
        clonedAt: clone.clonedAt
      },
      techStack,
      summary,
      architecture,
      folderTree: scan.folderTree,
      dependencyGraph,
      stats: scan.stats
    };

    await createRepositoryRecord(repoId, payload);
    startRepositoryIndexing({
      repoId,
      scan,
      analysis: payload,
      cleanupPath: clone.repoPath
    });
    clone = null;

    res.json({
      ...payload,
      memory: await getRepositoryMemory(repoId)
    });
  } catch (error) {
    next(error);
  } finally {
    await cleanupClone(clone?.repoPath);
  }
}
