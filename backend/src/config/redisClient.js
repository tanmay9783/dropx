import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let mainClient = null;
let pubClient = null;
let subClient = null;

function createRedisConnection(name = 'main') {
  const options = {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  };

  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, options);
  } else if (env.REDIS_HOST) {
    return new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD || undefined,
      ...options,
    });
  }
  return null;
}

export async function getRedisClient() {
  if (!env.REDIS_URL && !env.REDIS_HOST) {
    return null;
  }

  if (!mainClient) {
    mainClient = createRedisConnection('main');
    if (mainClient) {
      mainClient.on('error', (err) => logger.error({ err }, 'Redis Main Client Error'));
      mainClient.on('connect', () => logger.info('Connected to Redis server'));
      try {
        await mainClient.connect();
      } catch (err) {
        logger.error({ err }, 'Failed to connect to Redis server');
      }
    }
  }
  return mainClient;
}

export async function getPubSubClients() {
  if (!env.REDIS_URL && !env.REDIS_HOST) {
    return { pubClient: null, subClient: null };
  }

  if (!pubClient || !subClient) {
    pubClient = createRedisConnection('pub');
    subClient = createRedisConnection('sub');

    if (pubClient && subClient) {
      pubClient.on('error', (err) => logger.error({ err }, 'Redis Pub Client Error'));
      subClient.on('error', (err) => logger.error({ err }, 'Redis Sub Client Error'));

      try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
      } catch (err) {
        logger.error({ err }, 'Failed to connect Redis Pub/Sub clients');
      }
    }
  }

  return { pubClient, subClient };
}

export async function closeRedis() {
  const disconnects = [];
  if (mainClient) disconnects.push(mainClient.quit().catch(() => {}));
  if (pubClient) disconnects.push(pubClient.quit().catch(() => {}));
  if (subClient) disconnects.push(subClient.quit().catch(() => {}));
  
  await Promise.all(disconnects);
  mainClient = null;
  pubClient = null;
  subClient = null;
}
