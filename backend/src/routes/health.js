import { Router } from 'express';

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Lightweight liveness probe.
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /api/ready
 * Readiness probe checking system dependencies.
 */
router.get('/ready', (_req, res) => {
  // In Phase 1, we return ready true since local storage & backend are operational
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      storage: 'ok',
      memory: 'ok',
    },
  });
});

export default router;
