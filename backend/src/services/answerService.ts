import crypto from 'crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { getPool } from '../db/pool';
import { getRedis } from '../db/redis';
import { logger } from '../logger';
import { ApiError, BadRequest, Conflict, TooManyRequests } from '../errors';
import * as AE from '../core/adaptiveEngine';

const SubmitSchema = z.object({
  userId: z.string().uuid(),
  questionId: z.string().uuid(),
  userAnswer: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

type SubmitInput = z.infer<typeof SubmitSchema>;

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 30;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h

function requestHash(payload: object) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function submitAnswer(raw: unknown) {
  const payload = SubmitSchema.parse(raw);
  const { userId, questionId, userAnswer, idempotencyKey } = payload;
  const pool = getPool();
  if (!pool) throw new ApiError(500, 'Database not configured');

  const redis = getRedis();
  const nowMs = Date.now();
  const reqHash = requestHash({ userId, questionId, userAnswer });

  // 1) Fast-path idempotency cache (do not count against rate limit)
  try {
    if (redis) {
      const cached = await redis.get(`idem:${idempotencyKey}`);
      if (cached) {
        logger.info({ userId, idempotencyKey }, 'Idempotency cache hit');
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logger.warn({ err, userId }, 'Redis read for idempotency cache failed — continuing (fail-open)');
  }

  // 2) Rate limiting (token bucket via INCR)
  try {
    if (redis) {
      const key = `rl:answers:${userId}`;
      const cur = await redis.incr(key);
      if (cur === 1) {
        await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }
      if (cur > RATE_LIMIT_MAX) {
        logger.warn({ userId, cur }, 'Rate limit exceeded');
        throw TooManyRequests(`rate limit exceeded: max ${RATE_LIMIT_MAX} per ${RATE_LIMIT_WINDOW_SECONDS}s`);
      }
    } else {
      logger.warn('Redis unavailable for rate limiting — fail-open');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error({ err }, 'Unexpected error during rate limit check');
  }

  // 3) Begin DB transaction — optimistic locking enforced on user_state.state_version
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3a) Idempotency check at DB level
    const ansRes = await client.query(
      `SELECT id, idempotency_key, request_hash, is_correct, score_delta, answered_at
       FROM answer_log WHERE idempotency_key = $1 FOR SHARE`,
      [idempotencyKey]
    );

    if ((ansRes.rowCount ?? 0) > 0) {
      const row = ansRes.rows[0];
      if (row.request_hash !== reqHash) {
        await client.query('ROLLBACK');
        throw BadRequest('Idempotency key already used with different payload');
      }

      // Return previously computed result (idempotent)
      const userStateRes = await client.query(
        `SELECT * FROM user_state WHERE user_id = $1`,
        [userId]
      );
      await client.query('COMMIT');

      const cachedResult = {
        idempotent: true,
        answeredAt: row.answered_at,
        isCorrect: row.is_correct,
        scoreDelta: row.score_delta,
        userState: userStateRes.rows[0] || null,
      };

      // cache in Redis for quick future responses
      try {
        if (redis) await redis.set(`idem:${idempotencyKey}`, JSON.stringify(cachedResult), 'EX', IDEMPOTENCY_TTL_SECONDS);
      } catch (err) {
        logger.warn({ err, userId, idempotencyKey }, 'Failed to set idempotency cache (non-fatal)');
      }

      return cachedResult;
    }

    // 3b) Validate question correctness & difficulty
    const qRes = await client.query('SELECT correct_answer, difficulty_level FROM questions WHERE id = $1 AND is_active = TRUE', [questionId]);
    if (qRes.rowCount === 0) {
      await client.query('ROLLBACK');
      throw BadRequest('question not found or not active');
    }
    const storedAnswerRaw = String(qRes.rows[0].correct_answer).trim();
    const storedAnswer = storedAnswerRaw.toLowerCase();
    const difficultyLevel = Number(qRes.rows[0].difficulty_level);

    // Normalize and hash the user's answer the same way seeds are stored.
    const normalizedUser = String(userAnswer).trim().toLowerCase();
    const userHash = crypto.createHash('sha256').update(normalizedUser).digest('hex').toLowerCase();

    // If stored answer looks like a SHA-256 hex, compare hashes; otherwise fall back
    // to legacy plaintext (case-insensitive) comparison to remain tolerant.
    const isStoredHashed = /^[a-f0-9]{64}$/.test(storedAnswer);
    const isCorrect = isStoredHashed ? userHash === storedAnswer : normalizedUser === storedAnswer;

    // 3c) Read current user state
    const usRes = await client.query('SELECT * FROM user_state WHERE user_id = $1', [userId]);
    if (usRes.rowCount === 0) {
      await client.query('ROLLBACK');
      throw BadRequest('user_state not found for user');
    }
    const userStateRow = usRes.rows[0];

    // 3d) Question mismatch validation
    if (!userStateRow.last_question_id || userStateRow.last_question_id.toString() !== questionId) {
      await client.query('ROLLBACK');
      throw BadRequest('questionId does not match the last served question for this user');
    }

    // map DB row -> AE.UserState
    const currentState: AE.UserState = {
      currentDifficulty: Number(userStateRow.current_difficulty),
      streak: Number(userStateRow.current_streak),
      maxStreak: Number(userStateRow.max_streak),
      totalScore: Number(userStateRow.total_score),
      confidence: Number(userStateRow.confidence_score),
      performanceWindow: (userStateRow.performance_window as boolean[]) || [],
      correctAnswers: Number(userStateRow.correct_answers),
      totalAnswers: Number(userStateRow.questions_answered),
      lastAnswerAt: userStateRow.last_answered_at ? new Date(userStateRow.last_answered_at).getTime() : 0,
    };

    // 3e) Process answer (pure logic)
    const newState = AE.processAnswer(currentState, isCorrect, nowMs);

    // compute score delta
    const scoreDelta = newState.totalScore - currentState.totalScore;

    // 3f) Persist user_state using optimistic locking on state_version
    const updateRes = await client.query(
      `UPDATE user_state SET
         current_difficulty = $1,
         total_score = $2,
         current_streak = $3,
         max_streak = $4,
         questions_answered = questions_answered + 1,
         correct_answers = correct_answers + $5,
         state_version = state_version + 1,
         last_question_id = NULL,
         last_answered_at = to_timestamp($6 / 1000.0),
         confidence_score = $7,
         performance_window = $8
       WHERE user_id = $9 AND state_version = $10
       RETURNING state_version, total_score`,
      [
        newState.currentDifficulty,
        newState.totalScore,
        newState.streak,
        newState.maxStreak,
        isCorrect ? 1 : 0,
        nowMs,
        newState.confidence,
        JSON.stringify(newState.performanceWindow),
        userId,
        Number(userStateRow.state_version),
      ]
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      throw Conflict('state_version mismatch — concurrent modification detected; please retry');
    }

    // 3g) Insert answer_log (idempotency recorded at DB-level)
    try {
      await client.query(
        `INSERT INTO answer_log
           (user_id, question_id, user_answer, is_correct, difficulty_level, score_delta, streak_at_answer, idempotency_key, request_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          userId,
          questionId,
          userAnswer,
          isCorrect,
          difficultyLevel,
          scoreDelta,
          isCorrect ? currentState.streak : 0,
          idempotencyKey,
          reqHash,
        ]
      );
    } catch (err: any) {
      // Unique constraint on idempotency_key should be captured here (race)
      if (err && err.code === '23505') {
        await client.query('ROLLBACK');
        throw Conflict('Idempotency key already used');
      }
      throw err;
    }

    // 3h) Upsert leaderboard_score (DB source-of-truth)
    await client.query(
      `INSERT INTO leaderboard_score (user_id, total_score, last_updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET total_score = EXCLUDED.total_score, last_updated_at = NOW()`,
      [userId, newState.totalScore]
    );

    await client.query('COMMIT');

    // 4) Post-commit: update Redis leaderboard and cache idempotency result
    const result = {
      idempotent: false,
      answeredAt: new Date(nowMs).toISOString(),
      isCorrect,
      scoreDelta,
      userState: {
        currentDifficulty: newState.currentDifficulty,
        streak: newState.streak,
        maxStreak: newState.maxStreak,
        totalScore: newState.totalScore,
        confidence: newState.confidence,
        performanceWindow: newState.performanceWindow,
        correctAnswers: newState.correctAnswers,
        totalAnswers: newState.totalAnswers,
        lastAnswerAt: newState.lastAnswerAt,
        stateVersion: updateRes.rows[0].state_version,
      },
    } as const;

    // cache idempotency response in Redis
    try {
      if (redis) await redis.set(`idem:${idempotencyKey}`, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err, userId, idempotencyKey }, 'Failed to cache idempotency result in Redis (non-fatal)');
    }

    // update Redis leaderboard ZSET (best-effort)
    try {
      if (redis) {
        // zadd(key, score, member) — keep types simple and compatible
        await redis.zadd('leaderboard:score', newState.totalScore, userId);
      }
    } catch (err) {
      logger.error({ err, userId, totalScore: newState.totalScore }, 'Redis leaderboard update failed after DB commit — DB is source of truth. scheduling reconciliation');
      // enqueue a lightweight reconciliation job (best-effort)
      try {
        if (redis) {
          const job = JSON.stringify({ type: 'leaderboard_update', userId, totalScore: newState.totalScore, ts: Date.now() });
          await redis.lpush('reconcile:jobs', job);
          await redis.expire('reconcile:jobs', 60 * 60 * 24); // keep 24h
        }
      } catch (e) {
        logger.warn({ e }, 'failed to enqueue reconciliation job');
      }
    }

    // 5) Compute rank (prefer Redis, fallback to DB)
    let rank: number | null = null;
    try {
      if (redis) {
        const r = await redis.zrevrank('leaderboard:score', userId);
        if (r !== null) rank = r + 1; // zero-based -> 1-based
      }
    } catch (err) {
      logger.warn({ err }, 'Redis rank read failed — falling back to DB');
    }

    if (rank === null) {
      const rdb = await client.query('SELECT COUNT(1) AS higher FROM leaderboard_score WHERE total_score > $1', [newState.totalScore]);
      rank = Number(rdb.rows[0].higher) + 1;
    }

    return { ...result, rank };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}
