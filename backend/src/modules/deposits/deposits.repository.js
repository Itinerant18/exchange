import { pool } from '../../config/database.js';

const DEPOSIT_COLUMNS = `
    d.id, d.rental_booking_id, d.status, d.collected_amount_paise, d.deduction_amount_paise,
    d.deduction_reason, d.released_at, d.created_at, d.updated_at,
    rb.renter_user_id`;

export async function findDepositById(depositId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${DEPOSIT_COLUMNS}
     FROM public.security_deposits d
     JOIN public.rental_bookings rb ON rb.id = d.rental_booking_id
     WHERE d.id = $1 LIMIT 1`,
    [depositId],
  );
  return rows[0] ?? null;
}

export async function setDepositOutcome(client, depositId, fields) {
  const { rows } = await client.query(
    `UPDATE public.security_deposits
     SET status = $2,
         deduction_amount_paise = COALESCE($3, deduction_amount_paise),
         deduction_reason = COALESCE($4, deduction_reason),
         released_at = $5,
         updated_at = now()
     WHERE id = $1 AND status = ANY($6::varchar[])
     RETURNING id, rental_booking_id, status, collected_amount_paise,
               deduction_amount_paise, deduction_reason, released_at,
               created_at, updated_at`,
    [
      depositId,
      fields.status,
      fields.deduction_amount_paise ?? null,
      fields.deduction_reason ?? null,
      fields.released_at ?? null,
      fields.fromStatuses,
    ],
  );
  return rows[0] ?? null;
}

export async function listDepositsForUser(userId, { limit, offset }) {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT ${DEPOSIT_COLUMNS}
       FROM public.security_deposits d
       JOIN public.rental_bookings rb ON rb.id = d.rental_booking_id
       WHERE rb.renter_user_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM public.security_deposits d
       JOIN public.rental_bookings rb ON rb.id = d.rental_booking_id
       WHERE rb.renter_user_id = $1`,
      [userId],
    ),
  ]);
  return { rows: list.rows.map(mapDepositRow), total: count.rows[0].total };
}

export function mapDepositRow(row) {
  return {
    id: row.id,
    rentalBookingId: row.rental_booking_id,
    renterUserId: row.renter_user_id,
    status: row.status,
    collectedAmountPaise: Number(row.collected_amount_paise),
    deductionAmountPaise: Number(row.deduction_amount_paise),
    deductionReason: row.deduction_reason ?? null,
    releasedAt: row.released_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
