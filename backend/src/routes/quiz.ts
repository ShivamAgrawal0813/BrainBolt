import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPool } from '../db/pool';
import { getRedis } from '../db/redis';
import { logger } from '../logger';
import { BadRequest, Conflict, TooManyRequests, ApiError } from '../errors';
import * as AE from '../core/adaptiveEngine';

const router = express.Router();

const USER_STATE_TTL = 1800; // seconds
const IDEMPOTENCY_TTL = 86400; // seconds
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 30; // per minute

function requestHash(payload: object) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeAnswer(a: unknown) {
  return String(a ?? '').trim().toLowerCase();
}

// Helper: map DB user_state row -> AE.UserState-like object
function mapDbRowToState(row: any): AE.UserState & { stateVersion: number; lastQuestionId?: string | null } {
  return {
    currentDifficulty: Number(row.current_difficulty),
    streak: Number(row.current_streak),
    maxStreak: Number(row.max_streak),
    totalScore: Number(row.total_score),
    confidence: Number(row.confidence_score ?? 0),
    performanceWindow: (row.performance_window as boolean[]) || [],
    correctAnswers: Number(row.correct_answers ?? 0),
    totalAnswers: Number(row.questions_answered ?? 0),
    lastAnswerAt: row.last_answered_at ? new Date(row.last_answered_at).getTime() : 0,
    stateVersion: Number(row.state_version ?? 1),
    lastQuestionId: row.last_question_id ? String(row.last_question_id) : null,
  } as any;
}

// GET /v1/quiz/next
router.get('/next', async (req, res, next) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
    const userId = String(user.id);

    const redis = getRedis();
    const pool = getPool();
    if (!pool) throw new ApiError(500, 'Database not configured', 'INTERNAL_ERROR');

    const userKey = `user:${userId}:state`;

    // 2) Load user_state from Redis first
    let stateRow: any = null;
    try {
      if (redis) {
        const s = await redis.get(userKey);
        if (s) {
          stateRow = JSON.parse(s);
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'redis read failed for user state (continuing with DB)');
    }

    // 3) Fallback to Postgres
    if (!stateRow) {
      const r = await pool.query('SELECT * FROM user_state WHERE user_id = $1', [userId]);
      if (r.rowCount === 0) {
        // insert default state
        const ins = await pool.query(
          `INSERT INTO user_state (user_id, current_difficulty, total_score, current_streak, max_streak, questions_answered, correct_answers, state_version, performance_window)
           VALUES ($1,5,0,0,0,0,0,1,'[]') RETURNING *`,
          [userId]
        );
        stateRow = mapDbRowToState(ins.rows[0]);
      } else {
        stateRow = mapDbRowToState(r.rows[0]);
      }
      // cache in redis
      try {
        if (redis) await redis.set(userKey, JSON.stringify(stateRow), 'EX', USER_STATE_TTL);
      } catch (err) {
        logger.warn({ err, userId }, 'failed to cache user state (non-fatal)');
      }
    }

    const currentDifficulty = stateRow.currentDifficulty;

    // 4) Fetch one random active question matching difficulty
    const qRes = await pool.query(
      'SELECT id, question_text FROM questions WHERE difficulty_level = $1 AND is_active = TRUE ORDER BY random() LIMIT 1',
      [currentDifficulty]
    );
    if (qRes.rowCount === 0) throw new ApiError(500, 'no_question_available', 'INTERNAL_ERROR');
    const q = qRes.rows[0];

    // Update user's last_question_id. DO NOT change state_version here —
    // state_version MUST only change when the user answers (optimistic locking).
    const upd = await pool.query(
      `UPDATE user_state SET last_question_id = $1 WHERE user_id = $2 RETURNING state_version, total_score, current_streak, current_difficulty`,
      [q.id, userId]
    );
    if (upd.rowCount === 0) throw new ApiError(500, 'failed_to_update_state', 'INTERNAL_ERROR');

    const returnedState = {
      stateVersion: Number(upd.rows[0].state_version),
      currentScore: Number(upd.rows[0].total_score),
      currentStreak: Number(upd.rows[0].current_streak),
      currentDifficulty: Number(upd.rows[0].current_difficulty),
    };

    // Refresh Redis cache with updated state (read full row to keep fields consistent)
    try {
      const fresh = await pool.query('SELECT * FROM user_state WHERE user_id = $1', [userId]);
      if (fresh.rowCount === 1 && redis) {
        await redis.set(userKey, JSON.stringify(mapDbRowToState(fresh.rows[0])), 'EX', USER_STATE_TTL);
      }
    } catch (err) {
      logger.warn({ err, userId }, 'failed to refresh user state cache after serving question');
    }

    // sessionId per request
    const sessionId = uuidv4();

    return res.json({
      questionId: q.id,
      difficulty: currentDifficulty,
      prompt: q.question_text,
      choices: [],
      sessionId,
      stateVersion: returnedState.stateVersion,
      currentScore: returnedState.currentScore,
      currentStreak: returnedState.currentStreak,
    });
  } catch (err) {
    next(err);
  }
});

// POST /v1/quiz/answer
router.post('/answer', async (req, res, next) => {
  let client: any = null;
  let updatedStateVersion: number | null = null;
  try {
    const user = (req as any).user;
    if (!user || !user.id) throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
    const userId = String(user.id);

    const { questionId, userAnswer, stateVersion } = req.body || {};
    if (!questionId || typeof userAnswer === 'undefined' || typeof stateVersion === 'undefined') {
      throw BadRequest('questionId, userAnswer and stateVersion are required');
    }

    const pool = getPool();
    if (!pool) throw new ApiError(500, 'Database not configured', 'INTERNAL_ERROR');
    const redis = getRedis();

    // 1️⃣ Rate Limit
    try {
      if (redis) {
        const rlKey = `ratelimit:answer:${userId}`;
        const cur = await redis.incr(rlKey);
        if (cur === 1) await redis.expire(rlKey, RATE_LIMIT_WINDOW);
        if (cur > RATE_LIMIT_MAX) throw TooManyRequests('rate limit exceeded');
      }
    } catch (err) {
      // If Redis is unavailable, rate limiting degrades gracefully.
      // This preserves availability but may allow temporary bursts.
      if (err instanceof ApiError) throw err;
      logger.warn({ err, userId }, 'rate limit check failed (allowing request)');
    }

    // 2️⃣ Idempotency check
    const idemKeyHeader = req.header('Idempotency-Key');
    if (!idemKeyHeader) throw BadRequest('Missing Idempotency-Key header');
    const idemRedisKey = `idempotency:${idemKeyHeader}`;
    try {
      if (redis) {
        const cached = await redis.get(idemRedisKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'redis idempotency read failed (continuing)');
    }

    // 3️⃣ Load user state (Redis first)
    const userKey = `user:${userId}:state`;
    let userStateRow: any = null;
    try {
      if (redis) {
        const s = await redis.get(userKey);
        if (s) userStateRow = s && JSON.parse(s);
      }
    } catch (err) {
      logger.warn({ err, userId }, 'redis read failed for user state (falling back to DB)');
    }

    if (!userStateRow) {
      const r = await pool.query('SELECT * FROM user_state WHERE user_id = $1', [userId]);
      if (r.rowCount === 0) {
        // create default state if missing
        const ins = await pool.query(
          `INSERT INTO user_state (user_id, current_difficulty, total_score, current_streak, max_streak, questions_answered, correct_answers, state_version, performance_window)
           VALUES ($1,5,0,0,0,0,0,1,'[]') RETURNING *`,
          [userId]
        );
        userStateRow = mapDbRowToState(ins.rows[0]);
      } else {
        userStateRow = mapDbRowToState(r.rows[0]);
      }
    }

    // 4️⃣ Optimistic Lock (stateVersion must match)
    const providedVersion = Number(stateVersion);
    if (providedVersion !== Number(userStateRow.stateVersion)) {
      throw Conflict('state_version mismatch', { expected: userStateRow.stateVersion, provided: providedVersion });
    }

    // 5️⃣ Validate Question and answer correctness
    const qRes = await pool.query('SELECT id, difficulty_level, correct_answer FROM questions WHERE id = $1 AND is_active = TRUE', [questionId]);
    if (qRes.rowCount === 0) throw BadRequest('question not found or inactive');
    const qRow = qRes.rows[0];

    // ensure the question being answered matches the last served question for this user
    // Redis is a cache — if it does not match, validate against the DB (source of truth)
    if (userStateRow.lastQuestionId && userStateRow.lastQuestionId === questionId) {
      // Redis confirms lastQuestionId — proceed
    } else {
      // Redis missing or mismatch; double-check Postgres
      const confirm = await pool.query('SELECT last_question_id FROM user_state WHERE user_id = $1', [userId]);
      if (confirm.rowCount === 0 || !confirm.rows[0].last_question_id || String(confirm.rows[0].last_question_id) !== questionId) {
        throw BadRequest('questionId does not match last served question for user');
      }
      // DB confirms last_question_id matches — continue (Redis was stale)
    }

    const storedAnswerRaw = String(qRow.correct_answer ?? '').trim();
    const isStoredHashed = /^[a-f0-9]{64}$/.test(storedAnswerRaw.toLowerCase());
    const normalizedUser = normalizeAnswer(userAnswer);
    const userHash = crypto.createHash('sha256').update(normalizedUser).digest('hex').toLowerCase();
    const isCorrect = isStoredHashed ? userHash === storedAnswerRaw.toLowerCase() : normalizedUser === storedAnswerRaw.toLowerCase();

    // 6️⃣ Call Adaptive Engine
    const nowMs = Date.now();
    const aeInput: AE.UserState = {
      currentDifficulty: userStateRow.currentDifficulty,
      streak: userStateRow.streak,
      maxStreak: userStateRow.maxStreak,
      totalScore: userStateRow.totalScore,
      confidence: userStateRow.confidence,
      performanceWindow: userStateRow.performanceWindow || [],
      correctAnswers: userStateRow.correctAnswers || 0,
      totalAnswers: userStateRow.totalAnswers || 0,
      lastAnswerAt: userStateRow.lastAnswerAt || 0,
    };

    const newState = AE.processAnswer(aeInput, isCorrect, nowMs);

    // compute scoreDelta (difference between clamped totals)
    const scoreDelta = newState.totalScore - aeInput.totalScore;

    // 7️⃣ Begin Postgres Transaction
    client = await pool.connect();
    try {
      await client.query('BEGIN');

      const reqHash = requestHash({ userId, questionId, userAnswer });

      // a) INSERT into answer_log
      try {
        await client.query(
          `INSERT INTO answer_log (user_id, question_id, user_answer, is_correct, difficulty_level, score_delta, streak_at_answer, idempotency_key, request_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            userId,
            questionId,
            String(userAnswer),
            isCorrect,
            Number(qRow.difficulty_level),
            scoreDelta,
            isCorrect ? Math.max(0, aeInput.streak) : 0,
            idemKeyHeader,
            reqHash,
          ]
        );
      } catch (err: any) {
        // handle unique-violation on idempotency_key (Postgres 23505)
        if (err && err.code === '23505') {
          try {
            await client.query('ROLLBACK');
          } catch (_) {}

          // try to return previously cached idempotent response
          try {
            if (redis) {
              const cached = await redis.get(idemRedisKey);
              if (cached) {
                try {
                  await client.release();
                } catch (_) {}
                client = null;
                return res.json(JSON.parse(cached));
              }
            }
          } catch (redisErr) {
            logger.warn({ redisErr, userId }, 'failed to read idempotency cache after unique violation');
          }

          throw Conflict('Duplicate submission detected');
        }
        throw err;
      }

      // b) UPDATE user_state (clear last_question_id)
      const updateRes = await client.query(
        `UPDATE user_state SET
           current_difficulty = $1,
           total_score = $2,
           current_streak = $3,
           max_streak = $4,
           questions_answered = $5,
           correct_answers = $6,
           state_version = state_version + 1,
           last_question_id = $7,
           last_answered_at = NOW(),
           confidence_score = $8,
           performance_window = $9
         WHERE user_id = $10 AND state_version = $11
         RETURNING state_version, total_score, current_streak, max_streak` ,
        [
          newState.currentDifficulty,
          newState.totalScore,
          newState.streak,
          newState.maxStreak,
          newState.totalAnswers,
          newState.correctAnswers,
          null, // clear last_question_id
          newState.confidence,
          JSON.stringify(newState.performanceWindow),
          userId,
          providedVersion,
        ]
      );

      if (updateRes.rowCount === 0) {
        await client.query('ROLLBACK');
        throw Conflict('STATE_CONFLICT');
      }
      // capture updated state_version to return without an extra DB roundtrip
      updatedStateVersion = Number(updateRes.rows[0].state_version);

      // c) UPSERT leaderboard_score
      await client.query(
        `INSERT INTO leaderboard_score (user_id, total_score, last_updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET total_score = EXCLUDED.total_score, last_updated_at = NOW()` ,
        [userId, newState.totalScore]
      );

      // d) UPSERT leaderboard_streak
      await client.query(
        `INSERT INTO leaderboard_streak (user_id, max_streak, last_updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET max_streak = EXCLUDED.max_streak, last_updated_at = NOW()` ,
        [userId, newState.maxStreak]
      );

      await client.query('COMMIT');

    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
      client = null;
    }

    // 8️⃣ Update Redis AFTER successful commit
    try {
      if (redis) {
        // refresh user state cache
        const freshDb = await getPool()!.query('SELECT * FROM user_state WHERE user_id = $1', [userId]);
        if (freshDb.rowCount === 1) {
          await redis.set(userKey, JSON.stringify(mapDbRowToState(freshDb.rows[0])), 'EX', USER_STATE_TTL);
        }

        // update leaderboards
        await redis.zadd('leaderboard:score', newState.totalScore, userId);
        await redis.zadd('leaderboard:streak', newState.maxStreak, userId);
      }
    } catch (err) {
      logger.error({ err, userId }, 'redis update failed after DB commit — scheduling reconciliation');
      try {
        if (redis) {
          const job = JSON.stringify({ type: 'leaderboard_update', userId, totalScore: newState.totalScore, maxStreak: newState.maxStreak, ts: Date.now() });
          await redis.lpush('reconcile:jobs', job);
          await redis.expire('reconcile:jobs', 60 * 60 * 24);
        }
      } catch (e) {
        logger.warn({ e }, 'failed to enqueue reconciliation job');
      }
    }

    // 9️⃣ Fetch Rank
    let scoreRank: number | null = null;
    let streakRank: number | null = null;
    try {
      if (redis) {
        const sr = await redis.zrevrank('leaderboard:score', userId);
        const str = await redis.zrevrank('leaderboard:streak', userId);
        if (sr !== null) scoreRank = sr + 1;
        if (str !== null) streakRank = str + 1;
      }
    } catch (err) {
      logger.warn({ err }, 'failed to read ranks from redis — falling back to DB');
    }

    if (scoreRank === null) {
      const r = await getPool()!.query('SELECT COUNT(1) AS higher FROM leaderboard_score WHERE total_score > $1', [newState.totalScore]);
      scoreRank = Number(r.rows[0].higher) + 1;
    }
    if (streakRank === null) {
      const r = await getPool()!.query('SELECT COUNT(1) AS higher FROM leaderboard_streak WHERE max_streak > $1', [newState.maxStreak]);
      streakRank = Number(r.rows[0].higher) + 1;
    }

    const response = {
      correct: !!isCorrect,
      newDifficulty: newState.currentDifficulty,
      newStreak: newState.streak,
      scoreDelta: scoreDelta,
      totalScore: newState.totalScore,
      stateVersion: updatedStateVersion ?? userStateRow.stateVersion,
      leaderboardRankScore: scoreRank,
      leaderboardRankStreak: streakRank,
    };

    // 🔟 Store Idempotency Result
    try {
      if (redis) await redis.set(idemRedisKey, JSON.stringify(response), 'EX', IDEMPOTENCY_TTL);
    } catch (err) {
      logger.warn({ err, userId }, 'failed to cache idempotency result (non-fatal)');
    }

    return res.json(response);
  } catch (err) {
    next(err);
  } finally {
    if (client) {
      try { client.release(); } catch (_) {}
    }
  }
});

export default router;
