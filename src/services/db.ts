import { Client } from 'pg';
import type { Env } from '../types';

export async function withDb<T>(env: Env, ctx: ExecutionContext, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('Hyperdrive connection string is not available.');
  }
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    ctx.waitUntil(client.end());
  }
}

