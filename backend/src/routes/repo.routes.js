import { Router } from 'express';
import {
  chatWithRepository,
  getRepositoryFlow,
  getRepositoryMemoryStatus,
  getRepositoryWalkthrough,
  previewRepositorySource,
  searchRepository,
  streamRepositoryChat
} from '../controllers/repo.controller.js';

const router = Router();

router.get('/repo/:repoId/memory', getRepositoryMemoryStatus);
router.post('/repo/chat', chatWithRepository);
router.post('/repo/chat/stream', streamRepositoryChat);
router.post('/repo/flow', getRepositoryFlow);
router.post('/repo/walkthrough', getRepositoryWalkthrough);
router.post('/repo/search', searchRepository);
router.post('/repo/source', previewRepositorySource);

export default router;

