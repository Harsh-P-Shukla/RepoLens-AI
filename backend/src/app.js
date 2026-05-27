import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import analyzeRoutes from './routes/analyze.routes.js';
import repoRoutes from './routes/repo.routes.js';

export function createApp() {
  const app = express();
  const corsOptions = {
    origin: ['http://localhost:5173', env.FRONTEND_URL].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'repolens-backend' });
  });

  app.use('/', analyzeRoutes);
  app.use('/', repoRoutes);

  app.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: true,
      message: err.publicMessage || err.message || 'Unexpected analysis error.'
    });
  });

  return app;
}
