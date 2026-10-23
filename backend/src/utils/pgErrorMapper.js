// Maps PostgreSQL error codes/constraints to safe AppError responses so raw
// driver errors never leak constraint internals to the client.

import { AppError } from '../appErrors/AppError.js';

const CONSTRAINT_CODES = {
  users_email_unique: ['EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.'],
  user_profiles_user_id_key: ['PROFILE_ALREADY_EXISTS', 'A profile already exists for this user.'],
  categories_parent_name_unique: ['CATEGORY_NAME_TAKEN', 'A category with this name already exists under this parent.'],
  categories_slug_unique: ['CATEGORY_SLUG_TAKEN', 'A category with this slug already exists.'],
  listing_images_object_key_key: ['IMAGE_KEY_TAKEN', 'This image object is already used.'],
  listing_images_primary_unique: ['ONE_PRIMARY_IMAGE', 'The listing already has a primary image.'],
  user_addresses_default_unique: ['ONE_DEFAULT_ADDRESS', 'There is already a default address for this user.'],
  rental_booking_items_no_overlap: ['RENTAL_OVERLAP', 'The selected days are no longer available for this item.'],
  order_items_sale_claim: ['SALE_CLAIM_CONFLICT', 'This physical item has just been claimed by another order.'],
  payments_idempotency_key_unique: ['PAYMENT_IDEMPOTENCY_CONFLICT', 'A payment with this idempotency key already exists.'],
  payments_provider_txn_unique: ['PROVIDER_TRANSACTION_CONFLICT', 'This provider transaction reference is already recorded.'],
  payment_events_provider_event_unique: ['PAYMENT_EVENT_DUPLICATE', 'This provider event was already processed.'],
  security_deposits_one_row_per_booking: ['DEPOSIT_ALREADY_EXISTS', 'A security deposit already exists for this booking.'],
  reviews_rental_unique: ['DUPLICATE_REVIEW', 'You already reviewed this transaction.'],
  reviews_order_unique: ['DUPLICATE_REVIEW', 'You already reviewed this transaction.'],
  kyc_verifications_user_attempt_key: ['KYC_ATTEMPT_CONFLICT', 'A KYC attempt with this number already exists.'],
  user_roles_user_role_key: ['ROLE_ALREADY_ASSIGNED', 'This role is already assigned to the user.'],
};

const CONSTRAINT_NOT_NULL = {
  must_not_be_null: ['VALIDATION_ERROR', 'A required value was missing.'],
};

/**
 * Translates a pg error into an AppError, or null when the error is not one
 * we map (callers should rethrow). Pure function; no logging side effects.
 */
export function appErrorFromPg(error) {
  if (!error || typeof error.code !== 'string') return null;

  switch (error.code) {
    case '23505': { // unique_violation
      const mapping = CONSTRAINT_CODES[error.constraint];
      if (!mapping) return new AppError('The requested value already exists.', { statusCode: 409, code: 'CONFLICT', cause: error });
      return new AppError(mapping[1], { statusCode: 409, code: mapping[0], cause: error });
    }
    case '23P01': // exclusion_violation (rental overlap)
      return new AppError('The selected days conflict with an existing reservation.', {
        statusCode: 409,
        code: CONSTRAINT_CODES.rental_booking_items_no_overlap[0],
        cause: error,
      });
    case '23503': { // foreign_key_violation
      const mapping = CONSTRAINT_CODES[error.constraint];
      if (mapping) return new AppError(mapping[1], { statusCode: 409, code: mapping[0], cause: error });
      return new AppError('A referenced record does not exist.', {
        statusCode: 400,
        code: 'INVALID_REFERENCE',
        cause: error,
      });
    }
    case '23514': { // check_violation
      const mapping = CONSTRAINT_CODES[error.constraint];
      if (mapping) return new AppError(mapping[1], { statusCode: 409, code: mapping[0], cause: error });
      return new AppError('A field value is not allowed.', {
        statusCode: 400,
        code: 'INVALID_FIELD',
        cause: error,
      });
    }
    case '23502': { // not_null_violation
      const mapping = CONSTRAINT_NOT_NULL[error.detail?.includes('must not be null') ? 'must_not_be_null' : ''] ?? null;
      if (mapping) return new AppError(mapping[1], { statusCode: 400, code: mapping[0], cause: error });
      return new AppError('A required value was missing.', { statusCode: 400, code: 'VALIDATION_ERROR', cause: error });
    }
    default:
      return null;
  }
}

/**
 * Translates a pg error into an AppError and THROWS it; when the error is not
 * one we map, the original error is rethrown unchanged. Safe to use both as
 * `throw translatePgError(err)` inside catch blocks and directly as a
 * `.catch(translatePgError)` callback (which is why it must throw, never
 * return — returning would silently swallow rejections).
 */
export function translatePgError(error) {
  const mapped = appErrorFromPg(error);
  if (mapped) throw mapped;
  throw error;
}
