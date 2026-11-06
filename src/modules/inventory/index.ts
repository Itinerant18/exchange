import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { extractBearerUser } from '../../middleware/auth';

export async function handleInventoryRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = env.AUTH_JWT_SECRET || 'exchnage_default_production_jwt_secret_min32';

  // 1. Inventory Items list
  if (path === '/inventory/items' && method === 'GET') {
    const listingId = url.searchParams.get('listingId');
    try {
      const items = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT id, listing_id AS "listingId", condition, operational_status AS "operationalStatus",
                 serial_or_sku AS "serialOrSku", created_at AS "createdAt"
          FROM inventory_items
        `;
        const params: any[] = [];
        if (listingId) {
          sql += ` WHERE listing_id::text = $1`;
          params.push(listingId);
        }
        sql += ` ORDER BY created_at DESC LIMIT 50`;
        const res = await client.query(sql, params);
        return res.rows;
      });
      return jsonResponse({ data: items }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 2. Inventory Item DO Locks (/inventory/items/:id/lock and /unlock)
  if (path.match(/^\/inventory\/items\/[^/]+\/lock$/) && method === 'POST') {
    const unitId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const body = (await request.json().catch(() => ({}))) as any;
    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return jsonResponse({ error: { message: 'startDate and endDate required', code: 'INVALID_INPUT' } }, 400, cors);
    }

    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ error: { message: 'Durable Object lock unavailable', code: 'UNAVAILABLE' } }, 503, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub: any = env.INVENTORY_LOCK.get(doId);
    const lockResult = await stub.acquireHold(auth.userId, startDate, endDate);

    if (!lockResult.success) {
      return jsonResponse({ error: { message: lockResult.reason, code: 'UNIT_LOCKED' } }, 409, cors);
    }

    return jsonResponse({ data: { unitId, ...lockResult } }, 200, cors);
  }

  if (path.match(/^\/inventory\/items\/[^/]+\/unlock$/) && method === 'POST') {
    const unitId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ data: { released: true } }, 200, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub: any = env.INVENTORY_LOCK.get(doId);
    await stub.releaseHold(auth.userId);

    return jsonResponse({ data: { unitId, released: true } }, 200, cors);
  }

  if (path.match(/^\/inventory\/items\/[^/]+\/lock$/) && method === 'GET') {
    const unitId = path.split('/')[3];
    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ data: { isHeld: false } }, 200, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub: any = env.INVENTORY_LOCK.get(doId);
    const status = (await stub.getHoldStatus()) as { isHeld: boolean; hold?: any };

    return jsonResponse({ data: { unitId, ...status } }, 200, cors);
  }

  return null;
}
