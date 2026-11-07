import { Client } from 'pg';
import type { Env } from '../types';
import { normalizeDatabaseError } from '../utils/errors';

export async function withDb<T>(env: Env, ctx: ExecutionContext, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('Hyperdrive connection string is not available.');
  }
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await fn(client);
  } catch (err: any) {
    throw normalizeDatabaseError(err);
  } finally {
    ctx.waitUntil(client.end());
  }
}

export async function withTx<T>(env: Env, ctx: ExecutionContext, fn: (client: Client) => Promise<T>): Promise<T> {
  return withDb(env, ctx, async (client) => {
    await client.query('BEGIN');
    try {
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

// Roles are read from the database on every check: JWTs carry no role claim, and a revoked role must stop working immediately.
export async function isAdmin(client: Client, userId: string): Promise<boolean> {
  const res = await client.query(`SELECT 1 FROM user_roles WHERE user_id::text = $1 AND role_name = 'admin' LIMIT 1`, [userId]);
  return (res.rowCount ?? 0) > 0;
}
