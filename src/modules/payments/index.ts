import type { Client } from 'pg';
import type { Env } from '../../types';
import { jsonResponse, emitQueueEvent, requireJwtSecret } from '../../types';
import { withDb, withTx, isAdmin } from '../../services/db';
import { recordEdgeAudit } from '../../services/d1Client';
import { extractBearerUser } from '../../middleware/auth';

// Deposit payments are confirmed manually by an admin (cash / UPI / bank transfer verified offline).
// ponytail: no live gateway. When one is added, its verified webhook calls confirmDeposit() instead of the admin route.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_COLS = `id, rental_booking_id AS "rentalBookingId", order_id AS "orderId", payment_type AS "paymentType", direction,
  amount_paise::float8 AS "amountPaise", status, provider, provider_transaction_id AS "providerTransactionId",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const loadPayment = async (c: Client, id: string) =>
  (await c.query(`SELECT ${PAYMENT_COLS} FROM payments WHERE id = $1`, [id])).rows[0];

const optionalText = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

async function createDepositPayment(c: Client, userId: string, bookingId: string, idempotencyKey: string | null) {
  // Lock the booking first so concurrent requests (same key or not) serialize here.
  const b = (
    await c.query(
      `SELECT id, renter_user_id, status, deposit_amount_paise, deposit_paid FROM rental_bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
    )
  ).rows[0];
  if (!b) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  if (b.renter_user_id !== userId && !(await isAdmin(c, userId))) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this booking');
  }

  if (idempotencyKey) {
    const prior = (
      await c.query(`SELECT id, rental_booking_id, payment_type FROM payments WHERE idempotency_key = $1`, [idempotencyKey])
    ).rows[0];
    if (prior) {
      if (prior.rental_booking_id !== bookingId || prior.payment_type !== 'deposit') {
        throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different payment');
      }
      return { existing: true, payment: await loadPayment(c, prior.id) };
    }
  }

  if (b.status !== 'pending' && b.status !== 'confirmed') {
    throw new HttpError(409, 'BOOKING_NOT_PAYABLE', `A deposit can no longer be paid for a ${b.status} booking`);
  }
  if (b.deposit_paid) throw new HttpError(409, 'DEPOSIT_ALREADY_PAID', 'The deposit for this booking is already paid');
  // Amount always comes from the booking row, never from the client.
  const amount = BigInt(b.deposit_amount_paise);
  if (amount <= 0n) throw new HttpError(409, 'NO_PAYMENT_REQUIRED', 'This booking has no security deposit');

  const open = (
    await c.query(
      `SELECT id FROM payments WHERE rental_booking_id = $1 AND payment_type = 'deposit' AND status IN ('pending', 'succeeded') LIMIT 1`,
      [bookingId],
    )
  ).rows[0];
  if (open) throw new HttpError(409, 'PAYMENT_ALREADY_EXISTS', `A deposit payment already exists for this booking (${open.id})`);

  const id = (
    await c.query(
      `INSERT INTO payments (rental_booking_id, payment_type, direction, amount_paise, status, idempotency_key)
       VALUES ($1, 'deposit', 'in', $2, 'pending', $3) RETURNING id`,
      [bookingId, amount.toString(), idempotencyKey],
    )
  ).rows[0].id;
  await c.query(
    `INSERT INTO payment_events (payment_id, event_type, amount_paise, payload) VALUES ($1, 'initiated', $2, $3::jsonb)`,
    [id, amount.toString(), JSON.stringify({ paymentType: 'deposit', createdBy: userId })],
  );
  return { existing: false, payment: await loadPayment(c, id) };
}

/** Marks a pending deposit payment as received and puts the money in escrow. Idempotent per transaction reference. */
export async function confirmDeposit(c: Client, actorId: string, paymentId: string, providerTransactionId: string | null) {
  const p = (
    await c.query(
      `SELECT id, rental_booking_id, payment_type, status, amount_paise, provider_transaction_id FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    )
  ).rows[0];
  if (!p) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  if (p.payment_type !== 'deposit') {
    throw new HttpError(409, 'UNSUPPORTED_PAYMENT_TYPE', `Confirming ${p.payment_type} payments is not supported here`);
  }
  if (p.status === 'succeeded') {
    if (providerTransactionId && p.provider_transaction_id === providerTransactionId) {
      return { idempotent: true, bookingId: p.rental_booking_id as string, amountPaise: String(p.amount_paise) };
    }
    throw new HttpError(409, 'ALREADY_CONFIRMED', 'This payment has already been confirmed');
  }
  if (p.status !== 'pending') throw new HttpError(409, 'PAYMENT_NOT_CONFIRMABLE', `A ${p.status} payment cannot be confirmed`);

  const b = (
    await c.query(`SELECT status FROM rental_bookings WHERE id = $1 FOR UPDATE`, [p.rental_booking_id])
  ).rows[0];
  // 'active' allowed: cash is often collected at handover, after the workflow has activated the booking.
  if (!b || !['pending', 'confirmed', 'active'].includes(b.status)) {
    throw new HttpError(409, 'BOOKING_NOT_PAYABLE', `Booking is ${b?.status ?? 'missing'}; fail this payment instead`);
  }

  await c.query(
    `UPDATE payments SET status = 'succeeded', provider = COALESCE(provider, 'manual'), provider_transaction_id = $2,
       recorded_by_user_id = $3, updated_at = now()
     WHERE id = $1`,
    [paymentId, providerTransactionId, actorId],
  );
  await c.query(
    `INSERT INTO payment_events (payment_id, event_type, provider_event_id, amount_paise, payload)
     VALUES ($1, 'succeeded', $2, $3, $4::jsonb)`,
    [paymentId, providerTransactionId, String(p.amount_paise), JSON.stringify({ confirmedBy: actorId, mode: 'manual_offline' })],
  );
  await c.query(`UPDATE rental_bookings SET deposit_paid = true, updated_at = now() WHERE id = $1`, [p.rental_booking_id]);
  // The lifecycle workflow may already have opened the escrow row at 0; top it up while it is still held.
  await c.query(
    `INSERT INTO security_deposits (rental_booking_id, status, collected_amount_paise) VALUES ($1, 'held', $2)
     ON CONFLICT (rental_booking_id) DO UPDATE
       SET collected_amount_paise = EXCLUDED.collected_amount_paise, updated_at = now()
       WHERE security_deposits.status = 'held'`,
    [p.rental_booking_id, String(p.amount_paise)],
  );
  return { idempotent: false, bookingId: p.rental_booking_id as string, amountPaise: String(p.amount_paise) };
}

async function failDepositPayment(c: Client, actorId: string, paymentId: string, status: 'failed' | 'cancelled', reason: string | null) {
  const p = (await c.query(`SELECT status FROM payments WHERE id = $1 FOR UPDATE`, [paymentId])).rows[0];
  if (!p) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  if (p.status !== 'pending') throw new HttpError(409, 'PAYMENT_NOT_CANCELLABLE', `A ${p.status} payment cannot be marked ${status}`);
  await c.query(`UPDATE payments SET status = $2, recorded_by_user_id = $3, updated_at = now() WHERE id = $1`, [
    paymentId,
    status,
    actorId,
  ]);
  await c.query(`INSERT INTO payment_events (payment_id, event_type, payload) VALUES ($1, $2, $3::jsonb)`, [
    paymentId,
    status,
    JSON.stringify({ recordedBy: actorId, reason }),
  ]);
}

export async function handlePaymentsRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  const adminRoute = path.startsWith('/admin/payments');
  if (!adminRoute && !path.startsWith('/payments')) return null;

  const auth = extractBearerUser(request, requireJwtSecret(env));
  if (!auth) return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
  const ip = request.headers.get('CF-Connecting-IP');
  // '/payments/:id' or '/admin/payments/:id/:action'
  const parts = path.split('/');
  const [paymentId, action] = adminRoute ? [parts[3], parts[4]] : [parts[2], parts[3]];
  const requireAdmin = async (c: Client) => {
    if (!(await isAdmin(c, auth.userId))) throw new HttpError(403, 'FORBIDDEN', 'Admin role required');
  };

  try {
    // Renter opens a pending deposit payment. Amount is taken from the booking.
    if (path === '/payments' && method === 'POST') {
      const body = await readJson(request);
      if (body.paymentType !== 'deposit') {
        throw new HttpError(409, 'UNSUPPORTED_PAYMENT_TYPE', "Only paymentType 'deposit' is supported");
      }
      const bookingId = String(body.rentalBookingId ?? '');
      if (!UUID_RE.test(bookingId)) throw new HttpError(400, 'INVALID_INPUT', 'rentalBookingId must be a UUID');
      const idempotencyKey = optionalText(body.idempotencyKey, 255);

      const result = await withTx(env, ctx, (c) => createDepositPayment(c, auth.userId, bookingId, idempotencyKey));
      if (!result.existing) {
        recordEdgeAudit(env, ctx, 'DEPOSIT_PAYMENT_INITIATED', auth.userId, ip, { bookingId, paymentId: result.payment.id });
      }
      return jsonResponse({ data: result.payment }, result.existing ? 200 : 201, cors);
    }

    // Admin payment list for the reconciliation screen.
    if (path === '/admin/payments' && method === 'GET') {
      const status = new URL(request.url).searchParams.get('status');
      if (status && !['pending', 'succeeded', 'failed', 'cancelled'].includes(status)) {
        throw new HttpError(400, 'INVALID_INPUT', 'Unknown status filter');
      }
      const rows = await withDb(env, ctx, async (c) => {
        await requireAdmin(c);
        return (
          await c.query(
            `SELECT ${PAYMENT_COLS} FROM payments WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 100`,
            [status],
          )
        ).rows;
      });
      return jsonResponse({ data: rows }, 200, cors);
    }

    if (!paymentId || !UUID_RE.test(paymentId)) return null;

    // Renter, listing owner or admin can view a payment.
    if (!adminRoute && !action && method === 'GET') {
      const payment = await withDb(env, ctx, async (c) => {
        const row = (
          await c.query(
            `SELECT p.id, b.renter_user_id, l.owner_user_id FROM payments p
             LEFT JOIN rental_bookings b ON b.id = p.rental_booking_id
             LEFT JOIN listings l ON l.id = b.rental_listing_id
             WHERE p.id = $1`,
            [paymentId],
          )
        ).rows[0];
        if (!row) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
        const party = row.renter_user_id === auth.userId || row.owner_user_id === auth.userId;
        if (!party && !(await isAdmin(c, auth.userId))) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
        return loadPayment(c, paymentId);
      });
      return jsonResponse({ data: payment }, 200, cors);
    }

    // Admin confirms the money was received offline.
    if (adminRoute && action === 'settle' && method === 'POST') {
      const body = await readJson(request);
      const txnRef = optionalText(body.providerTransactionId, 255);
      const result = await withTx(env, ctx, async (c) => {
        await requireAdmin(c);
        const r = await confirmDeposit(c, auth.userId, paymentId, txnRef);
        return { ...r, payment: await loadPayment(c, paymentId) };
      });
      if (!result.idempotent) {
        recordEdgeAudit(env, ctx, 'DEPOSIT_PAYMENT_CONFIRMED', auth.userId, ip, { paymentId, bookingId: result.bookingId });
        emitQueueEvent(env, ctx, 'DEPOSIT_PAID', { paymentId, bookingId: result.bookingId, amountPaise: result.amountPaise, userId: auth.userId });
      }
      return jsonResponse({ data: result.payment }, 200, cors);
    }

    // Admin marks a pending payment failed or cancelled.
    if (adminRoute && action === 'fail' && method === 'POST') {
      const body = await readJson(request);
      const status = body.status === 'cancelled' ? 'cancelled' : 'failed';
      const reason = optionalText(body.reason, 500);
      const payment = await withTx(env, ctx, async (c) => {
        await requireAdmin(c);
        await failDepositPayment(c, auth.userId, paymentId, status, reason);
        return loadPayment(c, paymentId);
      });
      recordEdgeAudit(env, ctx, 'DEPOSIT_PAYMENT_FAILED', auth.userId, ip, { paymentId, status, reason });
      return jsonResponse({ data: payment }, 200, cors);
    }

    return null;
  } catch (err: any) {
    if (err instanceof HttpError) return jsonResponse({ error: { message: err.message, code: err.code } }, err.status, cors);
    if (err?.code === '23505') {
      return jsonResponse({ error: { message: 'Conflicting payment reference', code: 'CONFLICT' } }, 409, cors);
    }
    throw err;
  }
}
