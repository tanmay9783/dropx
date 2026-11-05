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

// Express proxy trust configuration for ALB + Nginx + Render deployment
app.set('trust proxy', env.TRUST_PROXY_HOPS || 1);

// Security HTTP headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman) or matching allowed origins / wildcard
      if (!origin || env.ALLOWED_ORIGINS.includes('*') || env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, origin || true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Global rate limiting with Redis store support
const limiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'test' ? 5000 : 2500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate-limiting for health checks, readiness probes, and socket handshakes
    if (req.path === '/api/health' || req.path === '/api/ready') return true;
    if (req.path.startsWith('/socket.io')) return true;
    return false;
  },
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
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

const possibleDistPaths = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const frontendDist = possibleDistPaths.find((p) => fs.existsSync(p));

if (frontendDist) {
  app.use(
    express.static(frontendDist, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    // Do not return HTML for missing static assets (prevents Strict MIME type error)
    if (path.extname(req.path)) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
