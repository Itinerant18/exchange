import { pool } from '../../config/database.js';

const BOOKING_COLUMNS = `
    rb.id, rb.renter_user_id, rb.rental_listing_id, rb.status, rb.start_date, rb.end_date,
    rb.subtotal_amount_paise, rb.deposit_amount_paise, rb.total_amount_paise,
    rb.deposit_paid, rb.actual_return_date, rb.created_at, rb.updated_at,
    l.title AS listing_title, l.owner_type AS listing_owner_type, l.owner_user_id AS listing_owner_id,
    l.rental_price_paise AS listing_rate_paise, l.deposit_paise AS listing_deposit_paise`;

export async function insertBooking(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.rental_bookings
        (renter_user_id, rental_listing_id, status, start_date, end_date,
         subtotal_amount_paise, deposit_amount_paise, total_amount_paise, deposit_paid)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, status, created_at`,
    [
      fields.renter_user_id, fields.rental_listing_id, fields.status,
      fields.start_date, fields.end_date,
      fields.subtotal_amount_paise, fields.deposit_amount_paise,
      fields.total_amount_paise, fields.deposit_paid,
    ],
  );
  return rows[0];
}

export async function insertBookingItem(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.rental_booking_items
        (rental_booking_id, inventory_item_id, item_status, start_date, end_date,
         daily_rate_paise, line_total_paise)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      fields.rental_booking_id, fields.inventory_item_id, fields.item_status,
      fields.start_date, fields.end_date, fields.daily_rate_paise, fields.line_total_paise,
    ],
  );
  return rows[0];
}

export async function findBookingById(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${BOOKING_COLUMNS}
     FROM public.rental_bookings rb
     JOIN public.listings l ON l.id = rb.rental_listing_id
     WHERE rb.id = $1 LIMIT 1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function findBookingItems(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, inventory_item_id, item_status, start_date, end_date, daily_rate_paise, line_total_paise
     FROM public.rental_booking_items
     WHERE rental_booking_id = $1
     ORDER BY start_date ASC, id ASC`,
    [bookingId],
  );
  return rows;
}

export async function findBookingHistory(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT h.id, h.from_status, h.to_status, h.changed_by_user_id, h.reason, h.created_at
     FROM public.rental_booking_status_history h
     WHERE h.rental_booking_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [bookingId],
  );
  return rows;
}

/**
 * Builds booking list queries. `viewer` is one of 'renter' | 'provider' | 'all'.
 * status/date filters use an allowlist of columns only.
 */
export async function listBookings({ viewer, viewerUserId, status, limit, offset }) {
  const conditions = [];
  const params = [];
  if (viewer === 'renter') {
    params.push(viewerUserId);
    conditions.push(`rb.renter_user_id = $${params.length}`);
  } else if (viewer === 'provider') {
    params.push(viewerUserId);
    conditions.push(`l.owner_user_id = $${params.length} AND l.owner_type = 'SELLER'`);
  }
  if (status) {
    params.push(status);
    conditions.push(`rb.status = $${params.length}`);
  }
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const listSql = `SELECT ${BOOKING_COLUMNS}
     FROM public.rental_bookings rb
     JOIN public.listings l ON l.id = rb.rental_listing_id
     ${whereSql}
     ORDER BY rb.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const countSql = `SELECT count(*)::int AS total
     FROM public.rental_bookings rb
     JOIN public.listings l ON l.id = rb.rental_listing_id
     ${whereSql}`;

  const [listResult, countResult] = await Promise.all([
    pool.query(listSql, [...params, limit, offset]),
    pool.query(countSql, params),
  ]);
  return { rows: listResult.rows.map(mapBookingRow), total: countResult.rows[0].total };
}

/**
 * Conditional guarded transition: only moves the header when its current
 * status matches fromStatus, preventing double transitions under concurrency.
 */
export async function transitionBookingStatus(client, bookingId, { fromStatus, toStatus }) {
  const { rowCount } = await client.query(
    `UPDATE public.rental_bookings
     SET status = $3, updated_at = now()
     WHERE id = $1 AND status = ANY($2::varchar[]) AND status <> $3`,
    [bookingId, fromStatus, toStatus],
  );
  return rowCount === 1;
}

export async function setBookingItemsStatus(client, bookingId, { fromStatus, toStatus }) {
  const { rowCount } = await client.query(
    `UPDATE public.rental_booking_items
     SET item_status = $3, updated_at = now()
     WHERE rental_booking_id = $1 AND item_status = $2 AND item_status <> $3`,
    [bookingId, fromStatus, toStatus],
  );
  return rowCount;
}

export async function setActualReturnDate(client, bookingId, returnDate) {
  await client.query(
    `UPDATE public.rental_bookings SET actual_return_date = $2, updated_at = now() WHERE id = $1`,
    [bookingId, returnDate],
  );
}

export async function setDepositPaid(client, bookingId, depositPaid) {
  await client.query(
    `UPDATE public.rental_bookings SET deposit_paid = $2, updated_at = now() WHERE id = $1`,
    [bookingId, depositPaid],
  );
}

export async function insertStatusHistory(client, { rental_booking_id, from_status, to_status, changed_by_user_id, reason }) {
  await client.query(
    `INSERT INTO public.rental_booking_status_history
        (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [rental_booking_id, from_status, to_status, changed_by_user_id, reason ?? null],
  );
}

export function mapBookingRow(row) {
  return {
    id: row.id,
    renterUserId: row.renter_user_id,
    listingId: row.rental_listing_id,
    listingTitle: row.listing_title ?? null,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    subtotalAmountPaise: Number(row.subtotal_amount_paise),
    depositAmountPaise: Number(row.deposit_amount_paise),
    totalAmountPaise: Number(row.total_amount_paise),
    depositPaid: row.deposit_paid,
    actualReturnDate: row.actual_return_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
