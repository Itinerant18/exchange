import { pool } from '../../config/database.js';

export async function insertDispute(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.disputes
        (rental_booking_id, order_id, opened_by_user_id, against_user_id,
         dispute_type, description, evidence_urls, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'open')
     RETURNING id, rental_booking_id, order_id, opened_by_user_id, against_user_id,
               dispute_type, description, evidence_urls, status, created_at`,
    [
      fields.rental_booking_id ?? null,
      fields.order_id ?? null,
      fields.opened_by_user_id,
      fields.against_user_id ?? null,
      fields.dispute_type,
      fields.description,
      JSON.stringify(fields.evidence_urls ?? []),
    ],
  );
  return rows[0];
}

export async function findDisputeById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT id, rental_booking_id, order_id, opened_by_user_id, against_user_id,
            dispute_type, description, evidence_urls, status, resolution,
            resolved_by, resolved_at, created_at, updated_at
     FROM public.disputes WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listDisputesForUser(userId, { limit, offset }) {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT id, rental_booking_id, order_id, dispute_type, status, created_at
       FROM public.disputes
       WHERE opened_by_user_id = $1 OR against_user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM public.disputes
       WHERE opened_by_user_id = $1 OR against_user_id = $1`,
      [userId],
    ),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
}

export async function listDisputesForAdmin({ status, limit, offset }) {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT id, rental_booking_id, order_id, opened_by_user_id, against_user_id,
              dispute_type, status, created_at
       FROM public.disputes ${whereSql}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.disputes ${whereSql}`, params),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
}

export async function resolveDispute(client, id, { status, resolution, resolvedBy }) {
  const { rows } = await client.query(
    `UPDATE public.disputes
     SET status = $2, resolution = $3, resolved_by = $4, resolved_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('open', 'under_review')
     RETURNING id, status, resolution, resolved_by, resolved_at`,
    [id, status, resolution, resolvedBy],
  );
  return rows[0] ?? null;
}

export function mapDisputeRow(row) {
  return {
    id: row.id,
    rentalBookingId: row.rental_booking_id ?? null,
    orderId: row.order_id ?? null,
    openedByUserId: row.opened_by_user_id,
    againstUserId: row.against_user_id ?? null,
    type: row.dispute_type,
    description: row.description ?? null,
    evidenceUrls: row.evidence_urls ?? [],
    status: row.status,
    resolution: row.resolution ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
  };
}
