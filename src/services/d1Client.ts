import type { Env } from '../types';

export function recordEdgeAudit(
  env: Env,
  ctx: ExecutionContext,
  eventType: string,
  userId: string | null,
  ip: string | null,
  payload: Record<string, unknown> = {},
): void {
  if (!env.EXCHANGE_D1) return;
  ctx.waitUntil(
    env.EXCHANGE_D1.prepare(
      'INSERT INTO edge_audit_logs (id, event_type, user_id, ip_address, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        crypto.randomUUID(),
        eventType,
        userId,
        ip || 'unknown',
        JSON.stringify(payload),
        Date.now(),
      )
      .run()
      .catch((err) => console.error('[EdgeAudit] Failed to log:', err)),
  );
}

export async function checkEdgeRateLimit(
  env: Env,
  ip: string,
  maxAttempts = 20,
  windowSeconds = 60,
): Promise<boolean> {
  if (!env.EXCHANGE_D1 || !ip) return true;
  try {
    const key = `ratelimit:auth:${ip}`;
    const now = Date.now();
    const existing = await env.EXCHANGE_D1.prepare(
      'SELECT count, reset_at FROM edge_rate_limits WHERE key = ?',
    )
      .bind(key)
      .first<{ count: number; reset_at: number }>();

    if (!existing || existing.reset_at < now) {
      await env.EXCHANGE_D1.prepare(
        'INSERT OR REPLACE INTO edge_rate_limits (key, count, reset_at) VALUES (?, 1, ?)',
      )
        .bind(key, now + windowSeconds * 1000)
        .run();
      return true;
    }

    if (existing.count >= maxAttempts) {
      return false; // Rate limit reached
    }

    await env.EXCHANGE_D1.prepare('UPDATE edge_rate_limits SET count = count + 1 WHERE key = ?')
      .bind(key)
      .run();
    return true;
  } catch (err) {
    console.warn('[RateLimit] Error:', err);
    return true; // Fail open
  }
}

export function storeEdgeSession(
  env: Env,
  ctx: ExecutionContext,
  sessionTokenHash: string,
  userId: string,
  email: string,
  roles: string[],
  ttlMs = 86400 * 30 * 1000,
): void {
  if (!env.EXCHANGE_D1) return;
  ctx.waitUntil(
    env.EXCHANGE_D1.prepare(
      'INSERT OR REPLACE INTO edge_sessions (session_id, user_id, email, roles, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        sessionTokenHash,
        userId,
        email,
        JSON.stringify(roles),
        Date.now(),
        Date.now() + ttlMs,
      )
      .run()
      .catch((e) => console.error('[EdgeSession] Failed to write session:', e)),
  );
}

export function invalidateEdgeSession(
  env: Env,
  ctx: ExecutionContext,
  sessionTokenHash: string,
): void {
  if (!env.EXCHANGE_D1) return;
  ctx.waitUntil(
    env.EXCHANGE_D1.prepare('DELETE FROM edge_sessions WHERE session_id = ?')
      .bind(sessionTokenHash)
      .run()
      .catch(() => {}),
  );
}
