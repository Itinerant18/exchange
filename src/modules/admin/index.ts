import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { extractBearerUser } from '../../middleware/auth';

export async function handleAdminRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  if (!path.startsWith('/admin')) {
    return null;
  }

  const auth = extractBearerUser(request, jwtSecret);
  if (!auth) {
    return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
  }

  // Admin audit logs from D1 edge_audit_logs
  if (path === '/admin/audit-logs' && method === 'GET') {
    if (!env.EXCHANGE_D1) {
      return jsonResponse({ data: [], message: 'Edge audit database not connected' }, 200, cors);
    }
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    try {
      const logs = await env.EXCHANGE_D1.prepare(
        'SELECT id, event_type AS "eventType", user_id AS "userId", ip_address AS "ipAddress", payload, created_at AS "createdAt" FROM edge_audit_logs ORDER BY created_at DESC LIMIT ?',
      )
        .bind(limit)
        .all();
      return jsonResponse({ data: logs.results }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // Admin platform metrics
  if (path === '/admin/metrics' && method === 'GET') {
    try {
      const metrics = await withDb(env, ctx, async (client) => {
        const usersCount = await client.query('SELECT count(*)::int AS count FROM users');
        const listingsCount = await client.query('SELECT count(*)::int AS count FROM listings WHERE listing_status = \'active\'');
        const bookingsCount = await client.query('SELECT count(*)::int AS count FROM rental_bookings');
        const ordersCount = await client.query('SELECT count(*)::int AS count FROM orders');

        return {
          totalUsers: usersCount.rows[0]?.count ?? 0,
          activeListings: listingsCount.rows[0]?.count ?? 0,
          totalBookings: bookingsCount.rows[0]?.count ?? 0,
          totalOrders: ordersCount.rows[0]?.count ?? 0,
        };
      });

      return jsonResponse({ data: metrics }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  return null;
}

