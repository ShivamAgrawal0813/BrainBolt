/**
 * BrainBolt Backend - Entry point
 * Reads PORT (default 3001), DATABASE_URL, REDIS_URL from environment.
 */
import express from 'express';
import { env } from './config/env';
import { getPool, closePool } from './db/pool';
import { getRedis, closeRedis } from './db/redis';
import { logger } from './logger';
import { submitAnswer } from './services/answerService';
import { ApiError } from './errors';
import { seedQuestions } from './db/seed';

const app = express();
app.use(express.json());

// request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path, body: req.body }, 'incoming request');
  next();
});

app.get('/', (_req, res) => {
  res.json({ name: 'BrainBolt API', version: process.env.npm_package_version || '1.0.0' });
});

// Enhanced health-check with latency + small cross-check between DB and Redis leaderboards
app.get('/health', async (_req, res) => {
  const pool = getPool();
  const redis = getRedis();
  const health: any = { timestamp: new Date().toISOString() };

  // DB latency
  try {
    if (!pool) throw new Error('db_not_configured');
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.dbLatencyMs = Date.now() - dbStart;
    health.database = 'ok';
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    health.database = 'unhealthy';
  }

  // Redis latency
  try {
    if (!redis) throw new Error('redis_not_configured');
    const rStart = Date.now();
    const pong = await redis.ping();
    health.redisLatencyMs = Date.now() - rStart;
    health.redis = pong === 'PONG' ? 'ok' : 'unhealthy';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    health.redis = 'unhealthy';
  }

  // version mismatch detection between DB leaderboard_score and Redis ZSET (best-effort)
  try {
    if (pool) {
      const top = await pool.query('SELECT user_id, total_score FROM leaderboard_score ORDER BY total_score DESC LIMIT 1');
      if (top.rowCount === 1 && redis) {
        const dbTop = top.rows[0];
        const z = await redis.zrevrange('leaderboard:score', 0, 0, 'WITHSCORES');
        if (z && z.length >= 2) {
          const redisUserId = z[0];
          const redisScore = Number(z[1]);
          health.leaderboard = {
            dbTop: dbTop.user_id,
            redisTop: redisUserId,
            match: redisUserId === dbTop.user_id && redisScore === Number(dbTop.total_score),
          };
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'leaderboard version check failed (non-fatal)');
  }

  const ok = health.database === 'ok';
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', details: health });
});

// POST /answers/submit — idempotent, rate-limited, transactional
app.post('/answers/submit', async (req, res, next) => {
  try {
    const out = await submitAnswer(req.body);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err && err.statusCode) {
    logger.warn({ err: err.message, code: err.code, details: err.details }, 'handled error');
    return res.status(err.statusCode).json({ error: err.message, code: err.code, details: err.details });
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal_server_error' });
});

let server: any;

// optional seed on startup; start server after seeding (non-fatal)
(async function bootstrap() {
  if (process.env.SEED === 'true') {
    try {
      logger.info('SEED=true — running seedQuestions before accepting traffic');
      await seedQuestions();
      logger.info('seedQuestions finished');
    } catch (err) {
      logger.error({ err }, 'seedQuestions failed (continuing startup)');
    }
  }

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, database: !!env.DATABASE_URL, redis: !!env.REDIS_URL }, 'server_started');
  });
})();

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown_initiated');
  // stop accepting new connections
  server.close(async (err: any) => {
    if (err) logger.error({ err }, 'server close error');
    try {
      await closePool();
      logger.info('postgres pool closed');
    } catch (e) {
      logger.error({ e }, 'error closing postgres pool');
    }
    try {
      await closeRedis();
      logger.info('redis connection closed');
    } catch (e) {
      logger.error({ e }, 'error closing redis');
    }
    logger.info('shutdown_complete');
    process.exit(err ? 1 : 0);
  });

  // force exit if not closed within 10s
  setTimeout(() => {
    logger.warn('shutdown_forced_timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { server };

