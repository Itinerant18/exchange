import { pool } from '../../config/database.js';

export async function insertReview(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.reviews
        (reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id, qualifying_order_id,
         rating, comment, size_worn, reviewer_height_cm, reviewer_weight_kg, bust_size, body_type, fit_rating, photos,
         status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published')
     RETURNING id, status, created_at`,
    [
      fields.reviewer_user_id, fields.reviewee_user_id,
      fields.qualifying_rental_booking_id ?? null, fields.qualifying_order_id ?? null,
      fields.rating, fields.comment ?? null,
      fields.size_worn ?? null, fields.reviewer_height_cm ?? null, fields.reviewer_weight_kg ?? null,
      fields.bust_size ?? null, fields.body_type ?? null, fields.fit_rating ?? null,
      JSON.stringify(fields.photos ?? []),
    ],
  );
  return rows[0];
}

export async function findReviewById(reviewId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.reviewer_user_id, r.reviewee_user_id,
            r.qualifying_rental_booking_id, r.qualifying_order_id,
            r.rating, r.comment, r.status, r.photos, r.created_at, r.updated_at,
            ra.email AS reviewer_email, ee.email AS reviewee_email,
            COALESCE(rp.display_name, 'User') AS reviewer_display_name,
            COALESCE(ep.display_name, 'User') AS reviewee_display_name
     FROM public.reviews r
     JOIN public.users ra ON ra.id = r.reviewer_user_id
     JOIN public.users ee ON ee.id = r.reviewee_user_id
     LEFT JOIN public.user_profiles rp ON rp.user_id = r.reviewer_user_id
     LEFT JOIN public.user_profiles ep ON ep.user_id = r.reviewee_user_id
     WHERE r.id = $1 LIMIT 1`,
    [reviewId],
  );
  return rows[0] ?? null;
}

export async function setReviewStatus(client, reviewId, status) {
  const { rowCount } = await client.query(
    `UPDATE public.reviews SET status = $2, updated_at = now() WHERE id = $1 AND status <> $2`,
    [reviewId, status],
  );
  return rowCount === 1;
}

export async function deleteReview(reviewId, user, client) {
  const { rowCount } = await (client ?? pool).query(
    `DELETE FROM public.reviews WHERE id = $1 AND ($2::boolean OR reviewer_user_id = $3::uuid)`,
    [reviewId, user?.isAdmin === true, user?.id ?? null],
  );
  return rowCount > 0;
}

/** Public profile reviews: only published, paginated, filtered by subject. */
export async function listPublicReviewsForUser(revieweeUserId, { minRating = 1, limit, offset }) {
  const params = [revieweeUserId, minRating, limit, offset];
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              rp.display_name AS reviewer_display_name,
              r.qualifying_rental_booking_id, r.qualifying_order_id,
              r.size_worn, r.reviewer_height_cm, r.reviewer_weight_kg, r.bust_size,
              r.body_type, r.fit_rating
       FROM public.reviews r
       LEFT JOIN public.user_profiles rp ON rp.user_id = r.reviewer_user_id
       WHERE r.reviewee_user_id = $1 AND r.status = 'published' AND r.rating >= $2
       ORDER BY r.created_at DESC
       LIMIT $3 OFFSET $4`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM public.reviews
       WHERE reviewee_user_id = $1 AND status = 'published' AND rating >= $2`,
      [revieweeUserId, minRating],
    ),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
}

export async function listReviewsByAuthor(authorUserId, { limit, offset }) {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT r.id, r.reviewer_user_id, r.reviewee_user_id, r.rating, r.comment, r.status,
              r.created_at, r.qualifying_rental_booking_id, r.qualifying_order_id
       FROM public.reviews r
       WHERE r.reviewer_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [authorUserId, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.reviews WHERE reviewer_user_id = $1`, [authorUserId]),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
}

/**
 * 'Our Runway' reviews for one listing: published reviews whose qualifying
 * transaction is a rental booking of that listing, with the fit meter
 * aggregate computed from structured fit ratings.
 */
export async function listPublishedReviewsForListing(listingId, { limit, offset }) {
  const listSql = `
      SELECT r.id, r.rating, r.comment, r.created_at,
              rp.display_name AS reviewer_display_name,
              r.size_worn, r.reviewer_height_cm, r.reviewer_weight_kg, r.bust_size,
              r.body_type, r.fit_rating, r.photos,
              rb.renter_user_id
       FROM public.reviews r
       JOIN public.rental_bookings rb ON rb.id = r.qualifying_rental_booking_id
       LEFT JOIN public.user_profiles rp ON rp.user_id = r.reviewer_user_id
       WHERE rb.rental_listing_id = $1 AND r.status = 'published'
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`;
  const countSql = `
      SELECT count(*)::int AS total
      FROM public.reviews r
      JOIN public.rental_bookings rb ON rb.id = r.qualifying_rental_booking_id
      WHERE rb.rental_listing_id = $1 AND r.status = 'published'`;
  const statsSql = `
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE r.fit_rating = 'RUNS_SMALL')::int AS runs_small,
             count(*) FILTER (WHERE r.fit_rating = 'TRUE_TO_SIZE')::int AS true_to_size,
             count(*) FILTER (WHERE r.fit_rating = 'RUNS_LARGE')::int AS runs_large,
             COALESCE(round(avg(r.rating) * 100)::int / 100.0, 0) AS average
      FROM public.reviews r
      JOIN public.rental_bookings rb ON rb.id = r.qualifying_rental_booking_id
      WHERE rb.rental_listing_id = $1 AND r.status = 'published'`;

  const [list, count, stats] = await Promise.all([
    pool.query(listSql, [listingId, limit, offset]),
    pool.query(countSql, [listingId]),
    pool.query(statsSql, [listingId]),
  ]);
  const s = stats.rows[0];
  const totalRatings = s.total;
  const pct = (n) => (totalRatings > 0 ? Math.round((n / totalRatings) * 100) : 0);
  return {
    rows: list.rows,
    total: count.rows[0].total,
    fitStats: {
      totalRatings,
      runsSmall: pct(s.runs_small),
      trueToSize: pct(s.true_to_size),
      runsLarge: pct(s.runs_large),
      averageRating: Number(s.average),
    },
  };
}

/** Average rating + count for a user, restricted to published reviews. */
export async function getReputation(revieweeUserId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count, COALESCE(round(avg(rating) * 100)::int / 100.0, 0) AS average
     FROM public.reviews
     WHERE reviewee_user_id = $1 AND status = 'published'`,
    [revieweeUserId],
  );
  return { reviewCount: rows[0].count, averageRating: Number(rows[0].average) };
}
