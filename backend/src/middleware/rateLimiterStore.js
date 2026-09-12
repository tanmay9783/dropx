import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let sharedRedisClient = null;

function getLimiterRedisClient() {
  if (!sharedRedisClient && (env.REDIS_URL || env.REDIS_HOST)) {
    try {
      if (env.REDIS_URL) {
        sharedRedisClient = new Redis(env.REDIS_URL);
      } else {
        sharedRedisClient = new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT || 6379,
          password: env.REDIS_PASSWORD || undefined,
        });
      }
      sharedRedisClient.on('error', (err) => logger.error({ err }, 'Limiter Redis Client Error'));
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Redis client for rate limiter');
    }
  }
  return sharedRedisClient;
}

export function createLimiter(options) {
  const redisClient = getLimiterRedisClient();
  let store;

  if (redisClient) {
    store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:',
    });
  }

  return rateLimit({
    ...options,
    ...(store ? { store } : {}),
  });
}
