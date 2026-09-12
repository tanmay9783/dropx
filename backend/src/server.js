import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { initDb, closeDb } from './db/index.js';
import { startRoomCleanupJob, stopRoomCleanupJob } from './jobs/roomCleanup.js';
import { initSocketIo } from './sockets/socketHandler.js';
import { closeRedis } from './config/redisClient.js';
import { logger } from './utils/logger.js';

async function startServer() {
  try {
    // Initialize database
    await initDb();

    // Start background cleanup job
    startRoomCleanupJob();

    // Create HTTP Server sharing Express app and Socket.IO
    const httpServer = http.createServer(app);
    initSocketIo(httpServer);

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 DropX Backend & Socket.IO server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      stopRoomCleanupJob();
      
      httpServer.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await closeRedis();
          await closeDb();
          logger.info('Graceful shutdown completed successfully.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during graceful shutdown cleanup');
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown exceeds 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
