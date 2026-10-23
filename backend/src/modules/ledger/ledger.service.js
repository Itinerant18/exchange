// Earnings ledger core: every financial adjustment for a provider (or future
// wallet holder) becomes one traceable, idempotent entry. Balances are always
// derived from the entries themselves, so a balance can never drift from the
// audit trail.

import { pool } from '../../config/database.js';
import { AppError } from '../../appErrors/AppError.js';

/** Idempotent single-entry writer via an explicit replay key. */
export async function writeLedgerEntry(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.earnings_ledger
        (user_id, entry_direction, entry_type, rental_booking_id, order_id,
         source_type, source_id, amount_paise, idempotency_key, memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      fields.user_id,
      fields.entry_direction,
      fields.entry_type,
      fields.rental_booking_id ?? null,
      fields.order_id ?? null,
      fields.source_type,
      fields.source_id ?? null,
      fields.amount_paise,
      fields.idempotency_key ?? null,
      fields.memo ?? null,
    ],
  );
  return rows.length > 0;
}

/**
 * Idempotent writer keyed by the business source itself: repeated settlement
 * of the same booking/order can never double-credit. Requires either a booking
 * or an order attached (the underlying unique index keys on those).
 */
export async function writeLedgerEntryForSource(client, fields) {
  if (fields.rental_booking_id === null && fields.order_id === null) {
    throw new AppError('Source-keyed ledger entries require a booking or order.', {
      statusCode: 500,
      code: 'LEDGER_SOURCE_REQUIRED',
    });
  }
  await client.query(
    `INSERT INTO public.earnings_ledger
        (user_id, entry_direction, entry_type, rental_booking_id, order_id, source_type, amount_paise, memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (COALESCE(rental_booking_id::text, order_id::text), entry_type)
       WHERE rental_booking_id IS NOT NULL OR order_id IS NOT NULL
     DO NOTHING`,
    [
      fields.user_id,
      fields.entry_direction,
      fields.entry_type,
      fields.rental_booking_id ?? null,
      fields.order_id ?? null,
      fields.source_type,
      fields.amount_paise,
      fields.memo ?? null,
    ],
  );
}

/**
 * Credits a provider earning against a payment that has just been recorded as
 * collected (COD succeeded). Commission (bps) is deducted from rental/sale
 * income; transport/late-fee/damage pass through in full when the policy says
 * the provider receives them. Every entry path is idempotent.
 */
export async function creditBookingEarningsInTransaction(client, { booking, paymentType, amountPaise, providerReceivesTransport, commissionBps }) {
  const isProviderSideListing = booking.listing_owner_type === 'SELLER';
  const providerUserId = booking.listing_owner_id;
  if (!isProviderSideListing || providerUserId === null) {
    return [];
  }
  const entries = [];
  const commissionNet = (gross) => Math.floor((gross * (10_000 - commissionBps)) / 10_000);
  switch (paymentType) {
    case 'rental': {
      const net = commissionNet(amountPaise);
      await writeLedgerEntryForSource(client, {
        user_id: providerUserId,
        entry_direction: 'credit',
        entry_type: 'rental_earning',
        rental_booking_id: booking.id,
        source_type: 'rental_payment',
        amount_paise: net,
        memo: `Rental earning net of ${commissionBps} bps commission`,
      });
      entries.push({ type: 'rental_earning', amountPaise: net });
      break;
    }
    case 'sale': {
      const net = commissionNet(amountPaise);
      await writeLedgerEntryForSource(client, {
        user_id: providerUserId,
        entry_direction: 'credit',
        entry_type: 'sale_earning',
        order_id: booking.order_id,
        source_type: 'sale_payment',
        amount_paise: net,
        memo: `Sale earning net of ${commissionBps} bps commission`,
      });
      entries.push({ type: 'sale_earning', amountPaise: net });
      break;
    }
    case 'transport': {
      if (!providerReceivesTransport) break;
      await writeLedgerEntryForSource(client, {
        user_id: providerUserId,
        entry_direction: 'credit',
        entry_type: 'transport_earning',
        rental_booking_id: booking.id,
        source_type: 'transport_payment',
        amount_paise: amountPaise,
        memo: 'Transportation income (COD, collected by provider)',
      });
      entries.push({ type: 'transport_earning', amountPaise });
      break;
    }
    case 'late_fee': {
      await writeLedgerEntryForSource(client, {
        user_id: providerUserId,
        entry_direction: 'credit',
        entry_type: 'late_fee',
        rental_booking_id: booking.id,
        source_type: 'late_fee_payment',
        amount_paise: amountPaise,
        memo: 'Approved late-fee income',
      });
      entries.push({ type: 'late_fee', amountPaise });
      break;
    }
    case 'damage_charge': {
      await writeLedgerEntryForSource(client, {
        user_id: providerUserId,
        entry_direction: 'credit',
        entry_type: 'damage_charge',
        rental_booking_id: booking.id,
        source_type: 'damage_payment',
        amount_paise: amountPaise,
        memo: 'Damage/missing-product recovery income',
      });
      entries.push({ type: 'damage_charge', amountPaise });
      break;
    }
    default:
      break; // deposits are liabilities, never income
  }
  return entries;
}

/**
 * Debit (refund/adjustment). PG advisory transaction lock serializes balance
 * mutation per user so two racing refunds cannot both push below zero.
 */
export async function debitEntriesInTransaction(client, { userId, entries, memoFallback }) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`, [userId]);
  const balance = await getLedgerBalance(client, userId);
  const totalDebit = entries.reduce((sum, entry) => sum + entry.amountPaise, 0);
  if (balance.balancePaise - totalDebit < 0) {
    throw new AppError('The ledger balance cannot go negative.', {
      statusCode: 409,
      code: 'LEDGER_BALANCE_INSUFFICIENT',
    });
  }
  for (const entry of entries) {
    await writeLedgerEntry(client, {
      user_id: userId,
      entry_direction: 'debit',
      entry_type: entry.type,
      rental_booking_id: entry.rentalBookingId ?? null,
      order_id: entry.orderId ?? null,
      source_type: entry.sourceType,
      amount_paise: entry.amountPaise,
      idempotency_key: entry.idempotencyKey ?? null,
      memo: entry.memo ?? memoFallback ?? 'Adjustment',
    });
  }
}

export async function getLedgerBalance(client, userId) {
  const { rows } = await client.query(
    `SELECT
        COALESCE(SUM(CASE WHEN entry_direction = 'credit' THEN amount_paise ELSE 0 END), 0)::bigint AS credits_paise,
        COALESCE(SUM(CASE WHEN entry_direction = 'debit' THEN amount_paise ELSE 0 END), 0)::bigint AS debits_paise
     FROM public.earnings_ledger
     WHERE user_id = $1`,
    [userId],
  );
  const credits = Number(rows[0]?.credits_paise ?? 0);
  const debits = Number(rows[0]?.debits_paise ?? 0);
  return { creditsPaise: credits, debitsPaise: debits, balancePaise: credits - debits };
}

export async function listLedgerEntries(userId, { limit, offset, entryType = null, direction = null }) {
  const conditions = ['user_id = $1'];
  const params = [userId];
  if (entryType) {
    params.push(entryType);
    conditions.push(`entry_type = $${params.length}`);
  }
  if (direction) {
    params.push(direction);
    conditions.push(`entry_direction = $${params.length}`);
  }
  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const [list, count, balance] = await Promise.all([
    pool.query(
      `SELECT id, entry_direction, entry_type, rental_booking_id, order_id,
              amount_paise, memo, created_at
       FROM public.earnings_ledger
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM public.earnings_ledger ${whereSql}`,
      params,
    ),
    getLedgerBalance(pool, userId),
  ]);
  return {
    rows: list.rows.map((row) => ({
      id: row.id,
      direction: row.entry_direction,
      type: row.entry_type,
      rentalBookingId: row.rental_booking_id,
      orderId: row.order_id,
      amountPaise: Number(row.amount_paise),
      memo: row.memo,
      createdAt: row.created_at,
    })),
    total: count.rows[0].total,
    balance,
  };
}
