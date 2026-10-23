import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { expectEnum, expectString, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './kyc.repository.js';

const TYPES = ['aadhaar', 'pan', 'passport', 'driver_license'];

/**
 * Creates a self-service verification attempt. Identifiers are NEVER stored —
 * only provider references and object-storage links live in the database.
 */
export async function createMyAttempt(user, context, body) {
  const verificationType = expectEnum(body.verificationType, 'verificationType', TYPES).toLowerCase();
  const provider = body.provider === undefined || body.provider === null
    ? null
    : expectString(body.provider, 'provider', { min: 2, max: 100 });
  const providerReference = body.providerReference === undefined || body.providerReference === null
    ? null
    : expectString(body.providerReference, 'providerReference', { min: 4, max: 255 });
  const documentUrl = body.documentUrl === undefined || body.documentUrl === null
    ? null
    : expectString(body.documentUrl, 'documentUrl', { min: 5, max: 500 });

  try {
    const created = await withTransaction(async (client) => {
      const latest = await repository.getLatestAttemptNumber(client, user.id);
      const row = await repository.insertKycAttempt(client, {
        user_id: user.id,
        verification_type: verificationType,
        provider,
        provider_reference: providerReference,
        document_url: documentUrl,
        attempt_number: latest + 1,
      });
      await writeAuditLog(client, {
        ...context,
        action: 'KYC_ATTEMPT_CREATED',
        entityType: 'kyc_verification',
        entityId: row.id,
        newValue: { verificationType },
      });
      return row;
    });
    return { id: created.id, attemptNumber: created.attempt_number, createdAt: created.created_at };
  } catch (error) {
    throw translatePgError(error);
  }
}

export async function listMyKyc(user, pagination) {
  return repository.listKycForUser(user.id, pagination);
}

export async function listKycForAdmin(query, pagination) {
  const status = query.status === undefined ? undefined
    : expectEnum(query.status, 'status', ['pending', 'verified', 'rejected', 'expired']).toLowerCase();
  return repository.listKycForAdmin({ status }, pagination);
}

/**
 * Admin review. Self-review is blocked; review transitions come only from pending.
 */
export async function reviewKyc(user, context, kycId, body) {
  if (!isUuid(kycId)) {
    throw new AppError('The KYC identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const status = expectEnum(body.status, 'status', ['verified', 'rejected']).toLowerCase();
  const rejectionReason = body.rejectionReason === undefined || body.rejectionReason === null
    ? null
    : expectString(body.rejectionReason, 'rejectionReason', { min: 4, max: 1000 });
  if (status === 'rejected' && rejectionReason === null) {
    throw new AppError('rejectionReason is required to reject a verification.', { statusCode: 400 });
  }

  const updated = await withTransaction(async (client) => {
    const attempt = await repository.findKycById(kycId, client);
    if (!attempt) {
      throw new AppError('KYC verification not found.', { statusCode: 404, code: 'KYC_NOT_FOUND' });
    }
    if (attempt.user_id === user.id) {
      throw new AppError('Administrators cannot review their own KYC attempt.', { statusCode: 403, code: 'SELF_REVIEW_FORBIDDEN' });
    }
    if (attempt.status !== 'pending') {
      throw new AppError(`This attempt is already ${attempt.status}.`, { statusCode: 409, code: 'KYC_ALREADY_REVIEWED' });
    }
    const row = await repository.reviewKycAttempt(client, kycId, {
      status,
      reviewed_by_user_id: user.id,
      rejection_reason: rejectionReason,
    });
    if (!row) {
      throw new AppError('The attempt has already changed state.', { statusCode: 409, code: 'KYC_STATE_CONFLICT' });
    }
    await writeAuditLog(client, {
      ...context,
      action: 'KYC_REVIEWED',
      entityType: 'kyc_verification',
      entityId: kycId,
      newValue: { status, reviewedBy: user.id },
    });
    return row;
  });
  return repository.mapKycRow(updated);
}
