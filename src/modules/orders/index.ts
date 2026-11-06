import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse, emitQueueEvent } from '../../types';
import { withDb } from '../../services/db';
import { recordEdgeAudit } from '../../services/d1Client';
import { extractBearerUser } from '../../middleware/auth';

export async function handleOrdersRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  // 1. Sales Orders - Creation (Pre-loved Resale Purchases)
  if (path === '/orders' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const body = (await request.json()) as any;
      const { listingId } = body;
      if (!listingId) {
        return jsonResponse({ error: { message: 'listingId is required', code: 'INVALID_INPUT' } }, 400, cors);
      }

      const orderResult = await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        try {
          const listingRes = await client.query(
            `SELECT id, is_sale, sale_price_paise, listing_status, owner_user_id
             FROM listings WHERE id::text = $1 FOR SHARE`,
            [listingId],
          );
          const listing = listingRes.rows[0];
          if (!listing || listing.listing_status !== 'active' || !listing.is_sale) {
            throw new Error('Listing is not available for sale');
          }

          if (listing.owner_user_id === auth.userId) {
            throw new Error('You cannot buy your own listing');
          }

          // Allocate physical unit
          const unitRes = await client.query(
            `SELECT inv.id FROM inventory_items inv
             WHERE inv.listing_id = $1 AND inv.operational_status = 'AVAILABLE'
               AND NOT EXISTS (
                 SELECT 1 FROM order_items oi WHERE oi.inventory_item_id = inv.id AND oi.status IN ('pending', 'paid')
               )
             LIMIT 1 FOR UPDATE OF inv SKIP LOCKED`,
            [listing.id],
          );

          if (unitRes.rows.length === 0) {
            throw new Error('No units available for sale');
          }
          const unitId = unitRes.rows[0].id;
          const salePricePaise = Number(listing.sale_price_paise);

          const orderInsert = await client.query(
            `INSERT INTO orders (buyer_user_id, status, total_amount_paise)
             VALUES ($1, 'paid', $2)
             RETURNING id, status, total_amount_paise AS "totalPaise", created_at AS "createdAt"`,
            [auth.userId, salePricePaise],
          );
          const order = orderInsert.rows[0];

          await client.query(
            `INSERT INTO order_items (order_id, inventory_item_id, listing_id, unit_price_paise, status)
             VALUES ($1, $2, $3, $4, 'paid')`,
            [order.id, unitId, listing.id, salePricePaise],
          );

          await client.query(
            `UPDATE inventory_items SET operational_status = 'SOLD' WHERE id = $1`,
            [unitId],
          );

          await client.query('COMMIT');
          return order;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        }
      });

      recordEdgeAudit(env, ctx, 'SALE_ORDER_CREATED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        orderId: orderResult.id,
        listingId,
        totalPaise: orderResult.totalPaise,
      });

      emitQueueEvent(env, ctx, 'ORDER_PLACED', {
        orderId: orderResult.id,
        listingId,
        userId: auth.userId,
        totalPaise: orderResult.totalPaise,
      });

      return jsonResponse({ data: orderResult }, 201, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'ORDER_FAILED' } }, 409, cors);
    }
  }

  // 2. Sales Orders - List
  if (path === '/orders' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const orders = await withDb(env, ctx, async (client) => {
        const sql = `
          SELECT 
            o.id, o.status, o.total_amount_paise AS "totalPaise", o.created_at AS "createdAt",
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', oi.id, 'listingId', l.id, 'listingTitle', l.title,
                  'unitPricePaise', oi.unit_price_paise, 'brand', l.brand,
                  'primaryImageUrl', COALESCE((SELECT object_key FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1), '')
                ))
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
              ), '[]'::json
            ) AS items
          FROM orders o
          WHERE o.buyer_user_id::text = $1
          ORDER BY o.created_at DESC
        `;
        const res = await client.query(sql, [auth.userId]);
        return res.rows;
      });

      return jsonResponse({ data: orders }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  return null;
}

