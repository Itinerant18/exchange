import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { expectAmount, expectString, isUuid } from '../../utils/validators.js';
import * as repository from './deposits.repository.js';
import { insertRefund, sumActiveRefunds } from '../refunds/refunds.repository.js';

// ---------------------------------------------------------------------- read

function requireViewer(deposit, user) {
  if (deposit.renter_user_id === user.id || user.isAdmin) return;
  throw new AppError('You do not have access to this deposit.', { statusCode: 403, code: 'FORBIDDEN' });
}

export async function getDeposit(user, depositId) {
  if (!isUuid(depositId)) {
    throw new AppError('The deposit identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const deposit = await repository.findDepositById(depositId);
  if (!deposit) {
    throw new AppError('Deposit not found.', { statusCode: 404, code: 'DEPOSIT_NOT_FOUND' });
  }
  requireViewer(deposit, user);
  return repository.mapDepositRow(deposit);
}

export async function listMyDeposits(user, pagination) {
  return repository.listDepositsForUser(user.id, pagination);
}

// --------------------------------------------------------------------- admin

/**
 * Releases the un-deducted remainder of a held deposit. A refund record is
 * created so the money trail keeps track of the outgoing amount.
 */
export async function releaseDeposit(user, context, depositId) {
  if (!isUuid(depositId)) {
    throw new AppError('The deposit identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const result = await withTransaction(async (client) => {
    const deposit = await repository.findDepositById(depositId, client);
    if (!deposit) {
      throw new AppError('Deposit not found.', { statusCode: 404, code: 'DEPOSIT_NOT_FOUND' });
    }
    if (!['held', 'releasing'].includes(deposit.status)) {
      throw new AppError(`A deposit in status ${deposit.status} cannot be released.`, {
        statusCode: 409,
        code: 'DEPOSIT_NOT_RELEASEABLE',
      });
    }

    const remaining = Number(deposit.collected_amount_paise) - Number(deposit.deduction_amount_paise);
    if (remaining <= 0) {
      throw new AppError('The deposit was fully withheld; there is nothing to release.', {
        statusCode: 409,
        code: 'NOTHING_TO_RELEASE',
      });
    }

    const updated = await repository.setDepositOutcome(client, depositId, {
      status: 'released',
      fromStatuses: ['held', 'releasing'],
      released_at: new Date().toISOString(),
    });
    if (!updated) {
      throw new AppError('The deposit has already changed state.', { statusCode: 409, code: 'DEPOSIT_STATE_CONFLICT' });
    }

    // Refund record against the original deposit collection payment.
    const payment = await client.query(
      `SELECT id, amount_paise FROM public.payments
       WHERE rental_booking_id = $1 AND payment_type = 'deposit' AND direction = 'in' AND status = 'succeeded'
       ORDER BY created_at ASC LIMIT 1`,
      [deposit.rental_booking_id],
    );
    if (payment.rowCount > 0) {
      const alreadyActive = await sumActiveRefunds(client, payment.rows[0].id);
      const headroom = Number(payment.rows[0].amount_paise) - alreadyActive;
      const refundable = Math.min(remaining, headroom);
      if (refundable > 0) {
        await insertRefund(client, {
          payment_id: payment.rows[0].id,
          refund_amount_paise: refundable,
          reason: 'item_returned',
          created_by_user_id: user.id,
        });
      }
    }

    await writeAuditLog(client, {
      ...context,
      action: 'DEPOSIT_RELEASED',
      entityType: 'security_deposit',
      entityId: depositId,
      newValue: { releasedBy: user.id, remaining },
    });
    return repository.mapDepositRow({ ...updated, renter_user_id: deposit.renter_user_id });
  });
  return result;
}

/** Partial or full retention of held funds; requires a reason (DB checked). */
export async function deductDeposit(user, context, depositId, body) {
  if (!isUuid(depositId)) {
    throw new AppError('The deposit identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const amountPaise = expectAmount(body.amountPaise, 'amountPaise');
  if (amountPaise <= 0) {
    throw new AppError('amountPaise must be greater than zero to record a deduction.', { statusCode: 400 });
  }
  const reason = expectString(body.reason, 'reason', { min: 4, max: 500 });

  const result = await withTransaction(async (client) => {
    const deposit = await repository.findDepositById(depositId, client);
    if (!deposit) {
      throw new AppError('Deposit not found.', { statusCode: 404, code: 'DEPOSIT_NOT_FOUND' });
    }
    if (!['held', 'releasing'].includes(deposit.status)) {
      throw new AppError(`A deposit in status ${deposit.status} cannot be deducted.`, {
        statusCode: 409,
        code: 'DEPOSIT_NOT_DEDUCTABLE',
      });
    }
    const collected = Number(deposit.collected_amount_paise);
    const alreadyDeducted = Number(deposit.deduction_amount_paise);
    const newDeduction = alreadyDeducted + amountPaise;
    if (newDeduction > collected) {
      throw new AppError(`Deduction exceeds the collected amount (available headroom: ${collected - alreadyDeducted} paise).`, {
        statusCode: 409,
        code: 'DEDUCTION_EXCEEDS_COLLECTED',
      });
    }

    const newStatus = newDeduction === collected ? 'withheld' : deposit.status;
    const updated = await repository.setDepositOutcome(client, depositId, {
      status: newStatus,
      deduction_amount_paise: newDeduction,
      deduction_reason: reason,
      fromStatuses: ['held', 'releasing'],
    });
    if (!updated) {
      throw new AppError('The deposit has already changed state.', { statusCode: 409, code: 'DEPOSIT_STATE_CONFLICT' });
    }

    await writeAuditLog(client, {
      ...context,
      action: 'DEPOSIT_DEDUCTED',
      entityType: 'security_deposit',
      entityId: depositId,
      newValue: { amountPaise, reason, newStatus },
    });
    return repository.mapDepositRow({ ...updated, renter_user_id: deposit.renter_user_id });
  });
  return result;
}
