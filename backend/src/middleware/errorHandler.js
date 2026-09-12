import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.isOperational ? err.message : 'An unexpected server error occurred';

  if (statusCode >= 500) {
    logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled Server Error');
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
};
