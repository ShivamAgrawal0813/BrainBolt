import crypto from 'crypto';
import { getPool, closePool } from './pool';
import { logger } from '../logger';

function hashAnswer(a: string): string {
  return crypto.createHash('sha256').update(String(a).trim().toLowerCase()).digest('hex').toLowerCase();
}

function makeQuestionFor(difficulty: number, idx: number) {
  // deterministic numbers based on difficulty + index
  const a = difficulty * 3 + idx;
  const b = difficulty * 2 + idx * 2;
  let questionText = '';
  let answer: string | number = 0;
  let category = 'math';

  if (difficulty <= 3) {
    // simple add/subtract
    if (idx % 2 === 0) {
      questionText = `What is ${a} + ${b}?`;
      answer = a + b;
    } else {
      questionText = `What is ${a + 5} - ${Math.max(1, b % (a + 5))}?`;
      answer = (a + 5) - (b % (a + 5));
    }
  } else if (difficulty <= 6) {
    // multiply small numbers
    questionText = `What is ${a} * ${Math.max(1, (b % 9) + 1)}?`;
    answer = a * Math.max(1, (b % 9) + 1);
  } else if (difficulty <= 9) {
    // larger multiplication
    questionText = `What is ${a + 2} * ${b + 1}?`;
    answer = (a + 2) * (b + 1);
  } else {
    // difficulty 10: combined operation
    questionText = `What is (${a} * ${b}) + ${idx}?`;
    answer = a * b + idx;
  }

  const explanation = `Computed deterministically for difficulty ${difficulty}`;
  const tags = ['seeded', 'math', `d${difficulty}`];

  return {
    questionText,
    answer: String(answer),
    difficulty,
    category,
    tags,
    explanation,
  };
}

export async function seedQuestions(): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL not configured');

  let inserted = 0;
  let skipped = 0;

  for (let d = 1; d <= 10; d++) {
    for (let i = 1; i <= 10; i++) {
      const q = makeQuestionFor(d, i);
      const hashed = hashAnswer(q.answer);

      const sql = `
        INSERT INTO questions (question_text, correct_answer, difficulty_level, category, tags, explanation)
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (SELECT 1 FROM questions WHERE question_text = $1)
      `;

      const res = await pool.query(sql, [q.questionText, hashed, q.difficulty, q.category, q.tags, q.explanation]);
      if (res.rowCount && res.rowCount > 0) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }
  }

  logger.info({ inserted, skipped }, `seedQuestions completed: inserted=${inserted} skipped=${skipped}`);
}

// Allow running via `ts-node src/db/seed.ts` or via SEED env on startup
if (require.main === module) {
  (async () => {
    try {
      await seedQuestions();
      logger.info('seeding finished');
      await closePool();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'seeding failed');
      try {
        await closePool();
      } catch (_e) {
        // noop
      }
      process.exit(1);
    }
  })();
}
