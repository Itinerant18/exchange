import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { isUuid } from '../../utils/validators.js';
import * as repository from './disputes.repository.js';
import * as rentalsRepository from '../rentals/rentals.repository.js';

const TYPES = ['late_return', 'damage', 'missing_item', 'quality_issue', 'refund', 'other'];

export async function openDispute(user, context, body) {
  const type = String(body?.disputeType ?? '').trim().toLowerCase();
  if (!TYPES.includes(type)) {
    throw new AppError(`disputeType must be one of: ${TYPES.join(', ')}.`, { statusCode: 400 });
  }
  const description = String(body?.description ?? '').trim();
  if (description.length < 5 || description.length > 2000) {
    throw new AppError('description must be between 5 and 2000 characters.', { statusCode: 400 });
  }
  const hasBooking = isUuid(body?.rentalBookingId);
  const hasOrder = isUuid(body?.orderId);
  if (hasBooking === hasOrder) {
    throw new AppError('Provide exactly one of rentalBookingId or orderId.', { statusCode: 400 });
  }

  // Participant check.
  let againstUserId = null;
  if (hasBooking) {
    const booking = await rentalsRepository.findBookingById(body.rentalBookingId);
    if (!booking) throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    const isRenter = booking.renter_user_id === user.id;
    const isProvider = booking.listing_owner_type === 'SELLER' && booking.listing_owner_id === user.id;
    if (!isRenter && !isProvider && !user.isAdmin) {
      throw new AppError('You do not have access to this booking.', { statusCode: 403, code: 'FORBIDDEN' });
    }
    againstUserId = isRenter ? booking.listing_owner_id : booking.renter_user_id;
  }

  const evidence = Array.isArray(body?.evidenceUrls)
    ? body.evidenceUrls.filter((u) => typeof u === 'string' && u.length > 3).slice(0, 10)
    : [];

  return withTransaction(async (client) => {
    const row = await repository.insertDispute(client, {
      rental_booking_id: hasBooking ? body.rentalBookingId : null,
      order_id: hasOrder ? body.orderId : null,
      opened_by_user_id: user.id,
      against_user_id: againstUserId,
      dispute_type: type,
      description,
      evidence_urls: evidence,
    });
    await writeAuditLog(client, {
      ...context,
      action: 'DISPUTE_OPENED',
      entityType: 'dispute',
      entityId: row.id,
      newValue: { type, hasBooking, hasOrder },
    });
    return repository.mapDisputeRow(row);
  }).catch((e) => { throw e; });
}

export async function listMyDisputes(user, pagination) {
  const { rows, total } = await repository.listDisputesForUser(user.id, pagination);
  return { rows: rows.map(repository.mapDisputeRow), total };
}

export async function getDispute(user, id) {
  if (!isUuid(id)) throw new AppError('The dispute identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  const row = await repository.findDisputeById(id);
  if (!row) throw new AppError('Dispute not found.', { statusCode: 404, code: 'DISPUTE_NOT_FOUND' });
  const isParticipant = row.opened_by_user_id === user.id || row.against_user_id === user.id;
  if (!isParticipant && !user.isAdmin) {
    throw new AppError('You do not have access to this dispute.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return repository.mapDisputeRow(row);
}

export async function listDisputesForAdmin(query, pagination) {
  const status = query.status === undefined ? undefined : String(query.status).trim().toLowerCase();
  const { rows, total } = await repository.listDisputesForAdmin({ status }, pagination);
  return { rows: rows.map(repository.mapDisputeRow), total };
}

export async function resolveDispute(user, context, id, body) {
  if (!user.isAdmin) throw new AppError('You do not have permission to perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  if (!isUuid(id)) throw new AppError('The dispute identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  const outcome = String(body?.outcome ?? '').trim().toLowerCase();
  if (!['resolve', 'reject'].includes(outcome)) {
    throw new AppError("outcome must be 'resolve' or 'reject'.", { statusCode: 400 });
  }
  const resolution = String(body?.resolution ?? '').trim();
  if (resolution.length < 5 || resolution.length > 2000) {
    throw new AppError('resolution must be between 5 and 2000 characters.', { statusCode: 400 });
  }
  const toStatus = outcome === 'resolve' ? 'resolved' : 'rejected';
  return withTransaction(async (client) => {
    const row = await repository.resolveDispute(client, id, {
      status: toStatus,
      resolution,
      resolvedBy: user.id,
    });
    if (!row) {
      throw new AppError('The dispute has already been decided or does not exist.', { statusCode: 409, code: 'DISPUTE_STATE_CONFLICT' });
    }
    await writeAuditLog(client, {
      ...context,
      action: 'DISPUTE_RESOLVED',
      entityType: 'dispute',
      entityId: id,
      newValue: { outcome, resolution },
    });
    return { id: row.id, status: row.status, resolution: row.resolution, resolvedAt: row.resolved_at };
  });
}
