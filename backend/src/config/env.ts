/**
 * Environment configuration for BrainBolt backend.
 * Reads DATABASE_URL, REDIS_URL, PORT (default 3001).
 */
import dotenv from 'dotenv';

dotenv.config();

const PORT = typeof process.env.PORT !== 'undefined'
  ? Number(process.env.PORT)
  : 3001;

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.isInteger(PORT) && PORT > 0 ? PORT : 3001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://brainbolt:brainbolt@localhost:5432/brainbolt',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
} as const;
