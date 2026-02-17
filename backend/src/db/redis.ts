/**
 * Redis client (ioredis).
 * Used only when REDIS_URL is set.
 */
import Redis from 'ioredis';
import { env } from '../config/env';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  if (!env.REDIS_URL) return null;
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableReadyCheck: true,
  });
  // safe default error logging
  redis.on('error', (err) => {
    // don't crash application on Redis errors; service layer will fallback to DB
    // keep logging here for diagnostics
    // eslint-disable-next-line no-console
    console.error('Redis error:', err && err.message ? err.message : err);
  });
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
  } catch (err) {
    try {
      await redis.disconnect();
    } catch (_) {
      // noop
    }
  } finally {
    redis = null;
  }
}

