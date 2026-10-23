import { pool } from '../../config/database.js';

const PAYMENT_COLUMNS = `
    p.id, p.rental_booking_id, p.order_id, p.payment_type, p.direction, p.amount_paise,
    p.status, p.provider, p.provider_transaction_id, p.idempotency_key, p.created_at, p.updated_at`;

export async function insertPayment(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.payments
        (rental_booking_id, order_id, payment_type, direction, amount_paise,
         provider, provider_transaction_id, idempotency_key, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::varchar, 'pending'))
     RETURNING id, status`,
    [
      fields.rental_booking_id ?? null, fields.order_id ?? null,
      fields.payment_type, fields.direction, fields.amount_paise,
      fields.provider ?? null, fields.provider_transaction_id ?? null,
      fields.idempotency_key ?? null, fields.status ?? null,
    ],
  );
  return rows[0];
}

export async function findPaymentById(paymentId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PAYMENT_COLUMNS} FROM public.payments p WHERE p.id = $1 LIMIT 1`,
    [paymentId],
  );
  return rows[0] ?? null;
}

export async function findPaymentByIdempotencyKey(idempotencyKey, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PAYMENT_COLUMNS} FROM public.payments p WHERE p.idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  return rows[0] ?? null;
}

export async function updatePaymentStatus(client, paymentId, { fromStatus, toStatus, provider, providerTransactionId }) {
  const { rows } = await client.query(
    `UPDATE public.payments
     SET status = $3,
         provider = COALESCE($4, provider),
         provider_transaction_id = COALESCE($5, provider_transaction_id),
         updated_at = now()
     WHERE id = $1 AND status = ANY($2::varchar[])
     RETURNING id, status`,
    [paymentId, fromStatus, toStatus, provider ?? null, providerTransactionId ?? null],
  );
  return rows[0] ?? null;
}

export async function writePaymentEvent(client, { payment_id, event_type, provider_event_id, amount_paise, payload }) {
  const { rows } = await client.query(
    `INSERT INTO public.payment_events
        (payment_id, event_type, provider_event_id, amount_paise, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, occurred_at`,
    [
      payment_id, event_type, provider_event_id ?? null, amount_paise ?? null,
      payload === undefined || payload === null ? null : JSON.stringify(payload),
    ],
  );
  return rows[0];
}

export async function findPaymentEvents(paymentId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, event_type, provider_event_id, amount_paise, occurred_at, created_at
     FROM public.payment_events WHERE payment_id = $1 ORDER BY occurred_at ASC, id ASC`,
    [paymentId],
  );
  return rows;
}

/** All payments tied to one business entity. */
export async function listPaymentsForEntity({ rentalBookingId = null, orderId = null }, { statuses = null } = {}, client = pool) {
  let where = '';
  const params = [];
  if (rentalBookingId) {
    params.push(rentalBookingId);
    where = 'rental_booking_id = $1';
  } else if (orderId) {
    params.push(orderId);
    where = 'order_id = $1';
  } else {
    return [];
  }
  let statusClause = '';
  if (statuses) {
    params.push(statuses);
    statusClause = ` AND status = ANY($2::varchar[])`;
  }
  const { rows } = await client.query(
    `SELECT ${PAYMENT_COLUMNS} FROM public.payments p WHERE ${where}${statusClause}
     ORDER BY created_at ASC`,
    params,
  );
  return rows;
}

/**
 * "My payments" = payments on the user's bookings or orders. UNION keeps the
 * result flat without a polymorphic payer column.
 */
export async function listPaymentsForUser(userId, { limit, offset }) {
  const sql = `SELECT ${PAYMENT_COLUMNS} FROM public.payments p
     JOIN public.rental_bookings rb ON rb.id = p.rental_booking_id AND rb.renter_user_id = $1
     UNION ALL
     SELECT ${PAYMENT_COLUMNS} FROM public.payments p2
     JOIN public.orders o ON o.id = p2.order_id AND o.buyer_user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`;

  const countSql = `SELECT
        (SELECT count(*)::int FROM public.payments p
         JOIN public.rental_bookings rb ON rb.id = p.rental_booking_id AND rb.renter_user_id = $1) +
        (SELECT count(*)::int FROM public.payments p2
         JOIN public.orders o ON o.id = p2.order_id AND o.buyer_user_id = $1) AS total`;

  const [list, count] = await Promise.all([
    pool.query(sql, [userId, limit, offset]),
    pool.query(countSql, [userId]),
  ]);
  return { rows: list.rows.map(mapPaymentRow), total: count.rows[0].total };
}

export async function findEntityUsers({ rentalBookingId = null, orderId = null }, client = pool) {
  if (rentalBookingId) {
    const { rows } = await client.query(
      `SELECT rb.renter_user_id AS user_id, NULL AS owner_user_id, rb.rental_listing_id
       FROM public.rental_bookings rb WHERE rb.id = $1`,
      [rentalBookingId],
    );
    const row = rows[0];
    if (!row) return null;
    const { rows: listingRows } = await client.query(
      `SELECT owner_type, owner_user_id FROM public.listings WHERE id = $1`,
      [row.rental_listing_id],
    );
    return { payerId: row.user_id, listingOwnerType: listingRows[0]?.owner_type ?? null, listingOwnerId: listingRows[0]?.owner_user_id ?? null };
  }
  const { rows } = await client.query(
    `SELECT o.buyer_user_id AS user_id FROM public.orders o WHERE o.id = $1`,
    [orderId],
  );
  const row = rows[0];
  if (!row) return null;
  return { payerId: row.user_id, listingOwnerType: null, listingOwnerId: null };
}

export function mapPaymentRow(row) {
  return {
    id: row.id,
    rentalBookingId: row.rental_booking_id ?? null,
    orderId: row.order_id ?? null,
    paymentType: row.payment_type,
    direction: row.direction,
    amountPaise: Number(row.amount_paise),
    status: row.status,
    provider: row.provider ?? null,
    providerTransactionId: row.provider_transaction_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
