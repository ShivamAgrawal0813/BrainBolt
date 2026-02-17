/**
 * Environment configuration for BrainBolt backend.
 * Strict validation of critical variables like JWT_SECRET.
 * Enforces JWT_SECRET in all environments (development, test, production).
 */
import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = typeof process.env.PORT !== 'undefined'
  ? Number(process.env.PORT)
  : 3001;

// Validate and extract JWT_SECRET (required in all environments)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  throw new Error(
    'JWT_SECRET environment variable is required and must not be empty. ' +
    'Set JWT_SECRET in your .env file or environment before starting the server.'
  );
}

export const env = {
  NODE_ENV,
  PORT: Number.isInteger(PORT) && PORT > 0 ? PORT : 3001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://brainbolt:brainbolt@localhost:5432/brainbolt',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: JWT_SECRET as string, // guaranteed non-empty by validation above
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;

// Optional: warn in development environments
if (NODE_ENV === 'development') {
  const msg = JWT_SECRET.length < 32
    ? 'WARNING: JWT_SECRET is less than 32 characters. Use a longer, cryptographically secure secret in production.'
    : undefined;
  if (msg) console.warn(msg);
}

export type Env = typeof env;
