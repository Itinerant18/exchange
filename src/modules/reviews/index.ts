import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { recordEdgeAudit } from '../../services/d1Client';
import { extractBearerUser } from '../../middleware/auth';

export async function handleReviewsRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  // 1. Reviews - Listing Reviews or All Reviews
  if ((path === '/reviews' || (path.startsWith('/listings/') && path.endsWith('/reviews'))) && method === 'GET') {
    let listingId = url.searchParams.get('listingId');
    if (path.startsWith('/listings/') && path.endsWith('/reviews')) {
      listingId = path.replace('/listings/', '').replace('/reviews', '');
    }

    try {
      const reviews = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT 
            r.id, r.rating, r.comment, r.photos, r.status, r.created_at AS "createdAt",
            p.display_name AS "reviewerName", p.avatar_url AS "reviewerAvatar"
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_user_id
          LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE r.status = 'published'
        `;
        const params: any[] = [];
        if (listingId) {
          sql += ` AND (
            r.qualifying_rental_booking_id IN (SELECT id FROM rental_bookings WHERE rental_listing_id::text = $1)
            OR r.qualifying_order_id IN (SELECT order_id FROM order_items WHERE listing_id::text = $1)
          )`;
          params.push(listingId);
        }
        sql += ` ORDER BY r.created_at DESC LIMIT 50`;
        const res = await client.query(sql, params);
        return res.rows;
      });

      return jsonResponse({ data: reviews }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 2. Reviews - Submit Review
  if (path === '/reviews' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const body = (await request.json()) as any;
      const { revieweeUserId, rentalBookingId, orderId, rating, comment, photos } = body;
      const numRating = Number(rating);

      if (!numRating || numRating < 1 || numRating > 5) {
        return jsonResponse({ error: { message: 'Rating must be an integer between 1 and 5', code: 'INVALID_INPUT' } }, 400, cors);
      }

      if (!revieweeUserId || revieweeUserId === auth.userId) {
        return jsonResponse({ error: { message: 'Self-review is not allowed', code: 'SELF_REVIEW' } }, 400, cors);
      }

      if ((!rentalBookingId && !orderId) || (rentalBookingId && orderId)) {
        return jsonResponse({ error: { message: 'Exactly one qualifying booking or order must be provided', code: 'INVALID_TARGET' } }, 400, cors);
      }

      const review = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `INSERT INTO reviews (
             reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id, qualifying_order_id,
             rating, comment, photos, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'published')
           RETURNING id, rating, comment, photos, created_at AS "createdAt"`,
          [
            auth.userId,
            revieweeUserId,
            rentalBookingId || null,
            orderId || null,
            numRating,
            comment ? String(comment).slice(0, 1000) : null,
            JSON.stringify(Array.isArray(photos) ? photos : []),
          ],
        );
        return res.rows[0];
      });

      recordEdgeAudit(env, ctx, 'REVIEW_SUBMITTED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        reviewId: review.id,
        rating: numRating,
      });

      return jsonResponse({ data: review }, 201, cors);
    } catch (err: any) {
      if (err.message.includes('unique') || err.message.includes('reviews_rental_unique')) {
        return jsonResponse({ error: { message: 'Review already submitted for this transaction', code: 'DUPLICATE_REVIEW' } }, 409, cors);
      }
      return jsonResponse({ error: { message: err.message, code: 'REVIEW_FAILED' } }, 500, cors);
    }
  }

  return null;
}

