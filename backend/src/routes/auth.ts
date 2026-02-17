import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/pool';
import { env } from '../config/env';
import { BadRequest, Conflict, ApiError } from '../errors';

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) throw BadRequest('username, email and password are required');

    const pool = getPool();
    if (!pool) throw new ApiError(500, 'Database not configured', 'INTERNAL_ERROR');

    const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);

    try {
      const ins = await pool.query(
        `INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username`,
        [String(username), String(email).toLowerCase(), passwordHash]
      );
      const user = ins.rows[0];
      const secret: jwt.Secret = env.JWT_SECRET as jwt.Secret;
      const token = jwt.sign({ userId: user.id, username: user.username } as any, secret as any, { expiresIn: env.JWT_EXPIRES_IN } as any);
      return res.json({ userId: user.id, username: user.username, token });
    } catch (err: any) {
      if (err && err.code === '23505') {
        // Unique violation — determine which field
        const msg = String(err.detail || 'duplicate');
        if (msg.includes('email')) throw Conflict('email already in use');
        if (msg.includes('username')) throw Conflict('username already in use');
        throw Conflict('duplicate_user');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw BadRequest('email and password are required');

    const pool = getPool();
    if (!pool) throw new ApiError(500, 'Database not configured', 'INTERNAL_ERROR');

    const r = await pool.query('SELECT id, username, password_hash FROM users WHERE email = $1 LIMIT 1', [String(email).toLowerCase()]);
    if (r.rowCount === 0) throw new ApiError(401, 'Invalid credentials', 'UNAUTHORIZED');
    const row = r.rows[0];
    const ok = await bcrypt.compare(String(password), String(row.password_hash));
    if (!ok) throw new ApiError(401, 'Invalid credentials', 'UNAUTHORIZED');

    const secret: jwt.Secret = env.JWT_SECRET as jwt.Secret;
    const token = jwt.sign({ userId: row.id, username: row.username } as any, secret as any, { expiresIn: env.JWT_EXPIRES_IN } as any);
    return res.json({ userId: row.id, username: row.username, token });
  } catch (err) {
    next(err);
  }
});

export default router;
