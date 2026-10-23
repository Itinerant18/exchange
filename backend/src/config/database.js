import pg from 'pg';
import { env } from './env.js';

// DATE columns stay plain "YYYY-MM-DD" strings: rental periods are calendar
// dates and all comparisons in the service layer are string-based half-open
// checks. Without this, node-postgres would parse DATE to a JS Date pinned to
// local midnight, breaking cross-timezone comparisons and JSON output.
pg.types.setTypeParser(1082, (value) => value);
// TIMESTAMP WITHOUT TIME ZONE never exists in this schema except in system
// columns, but interpret it as UTC rather than server-local if it appears.
pg.types.setTypeParser(1114, (value) => new Date(`${value}Z`));

const { Pool } = pg;

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: env.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: env.db.connectionTimeoutMs,
  ssl: env.db.ssl ? { rejectUnauthorized: true } : false,
  application_name: 'exchnage-api',
});

pool.on('error', (error) => {
  // An idle client failed. The pool discards it; log without exposing secrets.
  console.error('[database] Unexpected idle client error:', error.message);
});

export async function checkDatabaseConnection() {
  const startedAt = process.hrtime.bigint();
  const result = await pool.query('SELECT 1 AS ok');
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  return {
    ok: result.rows[0]?.ok === 1,
    latencyMs: Number(elapsedMs.toFixed(1)),
  };
}

export async function closeDatabasePool() {
  await pool.end();
}

/**
 * Runs `work(client)` inside a single database transaction. Rolls back and
 * rethrows on any error; always releases the client.
 */
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
