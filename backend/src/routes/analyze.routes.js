import { Router } from 'express';
import { analyzeRepository } from '../controllers/analyze.controller.js';

const router = Router();

router.post('/analyze', analyzeRepository);

export default router;

