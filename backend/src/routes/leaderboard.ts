import express from 'express';
import { getPool } from '../db/pool';
import { getRedis } from '../db/redis';
import { logger } from '../logger';

const router = express.Router();

// Sync interval (5 minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Update both Redis ZSETs and Postgres leaderboard tables.
 * Postgres updates are performed inside a transaction. Redis updates occur after commit.
 */
/**
 * Perform leaderboard DB upserts using an existing client (inside caller transaction).
 * The caller is responsible for transaction boundaries.
 */
export async function updateLeaderboardsDb(client: any, userId: string, totalScore: number, maxStreak: number): Promise<void> {
  await client.query(
    `INSERT INTO leaderboard_score (user_id, total_score, last_updated_at)
       VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET total_score = EXCLUDED.total_score, last_updated_at = NOW()`,
    [userId, totalScore]
  );

  await client.query(
    `INSERT INTO leaderboard_streak (user_id, max_streak, last_updated_at)
       VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET max_streak = EXCLUDED.max_streak, last_updated_at = NOW()`,
    [userId, maxStreak]
  );
}

/**
 * Best-effort Redis updates for leaderboards (call after DB commit).
 */
export async function updateLeaderboardsRedis(userId: string, totalScore: number, maxStreak: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.zadd('leaderboard:score', totalScore, userId);
    await redis.zadd('leaderboard:streak', maxStreak, userId);
  } catch (err) {
    logger.error({ err, userId, totalScore, maxStreak }, 'Failed to update Redis leaderboards');
  }
}

/**
 * Convenience wrapper that performs DB transaction + Redis update (used when caller
 * doesn't already have an active DB transaction).
 */
export async function updateLeaderboards(userId: string, totalScore: number, maxStreak: number): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await updateLeaderboardsDb(client, userId, totalScore, maxStreak);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }

  // now best-effort Redis update
  await updateLeaderboardsRedis(userId, totalScore, maxStreak);
}

/**
 * Get user's rank (1-based). If Redis has no data, fallback to DB.
 */
export async function getUserRank(userId: string, type: 'score' | 'streak'): Promise<number | null> {
  const redis = getRedis();
  const pool = getPool();

  try {
    if (redis) {
      const zkey = type === 'score' ? 'leaderboard:score' : 'leaderboard:streak';
      const r = await redis.zrevrank(zkey, userId);
      if (r !== null) return r + 1;
    }
  } catch (err) {
    logger.warn({ err, userId, type }, 'Redis rank lookup failed — falling back to DB');
  }

  // Fallback to DB
  if (!pool) return null;
  try {
    if (type === 'score') {
      // obtain user's total_score
      const userRow = await pool.query('SELECT total_score FROM leaderboard_score WHERE user_id = $1', [userId]);
      if (userRow.rowCount === 0) return null;
      const total = Number(userRow.rows[0].total_score);
      const r = await pool.query('SELECT COUNT(1) AS higher FROM leaderboard_score WHERE total_score > $1', [total]);
      return Number(r.rows[0].higher) + 1;
    } else {
      const userRow = await pool.query('SELECT max_streak FROM leaderboard_streak WHERE user_id = $1', [userId]);
      if (userRow.rowCount === 0) return null;
      const maxStreak = Number(userRow.rows[0].max_streak);
      const r = await pool.query('SELECT COUNT(1) AS higher FROM leaderboard_streak WHERE max_streak > $1', [maxStreak]);
      return Number(r.rows[0].higher) + 1;
    }
  } catch (err) {
    logger.error({ err, userId, type }, 'DB fallback for rank failed');
    return null;
  }
}

// Helper to parse limit/offset safely
function parseLimitOffset(q: any) {
  const limit = Math.max(1, Math.min(100, Number.isFinite(Number(q.limit)) ? Number(q.limit) : 10));
  const offset = Math.max(0, Number.isFinite(Number(q.offset)) ? Number(q.offset) : 0);
  return { limit, offset };
}

// Helper to resolve usernames for a list of user IDs via a single batch query
async function resolveUsernames(pool: any, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!pool || userIds.length === 0) return map;
  try {
    const r = await pool.query('SELECT id, username FROM users WHERE id = ANY($1)', [userIds]);
    for (const row of r.rows) {
      map.set(String(row.id), row.username);
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to resolve usernames for leaderboard');
  }
  return map;
}

// GET /v1/leaderboard/score
router.get('/score', async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const redis = getRedis();
    const pool = getPool();

    // try Redis first
    try {
      if (redis) {
        const range = await redis.zrevrange('leaderboard:score', offset, offset + limit - 1, 'WITHSCORES');
        if (Array.isArray(range) && range.length > 0) {
          const userIds: string[] = [];
          const entries: Array<{ rank: number; userId: string; totalScore: number }> = [];
          for (let i = 0; i < range.length; i += 2) {
            const userId = range[i];
            const scoreStr = range[i + 1];
            const index = i / 2;
            userIds.push(userId);
            entries.push({ rank: offset + index + 1, userId, totalScore: Number(scoreStr) });
          }
          // Resolve usernames from DB
          const usernameMap = await resolveUsernames(pool, userIds);
          const leaderboard = entries.map((e) => ({ ...e, username: usernameMap.get(e.userId) || e.userId }));
          return res.json({ leaderboard, pagination: { limit, offset } });
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Redis leaderboard read failed — falling back to DB');
    }

    // Fallback to Postgres — JOIN with users table for usernames
    if (!pool) throw new Error('Database not configured');
    const r = await pool.query(
      `SELECT ls.user_id, ls.total_score, u.username
       FROM leaderboard_score ls
       LEFT JOIN users u ON u.id = ls.user_id
       ORDER BY ls.total_score DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const leaderboard = r.rows.map((row: any, idx: number) => ({
      rank: offset + idx + 1,
      userId: String(row.user_id),
      username: row.username || String(row.user_id),
      totalScore: Number(row.total_score),
    }));
    res.json({ leaderboard, pagination: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /v1/leaderboard/streak
router.get('/streak', async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const redis = getRedis();
    const pool = getPool();

    try {
      if (redis) {
        const range = await redis.zrevrange('leaderboard:streak', offset, offset + limit - 1, 'WITHSCORES');
        if (Array.isArray(range) && range.length > 0) {
          const userIds: string[] = [];
          const entries: Array<{ rank: number; userId: string; maxStreak: number }> = [];
          for (let i = 0; i < range.length; i += 2) {
            const userId = range[i];
            const streakStr = range[i + 1];
            const index = i / 2;
            userIds.push(userId);
            entries.push({ rank: offset + index + 1, userId, maxStreak: Number(streakStr) });
          }
          // Resolve usernames from DB
          const usernameMap = await resolveUsernames(pool, userIds);
          const leaderboard = entries.map((e) => ({ ...e, username: usernameMap.get(e.userId) || e.userId }));
          return res.json({ leaderboard, pagination: { limit, offset } });
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Redis leaderboard (streak) read failed — falling back to DB');
    }

    // Fallback to Postgres — JOIN with users table for usernames
    if (!pool) throw new Error('Database not configured');
    const r = await pool.query(
      `SELECT ls.user_id, ls.max_streak, u.username
       FROM leaderboard_streak ls
       LEFT JOIN users u ON u.id = ls.user_id
       ORDER BY ls.max_streak DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const leaderboard = r.rows.map((row: any, idx: number) => ({
      rank: offset + idx + 1,
      userId: String(row.user_id),
      username: row.username || String(row.user_id),
      maxStreak: Number(row.max_streak),
    }));
    res.json({ leaderboard, pagination: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

/**
 * Periodic sync: rebuilds Redis leaderboards from DB every 5 minutes.
 */
export async function syncLeaderboardsFromDatabase(): Promise<void> {
  const pool = getPool();
  const redis = getRedis();
  if (!pool || !redis) return;

  try {
    // Sync score
    const scoreRows = await pool.query('SELECT user_id, total_score FROM leaderboard_score ORDER BY total_score DESC');
    const pipeline = redis.pipeline();
    pipeline.del('leaderboard:score');
    for (const row of scoreRows.rows) {
      pipeline.zadd('leaderboard:score', Number(row.total_score), String(row.user_id));
    }
    await pipeline.exec();

    // Sync streak
    const streakRows = await pool.query('SELECT user_id, max_streak FROM leaderboard_streak ORDER BY max_streak DESC');
    const pipeline2 = redis.pipeline();
    pipeline2.del('leaderboard:streak');
    for (const row of streakRows.rows) {
      pipeline2.zadd('leaderboard:streak', Number(row.max_streak), String(row.user_id));
    }
    await pipeline2.exec();

    logger.info('syncLeaderboardsFromDatabase completed');
  } catch (err) {
    logger.error({ err }, 'syncLeaderboardsFromDatabase failed');
  }
}

// Schedule periodic sync
try {
  setInterval(() => {
    syncLeaderboardsFromDatabase().catch((err) => logger.error({ err }, 'periodic sync failed'));
  }, SYNC_INTERVAL_MS).unref();
} catch (err) {
  logger.error({ err }, 'failed to schedule periodic leaderboard sync');
}

export default router;
