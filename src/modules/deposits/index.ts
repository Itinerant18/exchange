import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { extractBearerUser } from '../../middleware/auth';

export async function handleDepositsRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  if (path.startsWith('/deposits/bookings/') && method === 'GET') {
    const bookingId = path.replace('/deposits/bookings/', '');
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const depositInfo = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT b.id AS "bookingId", b.deposit_amount_paise AS "depositPaise",
                  b.deposit_paid AS "depositPaid", b.status AS "bookingStatus",
                  b.renter_user_id AS "renterUserId"
           FROM rental_bookings b
           WHERE b.id::text = $1 AND (b.renter_user_id::text = $2 OR EXISTS (
             SELECT 1 FROM listings l WHERE l.id = b.rental_listing_id AND l.owner_user_id::text = $2
           ))`,
          [bookingId, auth.userId],
        );
        return res.rows[0];
      });

      if (!depositInfo) {
        return jsonResponse({ error: { message: 'Deposit record not found', code: 'NOT_FOUND' } }, 404, cors);
      }

      return jsonResponse({ data: depositInfo }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  return null;
}

