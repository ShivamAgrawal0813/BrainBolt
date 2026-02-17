/**
 * BrainBolt Backend - Entry point
 * Reads PORT (default 3001), DATABASE_URL, REDIS_URL from environment.
 */
import express from 'express';
import { env } from './config/env.js';
import { getPool } from './db/pool';
import { getRedis } from './db/redis';

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'BrainBolt API', version: '1.0.0' });
});

app.get('/health', async (_req, res) => {
  let dbOk = false;
  let redisOk = false;
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query('SELECT 1');
      dbOk = r.rowCount === 1;
    }
  } catch {
    dbOk = false;
  }
  try {
    const redis = getRedis();
    if (redis) {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    }
  } catch {
    redisOk = false;
  }
  const status = dbOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: { database: dbOk ? 'ok' : 'unhealthy', redis: redisOk ? 'ok' : 'unhealthy' },
  });
});

const server = app.listen(env.PORT, () => {
  console.log(`BrainBolt backend listening on port ${env.PORT}`);
  console.log(`DATABASE_URL: ${env.DATABASE_URL ? 'set' : 'not set'}`);
  console.log(`REDIS_URL: ${env.REDIS_URL ? 'set' : 'not set'}`);
});

export { server };
