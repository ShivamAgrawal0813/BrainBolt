/**
 * BrainBolt Backend - Entry point
 * Reads PORT (default 3001), DATABASE_URL, REDIS_URL from environment.
 */
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { getPool, closePool } from './db/pool';
import { getRedis, closeRedis } from './db/redis';
import { ApiError } from './errors';
import { logger } from './logger';
import { seedQuestions } from './db/seed';

import authRouter from './routes/auth';
import quizRouter from './routes/quiz';
import leaderboardRouter from './routes/leaderboard';
import { authenticateJWT } from './middleware/auth';

const app = express();

app.use(cors());
app.use(express.json());

// ── Health & Root ──────────────────────────────────────────────────────────────
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

// ── Feature Routes ─────────────────────────────────────────────────────────────
app.use('/v1/auth', authRouter);
app.use('/v1/quiz', authenticateJWT, quizRouter);
app.use('/v1/leaderboard', authenticateJWT, leaderboardRouter);

// ── Error Handler ──────────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ApiError) {
    logger.warn({ statusCode: err.statusCode, code: err.code, details: err.details, method: req.method, url: req.originalUrl }, `API Error: ${err.message}`);
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal Server Error', code: 'internal_error' });
});

// ── Start Server ───────────────────────────────────────────────────────────────
const server = app.listen(env.PORT, async () => {
  logger.info(`BrainBolt backend listening on port ${env.PORT}`);
  logger.info(`DATABASE_URL: ${env.DATABASE_URL ? 'set' : 'not set'}`);
  logger.info(`REDIS_URL: ${env.REDIS_URL ? 'set' : 'not set'}`);

  // Seed questions if SEED env var is set
  if (process.env.SEED === 'true') {
    try {
      await seedQuestions();
      logger.info('Database seeding completed');
    } catch (err) {
      logger.error({ err }, 'Database seeding failed');
    }
  }
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    try { await closePool(); } catch (_) { /* noop */ }
    try { await closeRedis(); } catch (_) { /* noop */ }
    logger.info('All connections closed. Exiting.');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { server };
