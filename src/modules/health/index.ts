import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';

export async function handleHealthRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (path !== '/health' && path !== '/health/ready') {
    return null;
  }

  let dbStatus = 'disconnected';
  let dbLatencyMs = 0;
  let migrationsApplied = 0;

  if (env.HYPERDRIVE?.connectionString) {
    try {
      const start = Date.now();
      await withDb(env, ctx, async (client) => {
        const res = await client.query('SELECT count(*)::int AS applied FROM public.schema_migrations');
        migrationsApplied = res.rows[0]?.applied ?? 0;
        dbStatus = 'connected';
      });
      dbLatencyMs = Date.now() - start;
    } catch (err) {
      console.error('[Health] DB probe error:', err);
      dbStatus = 'error';
    }
  }

  let d1Status = 'disconnected';
  let d1LatencyMs = 0;
  let d1Sessions = 0;
  if (env.EXCHANGE_D1) {
    try {
      const start = Date.now();
      const d1Res = await env.EXCHANGE_D1.prepare('SELECT count(*) AS total FROM edge_sessions').first<{ total: number }>();
      d1Sessions = d1Res?.total ?? 0;
      d1LatencyMs = Date.now() - start;
      d1Status = 'connected';
    } catch (err) {
      console.error('[Health] D1 probe error:', err);
      d1Status = 'error';
    }
  }

  let kvStatus = 'disconnected';
  if (env.EXCHANGE_KV) {
    try {
      await env.EXCHANGE_KV.get('health_probe');
      kvStatus = 'connected';
    } catch (err) {
      console.error('[Health] KV probe error:', err);
      kvStatus = 'error';
    }
  }

  return jsonResponse(
    {
      data: {
        status: 'ok',
        service: 'exchnage-worker-api',
        platform: env.PLATFORM_NAME || 'Exchnage',
        currency: env.PLATFORM_CURRENCY || 'INR',
        timezone: env.PLATFORM_TIMEZONE || 'Asia/Kolkata',
        database: dbStatus,
        databaseLatencyMs: dbLatencyMs,
        migrationsApplied,
        edgeD1: d1Status,
        edgeD1LatencyMs: d1LatencyMs,
        edgeD1Sessions: d1Sessions,
        edgeKV: kvStatus,
        edgeQueue: env.EVENT_QUEUE ? 'connected' : 'unbound',
        edgeDurableObjects: env.INVENTORY_LOCK ? 'connected' : 'unbound',
        edgeWorkflows: env.RENTAL_WORKFLOW ? 'connected' : 'unbound',
        edgeR2: (env.EXCHANGE_R2 || env.UPLOADS_BUCKET) ? 'connected' : 'ready (awaiting dashboard bucket activation)',
        edgeTurnstile: (env.TURNSTILE_SECRET || env.TURNSTILE_SITEKEY) ? 'active' : 'unconfigured',
        timestamp: new Date().toISOString(),
      },
    },
    200,
    cors,
  );
}
