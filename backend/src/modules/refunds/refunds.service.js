import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { expectAmount, expectEnum, isUuid } from '../../utils/validators.js';
import * as repository from './refunds.repository.js';
import * as paymentsRepository from '../payments/payments.repository.js';
import { insertRefund, sumActiveRefunds } from './refunds.repository.js';

const REASONS = ['customer_request', 'item_returned', 'quality_issue', 'duplicate_charge', 'cancellation', 'platform_initiated'];

export async function createRefund(user, context, body) {
  if (!isUuid(body.paymentId)) {
    throw new AppError('paymentId must be a valid payment identifier.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const reason = expectEnum(body.reason, 'reason', REASONS).toLowerCase();
  const requestedAmount = body.amountPaise === undefined ? undefined : expectAmount(body.amountPaise, 'amountPaise');

  const refund = await withTransaction(async (client) => {
    const payment = await paymentsRepository.findPaymentById(body.paymentId, client);
    if (!payment) {
      throw new AppError('Payment not found.', { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    }
    if (payment.status !== 'succeeded' || payment.direction !== 'in') {
      throw new AppError('Only successful incoming payments can be refunded.', {
        statusCode: 409,
        code: 'PAYMENT_NOT_REFUNDABLE',
      });
    }

    const alreadyRefunded = await sumActiveRefunds(client, payment.id);
    const maxRefundable = Number(payment.amount_paise) - alreadyRefunded;
    if (maxRefundable <= 0) {
      throw new AppError('This payment has already been fully refunded.', {
        statusCode: 409,
        code: 'PAYMENT_FULLY_REFUNDED',
      });
    }
    const amount = requestedAmount === undefined ? maxRefundable : Math.min(requestedAmount, maxRefundable);
    if (amount < 1) {
      throw new AppError(`The remaining refundable amount is ${maxRefundable} paise.`, {
        statusCode: 409,
        code: 'REFUND_AMOUNT_TOO_LOW',
      });
    }

    const created = await insertRefund(client, {
      payment_id: payment.id,
      refund_amount_paise: amount,
      reason,
      created_by_user_id: user.id,
    });
    await writeAuditLog(client, {
      ...context,
      action: 'REFUND_CREATED',
      entityType: 'refund',
      entityId: created.id,
      newValue: { paymentId: payment.id, amountPaise: amount, reason },
    });
    return created;
  });

  return { id: refund.id, status: refund.status };
}

export async function settleRefund(user, context, refundId, outcome) {
  if (!isUuid(refundId)) {
    throw new AppError('The refund identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const toStatus = outcome === 'succeeded' ? 'succeeded' : 'failed';

  await withTransaction(async (client) => {
    const refund = await repository.findRefundById(refundId, client);
    if (!refund) {
      throw new AppError('Refund not found.', { statusCode: 404, code: 'REFUND_NOT_FOUND' });
    }
    if (refund.status !== 'pending') {
      throw new AppError(`A refund in status ${refund.status} cannot be settled.`, {
        statusCode: 409,
        code: 'REFUND_NOT_SETTLEABLE',
      });
    }
    const moved = await repository.transitionRefundStatus(client, refundId, { toStatus });
    if (!moved) {
      throw new AppError('The refund has already changed state.', { statusCode: 409, code: 'REFUND_STATE_CONFLICT' });
    }

    await paymentsRepository.writePaymentEvent(client, {
      payment_id: refund.payment_id,
      event_type: toStatus === 'succeeded' ? 'refund_succeeded' : 'refund_failed',
      amount_paise: Number(refund.refund_amount_paise),
      payload: { refundId, recordedBy: user.id, mode: 'manual_offline' },
    });

    await writeAuditLog(client, {
      ...context,
      action: toStatus === 'succeeded' ? 'REFUND_SUCCEEDED' : 'REFUND_FAILED',
      entityType: 'refund',
      entityId: refundId,
      newValue: { paymentId: refund.payment_id, amountPaise: Number(refund.refund_amount_paise) },
    });
  });
}

export async function listRefundsForAdmin(query, pagination) {
  const status = query.status === undefined ? undefined
    : expectEnum(query.status, 'status', ['pending', 'succeeded', 'failed', 'cancelled']).toLowerCase();
  return repository.listRefundsForAdmin({ status: status === 'all' ? undefined : status }, pagination);
}

export async function getRefund(user, refundId) {
  const refund = await repository.findRefundById(refundId);
  if (!refund) {
    throw new AppError('Refund not found.', { statusCode: 404, code: 'REFUND_NOT_FOUND' });
  }
  const entityUsers = await paymentsRepository.findEntityUsers({
    rentalBookingId: refund.rental_booking_id ?? null,
    orderId: refund.order_id ?? null,
  });
  const isParticipant = entityUsers && entityUsers.payerId === user.id;
  if (!isParticipant && !user.isAdmin) {
    throw new AppError('You do not have access to this refund.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return repository.mapRefundRow(refund);
}
