import { pool } from '../../config/database.js';

const BOOKING_COLUMNS = `
    rb.id, rb.renter_user_id, rb.rental_listing_id, rb.status, rb.start_date, rb.end_date,
    rb.subtotal_amount_paise, rb.deposit_amount_paise, rb.total_amount_paise,
    rb.deposit_paid, rb.actual_return_date, rb.created_at, rb.updated_at,
    rb.damage_waiver_selected, rb.damage_waiver_fee_paise, rb.backup_size,
    rb.transport_mode, rb.outbound_distance_km, rb.return_distance_km,
    rb.transport_rate_paise_per_km, rb.outbound_transport_amount_paise, rb.return_transport_amount_paise,
    rb.overdue_days, rb.late_fee_amount_paise,
    l.title AS listing_title, l.owner_type AS listing_owner_type, l.owner_user_id AS listing_owner_id,
    l.rental_price_paise AS listing_rate_paise, l.deposit_paise AS listing_deposit_paise`;

export async function insertBooking(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.rental_bookings
        (renter_user_id, rental_listing_id, status, start_date, end_date,
         subtotal_amount_paise, deposit_amount_paise, total_amount_paise, deposit_paid,
         damage_waiver_selected, damage_waiver_fee_paise, backup_size,
         transport_mode, outbound_distance_km, return_distance_km,
         transport_rate_paise_per_km, outbound_transport_amount_paise, return_transport_amount_paise)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id, status, created_at`,
    [
      fields.renter_user_id, fields.rental_listing_id, fields.status,
      fields.start_date, fields.end_date,
      fields.subtotal_amount_paise, fields.deposit_amount_paise,
      fields.total_amount_paise, fields.deposit_paid,
      fields.damage_waiver_selected ?? false,
      fields.damage_waiver_fee_paise ?? 0,
      fields.backup_size ?? null,
      fields.transport_mode ?? 'none',
      fields.outbound_distance_km ?? null,
      fields.return_distance_km ?? null,
      fields.transport_rate_paise_per_km ?? null,
      fields.outbound_transport_amount_paise ?? 0,
      fields.return_transport_amount_paise ?? 0,
    ],
  );
  return rows[0];
}

export async function insertBookingItem(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.rental_booking_items
        (rental_booking_id, inventory_item_id, item_status, start_date, end_date,
         daily_rate_paise, line_total_paise, is_backup_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      fields.rental_booking_id, fields.inventory_item_id, fields.item_status,
      fields.start_date, fields.end_date, fields.daily_rate_paise, fields.line_total_paise,
      fields.is_backup_size === true,
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
    `SELECT id, inventory_item_id, item_status, start_date, end_date, daily_rate_paise, line_total_paise, is_backup_size
     FROM public.rental_booking_items
     WHERE rental_booking_id = $1
     ORDER BY is_backup_size ASC, start_date ASC, id ASC`,
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
 * Status/date filters use an allowlist of columns only.
 */
export async function listBookings({ viewer, viewerUserId, status, limit, offset }) {
  const conditions = [];
  const params = [];
  let fromClause = 'public.rental_bookings rb JOIN public.listings l ON l.id = rb.rental_listing_id';
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
     FROM ${fromClause}
     ${whereSql}
     ORDER BY rb.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const countSql = `SELECT count(*)::int AS total
     FROM ${fromClause}
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

/** Applies an approved extension: new end date + refreshed money snapshot. */
export async function applyBookingExtension(client, bookingId, { newEndDate, dailyRatePaise, additionalDays, currentSubtotal, depositAmountPaise, damageWaiverFeePaise }) {
  const newSubtotal = currentSubtotal + additionalDays * dailyRatePaise;
  const newTotal = newSubtotal + depositAmountPaise + (damageWaiverFeePaise ?? 0);
  const { rows } = await client.query(
    `UPDATE public.rental_bookings
     SET end_date = $2,
         subtotal_amount_paise = $3,
         total_amount_paise = $4,
         updated_at = now()
     WHERE id = $1
     RETURNING id, end_date`,
    [bookingId, newEndDate, newSubtotal, newTotal],
  );
  return rows[0] ?? null;
}

/** Extends the blocking item rows; the GiST exclusion constraint arbitrates. */
export async function extendBookingItemDates(client, bookingId, { newEndDate, dailyRatePaise, additionalDays }) {
  const { rowCount } = await client.query(
    `UPDATE public.rental_booking_items
     SET end_date = $2,
         line_total_paise = line_total_paise + $3 * $4,
         updated_at = now()
     WHERE rental_booking_id = $1 AND item_status IN ('pending', 'confirmed', 'active')`,
    [bookingId, newEndDate, additionalDays, dailyRatePaise],
  );
  return rowCount;
}

export async function insertStatusHistory(client, { rental_booking_id, from_status, to_status, changed_by_user_id, reason }) {
  await client.query(
    `INSERT INTO public.rental_booking_status_history
        (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [rental_booking_id, from_status, to_status, changed_by_user_id, reason ?? null],
  );
}

// ------------------------------------------------------------ extensions

export async function insertExtension(client, { rental_booking_id, requested_by_type, new_end_date, additional_days, additional_amount_paise }) {
  const { rows } = await client.query(
    `INSERT INTO public.booking_extensions
        (rental_booking_id, requested_by_type, new_end_date, additional_days, additional_amount_paise)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, rental_booking_id, requested_by_type, new_end_date, additional_days,
               additional_amount_paise, status, created_at`,
    [rental_booking_id, requested_by_type, new_end_date, additional_days, additional_amount_paise],
  );
  return rows[0];
}

export async function findExtensionById(extensionId, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM public.booking_extensions WHERE id = $1 LIMIT 1`,
    [extensionId],
  );
  return rows[0] ?? null;
}

export async function listExtensionsForBooking(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM public.booking_extensions WHERE rental_booking_id = $1 ORDER BY created_at DESC`,
    [bookingId],
  );
  return rows;
}

/** Conditional decision update; returns the row only when it moved. */
export async function decideExtension(client, extensionId, { toStatus, decidedBy, rejectionReason = null }) {
  const { rows } = await client.query(
    `UPDATE public.booking_extensions
     SET status = $2, decided_by = $3, decided_at = now(), rejection_reason = $4
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [extensionId, toStatus, decidedBy, rejectionReason],
  );
  return rows[0] ?? null;
}

// ------------------------------------------------- returns & inspections

export async function insertInspection(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.return_inspections
        (rental_booking_id, inspected_by_user_id, result, notes, evidence_urls, estimated_recovery_paise)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, rental_booking_id, inspected_by_user_id, result, notes,
               evidence_urls, estimated_recovery_paise, created_at`,
    [
      fields.rental_booking_id, fields.inspected_by_user_id, fields.result,
      fields.notes ?? null, fields.evidence_urls ?? '[]',
      fields.estimated_recovery_paise ?? null,
    ],
  );
  return rows[0];
}

export async function findInspectionForBooking(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, rental_booking_id, inspected_by_user_id, result, notes,
            evidence_urls, estimated_recovery_paise, created_at
     FROM public.return_inspections
     WHERE rental_booking_id = $1
     LIMIT 1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function findDisputesForBooking(bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, dispute_type, status, resolution
     FROM public.disputes
     WHERE rental_booking_id = $1
     ORDER BY created_at DESC`,
    [bookingId],
  );
  return rows;
}

// -------------------------------------------------------- late fee fields

export async function setLateFeeFields(client, bookingId, { overdueDays, lateFeeAmount }) {
  const { rowCount } = await client.query(
    `UPDATE public.rental_bookings
     SET overdue_days = $2, late_fee_amount_paise = $3, updated_at = now()
     WHERE id = $1`,
    [bookingId, overdueDays, lateFeeAmount],
  );
  return rowCount === 1;
}

export function mapBookingRow(row) {
  const outboundSelected = row.transport_mode === 'outbound' || row.transport_mode === 'both';
  const returnSelected = row.transport_mode === 'return' || row.transport_mode === 'both';
  const days = row.start_date && row.end_date
    ? Math.max(0, Math.round((Date.parse(`${row.end_date}T00:00:00Z`) - Date.parse(`${row.start_date}T00:00:00Z`)) / 86_400_000))
    : null;
  return {
    id: row.id,
    renterUserId: row.renter_user_id,
    listingId: row.rental_listing_id,
    listingTitle: row.listing_title ?? null,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    rentalDays: days,
    subtotalAmountPaise: Number(row.subtotal_amount_paise),
    depositAmountPaise: Number(row.deposit_amount_paise),
    totalAmountPaise: Number(row.total_amount_paise),
    depositPaid: row.deposit_paid,
    actualReturnDate: row.actual_return_date ?? null,
    damageWaiver: {
      selected: row.damage_waiver_selected ?? false,
      feePaise: Number(row.damage_waiver_fee_paise ?? 0),
    },
    backupSize: row.backup_size ?? null,
    transport: {
      mode: row.transport_mode,
      outboundDistanceKm: outboundSelected && row.outbound_distance_km !== null ? Number(row.outbound_distance_km) : null,
      returnDistanceKm: returnSelected && row.return_distance_km !== null ? Number(row.return_distance_km) : null,
      ratePaisePerKm: row.transport_rate_paise_per_km === null || row.transport_rate_paise_per_km === undefined ? null : Number(row.transport_rate_paise_per_km),
      outboundAmountPaise: Number(row.outbound_transport_amount_paise ?? 0),
      returnAmountPaise: Number(row.return_transport_amount_paise ?? 0),
    },
    lateFee: {
      overdueDays: row.overdue_days ?? null,
      amountPaise: row.late_fee_amount_paise === null || row.late_fee_amount_paise === undefined ? null : Number(row.late_fee_amount_paise),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
