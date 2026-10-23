import { pool } from '../../config/database.js';

const REFUND_COLUMNS = `
    r.id, r.payment_id, r.refund_amount_paise, r.reason, r.status, r.processed_at,
    r.created_by_user_id, r.created_at, r.updated_at`;

export async function insertRefund(client, { payment_id, refund_amount_paise, reason, created_by_user_id, status = 'pending' }) {
  const { rows } = await client.query(
    `INSERT INTO public.refunds (payment_id, refund_amount_paise, reason, status, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, status`,
    [payment_id, refund_amount_paise, reason, status, created_by_user_id ?? null],
  );
  return rows[0];
}

/** Sum of pending + succeeded refunds for a payment (the committed money trail). */
export async function sumActiveRefunds(client, paymentId) {
  const { rows } = await client.query(
    `SELECT COALESCE(sum(refund_amount_paise), 0)::bigint AS total
     FROM public.refunds
     WHERE payment_id = $1 AND status IN ('pending', 'succeeded')`,
    [paymentId],
  );
  return Number(rows[0].total);
}

export async function findRefundById(refundId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${REFUND_COLUMNS}, p.rental_booking_id, p.order_id
     FROM public.refunds r
     JOIN public.payments p ON p.id = r.payment_id
     WHERE r.id = $1 LIMIT 1`,
    [refundId],
  );
  return rows[0] ?? null;
}

export async function transitionRefundStatus(client, refundId, { toStatus }) {
  const { rows } = await client.query(
    `UPDATE public.refunds
     SET status = $2::varchar, processed_at = CASE WHEN $2::varchar IN ('succeeded', 'failed') THEN now() ELSE processed_at END,
         updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, status`,
    [refundId, toStatus],
  );
  return rows[0] ?? null;
}

export async function listRefundsForAdmin({ status }, { limit, offset }) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE r.status = $1`;
  }
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT ${REFUND_COLUMNS} FROM public.refunds r ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.refunds r ${where}`, params),
  ]);
  return { rows: list.rows.map(mapRefundRow), total: count.rows[0].total };
}

export function mapRefundRow(row) {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amountPaise: Number(row.refund_amount_paise),
    reason: row.reason,
    status: row.status,
    processedAt: row.processed_at ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
