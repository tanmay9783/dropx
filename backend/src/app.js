import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import healthRoutes from './routes/health.js';
import roomRoutes from './routes/room.js';
import fileRoutes from './routes/file.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createLimiter } from './middleware/rateLimiterStore.js';

const app = express();

// Express proxy trust configuration for ALB + Nginx deployment
app.set('trust proxy', env.TRUST_PROXY_HOPS);

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman) or matching allowed origins / wildcard
      if (!origin || env.ALLOWED_ORIGINS.includes('*') || env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Global rate limiting with Redis store support
const limiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Structured HTTP Request Logging
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// Body parsing with 100kb limit protection against payload exhaustion
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Routes
app.use('/api', healthRoutes);
app.use('/api', roomRoutes);
app.use('/api', fileRoutes);

import path from 'node:path';
import fs from 'node:fs';

const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central Error Handler
app.use(errorHandler);

export default app;
