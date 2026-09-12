import os from 'node:os';
import { env } from '../config/env.js';
import { getRedisClient } from '../config/redisClient.js';
import { roomService } from '../services/roomService.js';
import { fileService } from '../services/fileService.js';
import { logger } from '../utils/logger.js';

let intervalId = null;
const instanceId = `${os.hostname()}-${process.pid}`;

async function acquireCleanupLock() {
  const redis = await getRedisClient();
  if (!redis) return true; // Single-instance or dev mode without Redis

  const lockKey = 'lock:room-cleanup';
  const lockTtlMs = Math.max(10000, env.ROOM_CLEANUP_INTERVAL_MS - 5000);
  
  try {
    const res = await redis.set(lockKey, instanceId, 'NX', 'PX', lockTtlMs);
    return res === 'OK';
  } catch (err) {
    logger.warn({ errMessage: err.message }, 'Failed to acquire Redis cleanup lock, falling back to local run');
    return true;
  }
}

export function startRoomCleanupJob() {
  if (intervalId) return;

  const intervalMs = env.ROOM_CLEANUP_INTERVAL_MS;
  logger.info({ intervalMs, instanceId }, 'Starting periodic room & file cleanup job');

  intervalId = setInterval(async () => {
    const hasLock = await acquireCleanupLock();
    if (!hasLock) {
      logger.debug({ instanceId }, 'Skipping cleanup job cycle (lock owned by another instance)');
      return;
    }

    let expiredRoomsCount = 0;
    let cleanedFilesCount = 0;

    try {
      expiredRoomsCount = await roomService.cleanupExpiredRooms();
    } catch (roomErr) {
      logger.error({ errMessage: roomErr.message }, 'Error occurred during room cleanup step');
    }

    try {
      cleanedFilesCount = await fileService.cleanupExpiredFiles();
    } catch (fileErr) {
      logger.error({ errMessage: fileErr.message }, 'Error occurred during file cleanup step');
    }

    if (expiredRoomsCount > 0 || cleanedFilesCount > 0) {
      logger.info({ expiredRoomsCount, cleanedFilesCount, instanceId }, '🧹 Periodic cleanup job finished');
    }
  }, intervalMs);

  if (intervalId.unref) {
    intervalId.unref();
  }
}

export function stopRoomCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info({ instanceId }, 'Stopped room cleanup job');
  }
}
