/**
 * PostgreSQL connection pool (pg).
 * Used only when DATABASE_URL is set.
 */
import { Pool } from 'pg';
import { env } from '../config/env';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;
  if (!env.DATABASE_URL) return null;
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

