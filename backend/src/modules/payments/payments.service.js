import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import {
  markBookingConfirmedInTransaction,
  setBookingDepositPaidInTransaction,
} from '../rentals/rentals.service.js';
import { markOrderPaidInTransaction } from '../orders/orders.service.js';
import { isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './payments.repository.js';

// ------------------------------------------------------------------- intents

/**
 * Creates a pending payment for an authenticated participant. This NEVER
 * captures money and never changes business state — it is a record of an
 * intent (e.g. a manual transfer the buyer/renter will arrange). Settlement is
 * a separate, admin-recorded workflow (see settlePayment).
 */
export async function createPaymentIntent(user, context, body) {
  const paymentType = String(body.paymentType ?? '').trim().toLowerCase();

  // Idempotency keys are opaque strings; only a sane length is constrained.
  if (typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 200) {
    throw new AppError('idempotencyKey is too long.', { statusCode: 400 });
  }
  void context;

  if (paymentType === 'rental' || paymentType === 'deposit') {
    if (!isUuid(body.rentalBookingId)) {
      throw new AppError('rentalBookingId is required for rental and deposit payments.', { statusCode: 400, code: 'INVALID_ID' });
    }
    return createBookingPayment(user, paymentType, body);
  }
  if (paymentType === 'sale') {
    if (!isUuid(body.orderId)) {
      throw new AppError('orderId is required for sale payments.', { statusCode: 400, code: 'INVALID_ID' });
    }
    return createOrderPayment(user, body);
  }
  throw new AppError('paymentType must be one of: rental, deposit, sale.', { statusCode: 400 });
}

async function resolveMyBooking(user, bookingId) {
  const { rows } = await withTransaction((client) => client.query(
    `SELECT id, status, subtotal_amount_paise, deposit_amount_paise, total_amount_paise, deposit_paid
     FROM public.rental_bookings WHERE id = $1 AND renter_user_id = $2 LIMIT 1`,
    [bookingId, user.id],
  ));
  return rows[0] ?? null;
}

async function resolveMyOrder(user, orderId) {
  const { rows } = await withTransaction((client) => client.query(
    `SELECT id, status, total_amount_paise FROM public.orders
     WHERE id = $1 AND buyer_user_id = $2 LIMIT 1`,
    [orderId, user.id],
  ));
  return rows[0] ?? null;
}

async function createBookingPayment(user, paymentType, body) {
  const booking = await resolveMyBooking(user, body.rentalBookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  // Rental charge precedes confirmation; the deposit may be collected while
  // pending or after confirmation, always before handover.
  const payableStates = paymentType === 'rental' ? ['pending'] : ['pending', 'confirmed'];
  if (!payableStates.includes(booking.status)) {
    throw new AppError(`A ${paymentType} payment can no longer be initiated for a ${booking.status} booking.`, {
      statusCode: 409,
      code: 'BOOKING_NOT_PAYABLE',
    });
  }

  // Idempotency replay resolves to the original payment before any guards.
  if (body.idempotencyKey) {
    const existing = await repository.findPaymentByIdempotencyKey(body.idempotencyKey);
    if (existing) return { existing: true, payment: repository.mapPaymentRow(existing) };
  }

  const amount = paymentType === 'rental' ? Number(booking.subtotal_amount_paise) : Number(booking.deposit_amount_paise);
  if (amount <= 0) {
    throw new AppError('No payment is required for this component of the booking.', {
      statusCode: 409,
      code: 'NO_PAYMENT_REQUIRED',
    });
  }

  // A duplicate settled charge must always be refused: use succeeded payments as source of truth.
  const existingPayments = await repository.listPaymentsForEntity({ rentalBookingId: booking.id }, { statuses: ['pending', 'succeeded'] });
  if (existingPayments.some((payment) => payment.payment_type === paymentType && ['pending', 'succeeded'].includes(payment.status))) {
    throw new AppError('An equivalent payment already exists for this booking.', {
      statusCode: 409,
      code: 'PAYMENT_ALREADY_EXISTS',
    });
  }

  if (paymentType === 'deposit') {
    const existingDeposit = await withTransaction((client) => client.query(
      `SELECT 1 FROM public.security_deposits WHERE rental_booking_id = $1 LIMIT 1`,
      [booking.id],
    ));
    if (existingDeposit.rowCount > 0) {
      throw new AppError('A security deposit already exists for this booking.', {
        statusCode: 409,
        code: 'DEPOSIT_ALREADY_EXISTS',
      });
    }
  }

  return withTransaction(async (client) => {
    const inserted = await repository.insertPayment(client, {
      rental_booking_id: booking.id,
      order_id: null,
      payment_type: paymentType,
      direction: 'in',
      amount_paise: amount,
      provider: null,
      idempotency_key: body.idempotencyKey ?? null,
    });
    await repository.writePaymentEvent(client, {
      payment_id: inserted.id,
      event_type: 'initiated',
      amount_paise: amount,
      payload: { paymentType, createdBy: user.id },
    });
    return { existing: false, payment: repository.mapPaymentRow(await repository.findPaymentById(inserted.id, client)) };
  }).catch(translatePgError);
}

async function createOrderPayment(user, body) {
  const order = await resolveMyOrder(user, body.orderId);
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  if (order.status !== 'pending') {
    throw new AppError('Payments can only be initiated for pending orders.', {
      statusCode: 409,
      code: 'ORDER_NOT_PAYABLE',
    });
  }

  // Idempotency replay resolves to the original payment before any guards.
  if (body.idempotencyKey) {
    const existing = await repository.findPaymentByIdempotencyKey(body.idempotencyKey);
    if (existing) return { existing: true, payment: repository.mapPaymentRow(existing) };
  }

  const amount = Number(order.total_amount_paise);
  if (amount <= 0) {
    throw new AppError('No payment is required for this order.', { statusCode: 409, code: 'NO_PAYMENT_REQUIRED' });
  }

  const existingPayments = await repository.listPaymentsForEntity({ orderId: order.id }, { statuses: ['pending', 'succeeded'] });
  if (existingPayments.some((payment) => payment.payment_type === 'sale' && ['pending', 'succeeded'].includes(payment.status))) {
    throw new AppError('An equivalent payment already exists for this order.', {
      statusCode: 409,
      code: 'PAYMENT_ALREADY_EXISTS',
    });
  }

  return withTransaction(async (client) => {
    const inserted = await repository.insertPayment(client, {
      order_id: order.id,
      payment_type: 'sale',
      direction: 'in',
      amount_paise: amount,
      idempotency_key: body.idempotencyKey ?? null,
    });
    await repository.writePaymentEvent(client, {
      payment_id: inserted.id,
      event_type: 'initiated',
      amount_paise: amount,
      payload: { paymentType: 'sale', createdBy: user.id },
    });
    return { existing: false, payment: repository.mapPaymentRow(await repository.findPaymentById(inserted.id, client)) };
  }).catch(translatePgError);
}

// ---------------------------------------------------------------------- read

export async function getPayment(user, paymentId) {
  const payment = await repository.findPaymentById(paymentId);
  if (!payment) {
    throw new AppError('Payment not found.', { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  }
  const users = await repository.findEntityUsers({
    rentalBookingId: payment.rental_booking_id ?? null,
    orderId: payment.order_id ?? null,
  });
  const isParticipant = users && (users.payerId === user.id
    || (users.listingOwnerType === 'SELLER' && users.listingOwnerId === user.id));
  if (!isParticipant && !user.isAdmin) {
    throw new AppError('You do not have access to this payment.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  const events = await repository.findPaymentEvents(paymentId);
  return {
    ...repository.mapPaymentRow(payment),
    events: events.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      providerEventId: row.provider_event_id ?? null,
      amountPaise: row.amount_paise === null ? null : Number(row.amount_paise),
      occurredAt: row.occurred_at,
    })),
  };
}

export async function listMyPayments(user, pagination) {
  return repository.listPaymentsForUser(user.id, pagination);
}

// ----------------------------------------------------------------- settlement

/**
 * Manual/offline settlement recorded by an administrator (e.g. a bank/UPI
 * transfer verified by staff). This NEVER calls a real payment provider; it
 * records the settlement and applies the business effects transactionally:
 *   rental  → booking pending → confirmed (+ history)
 *   deposit → booking.deposit_paid + security_deposits row (held)
 *   sale    → order pending → paid, units SALE_PENDING → SOLD
 * It is idempotent: repeating the same providerTransactionId returns the same
 * settled payment; a different reference on a settled payment conflicts.
 */
export async function settlePayment(user, context, paymentId, body) {
  const providerTransactionId = typeof body?.providerTransactionId === 'string' && body.providerTransactionId.trim()
    ? body.providerTransactionId.trim().slice(0, 255)
    : null;

  const result = await withTransaction(async (client) => {
    const payment = await repository.findPaymentById(paymentId, client);
    if (!payment) {
      throw new AppError('Payment not found.', { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    }

    if (payment.status === 'succeeded') {
      if (providerTransactionId && payment.provider_transaction_id === providerTransactionId) {
        return { idempotent: true, payment };
      }
      throw new AppError('This payment has already been settled.', { statusCode: 409, code: 'ALREADY_SETTLED' });
    }
    if (payment.status !== 'pending') {
      throw new AppError(`A payment in status ${payment.status} cannot be settled.`, {
        statusCode: 409,
        code: 'PAYMENT_NOT_SETTLEABLE',
      });
    }

    const updated = await repository.updatePaymentStatus(client, paymentId, {
      fromStatus: ['pending'],
      toStatus: 'succeeded',
      provider: payment.provider ?? 'manual',
      providerTransactionId,
    });
    if (!updated) {
      throw new AppError('The payment has already changed state.', { statusCode: 409, code: 'PAYMENT_STATE_CONFLICT' });
    }

    await repository.writePaymentEvent(client, {
      payment_id: paymentId,
      event_type: 'succeeded',
      provider_event_id: providerTransactionId,
      amount_paise: Number(payment.amount_paise),
      payload: { settledBy: user.id, mode: 'manual_offline' },
    });

    if (payment.payment_type === 'rental') {
      await markBookingConfirmedInTransaction(client, payment.rental_booking_id, user.id);
    } else if (payment.payment_type === 'deposit') {
      const flagMoved = await setBookingDepositPaidInTransaction(client, payment.rental_booking_id);
      void flagMoved;
      await client.query(
        `INSERT INTO public.security_deposits (rental_booking_id, status, collected_amount_paise)
         VALUES ($1, 'held', $2)
         ON CONFLICT (rental_booking_id) DO NOTHING`,
        [payment.rental_booking_id, Number(payment.amount_paise)],
      );
    } else if (payment.payment_type === 'sale') {
      await markOrderPaidInTransaction(client, payment.order_id, user.id, { userId: user.id, ipAddress: context?.ipAddress ?? null, userAgent: context?.userAgent ?? null });
    }

    await writeAuditLog(client, {
      userId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      action: 'PAYMENT_SETTLED',
      entityType: 'payment',
      entityId: paymentId,
      newValue: { paymentType: payment.payment_type, amountPaise: Number(payment.amount_paise), mode: 'manual_offline' },
    });

    return { idempotent: false, payment: await repository.findPaymentById(paymentId, client) };
  }).catch(translatePgError);

  return { idempotent: result.idempotent, payment: repository.mapPaymentRow(result.payment) };
}

/** Records a failed/cancelled terminal state on a pending payment. */
export async function failSettlement(user, context, paymentId, body) {
  const failStatus = body?.status === 'cancelled' ? 'cancelled' : 'failed';
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  await withTransaction(async (client) => {
    const payment = await repository.findPaymentById(paymentId, client);
    if (!payment) {
      throw new AppError('Payment not found.', { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    }
    if (payment.status !== 'pending') {
      throw new AppError(`A payment in status ${payment.status} cannot be failed.`, {
        statusCode: 409,
        code: 'PAYMENT_NOT_CANCELLABLE',
      });
    }
    const updated = await repository.updatePaymentStatus(client, paymentId, {
      fromStatus: ['pending'],
      toStatus: failStatus,
    });
    if (!updated) {
      throw new AppError('The payment has already changed state.', { statusCode: 409, code: 'PAYMENT_STATE_CONFLICT' });
    }
    await repository.writePaymentEvent(client, {
      payment_id: paymentId,
      event_type: failStatus,
      payload: { recordedBy: user.id, reason },
    });
    await writeAuditLog(client, {
      userId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      action: 'PAYMENT_FAILED',
      entityType: 'payment',
      entityId: paymentId,
      newValue: { failStatus, reason },
    });
  }).catch(translatePgError);
}
