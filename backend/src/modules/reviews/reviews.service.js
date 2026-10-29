import { AppError } from '../../appErrors/AppError.js';
import { pool, withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { expectEnum, expectInt, expectString, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './reviews.repository.js';

const BODY_TYPES = ['petite', 'slim', 'average', 'athletic', 'curvy', 'plus_size'];
const FIT_RATINGS = ['RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'];

// ---------------------------------------------------------------------- read

export async function getPublicReview(user = null, reviewId) {
  const review = await repository.findReviewById(reviewId);
  if (!review) {
    throw new AppError('Review not found.', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
  }
  const isPrivileged = Boolean(user) && (review.reviewer_user_id === user.id
    || review.reviewee_user_id === user.id
    || user.isAdmin === true);
  if (review.status !== 'published' && !isPrivileged) {
    throw new AppError('Review not found.', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
  }
  return mapReviewDetail(review);
}

export async function listReviewsForUser(revieweeUserId, query, pagination) {
  if (!isUuid(revieweeUserId)) {
    throw new AppError('The user identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const minRating = query.minRating === undefined ? 1 : expectInt(Number(query.minRating), 'minRating', { min: 1, max: 5 });
  const { rows, total } = await repository.listPublicReviewsForUser(revieweeUserId, { minRating, ...pagination });
  const reputation = await repository.getReputation(revieweeUserId);
  return { rows: rows.map(mapPublicRow), total, reputation };
}

/**
 * 'Our Runway' reviews for a single listing plus the fit-meter aggregate.
 * Only the listing's own active status gates visibility (read through the
 * listing module's loader); review rows are published ones only.
 */
export async function listReviewsForListing(listingId, pagination) {
  if (!isUuid(listingId)) {
    throw new AppError('The listing identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const { rows, total, fitStats } = await repository.listPublishedReviewsForListing(listingId, pagination);
  return { rows: rows.map(mapListingReviewRow), total, fitStats };
}

export async function listMyWritten(user, pagination) {
  const { rows, total } = await repository.listReviewsByAuthor(user.id, pagination);
  return { rows, total };
}

// --------------------------------------------------------------------- write

/**
 * Review creation is derived from a qualifying transaction the reviewer took
 * part in. Sides:
 *   rental bookings: 'as_renter' (renter -> provider owner) | 'as_provider'
 *   orders:          'as_buyer'   (buyer -> seller owner)
 * Platform-owned listings cannot generate provider-side reviews (there is no
 * platform user) and that limitation is documented.
 */
export async function createReview(user, context, body) {
  const side = expectEnum(body.side, 'side', ['as_renter', 'as_provider', 'as_buyer']).toLowerCase();
  const rating = expectInt(body.rating, 'rating', { min: 1, max: 5 });
  const comment = body.comment === undefined || body.comment === null
    ? null
    : expectString(body.comment, 'comment', { min: 1, max: 2000 });

  // Optional reviewer body specs ("Our Runway" fields). Everything is
  // nullable; provided values must fall inside sane human ranges.
  const sizeWorn = body.sizeWorn === undefined || body.sizeWorn === null
    ? null
    : expectString(body.sizeWorn, 'sizeWorn', { min: 1, max: 50 });
  const heightCm = body.reviewerHeightCm === undefined || body.reviewerHeightCm === null
    ? null
    : expectInt(Number(body.reviewerHeightCm), 'reviewerHeightCm', { min: 100, max: 250 });
  const weightKg = body.reviewerWeightKg === undefined || body.reviewerWeightKg === null
    ? null
    : expectInt(Number(body.reviewerWeightKg), 'reviewerWeightKg', { min: 25, max: 300 });
  const bustSize = body.bustSize === undefined || body.bustSize === null
    ? null
    : expectString(body.bustSize, 'bustSize', { min: 1, max: 20 });
  const bodyType = body.bodyType === undefined || body.bodyType === null
    ? null
    : expectEnum(body.bodyType, 'bodyType', BODY_TYPES).toLowerCase();
  const fitRating = body.fitRating === undefined || body.fitRating === null
    ? null
    : expectEnum(body.fitRating, 'fitRating', FIT_RATINGS);

  const hasBooking = body.qualifyingRentalBookingId !== undefined && body.qualifyingRentalBookingId !== null;
  const hasOrder = body.qualifyingOrderId !== undefined && body.qualifyingOrderId !== null;
  if (hasBooking === hasOrder) {
    throw new AppError('Provide exactly one of qualifyingRentalBookingId or qualifyingOrderId.', { statusCode: 400 });
  }
  if (hasBooking && !isUuid(body.qualifyingRentalBookingId)) {
    throw new AppError('qualifyingRentalBookingId is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  if (hasOrder && !isUuid(body.qualifyingOrderId)) {
    throw new AppError('qualifyingOrderId is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }

  let revieweeId;
  let groupId;
  if (hasBooking) {
    revieweeId = await resolveRentalParticipant(user, body.qualifyingRentalBookingId, side);
    groupId = body.qualifyingRentalBookingId;
  } else {
    revieweeId = await resolveOrderParticipant(user, body.qualifyingOrderId, side);
    groupId = body.qualifyingOrderId;
  }

  try {
    const created = await withTransaction(async (client) => {
      const row = await repository.insertReview(client, {
        reviewer_user_id: user.id,
        reviewee_user_id: revieweeId,
        qualifying_rental_booking_id: hasBooking ? body.qualifyingRentalBookingId : null,
        qualifying_order_id: hasOrder ? body.qualifyingOrderId : null,
        rating,
        comment,
        size_worn: sizeWorn,
        reviewer_height_cm: heightCm,
        reviewer_weight_kg: weightKg,
        bust_size: bustSize,
        body_type: bodyType,
        fit_rating: fitRating,
      });
      await writeAuditLog(client, {
        ...context,
        action: 'REVIEW_CREATED',
        entityType: 'review',
        entityId: row.id,
        newValue: { transactionId: groupId, rating, fitRating },
      });
      return row;
    });
    return { id: created.id, status: created.status, createdAt: created.created_at };
  } catch (error) {
    throw translatePgError(error);
  }
}

async function resolveRentalParticipant(user, bookingId, side) {
  const { rows } = await pool.query(
    `SELECT id, renter_user_id, status,
            (SELECT owner_type FROM public.listings l WHERE l.id = rb.rental_listing_id) AS owner_type,
            (SELECT owner_user_id FROM public.listings l WHERE l.id = rb.rental_listing_id) AS owner_user_id
     FROM public.rental_bookings rb
     WHERE rb.id = $1 LIMIT 1`,
    [bookingId],
  );
  const booking = rows[0];
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  if (booking.status !== 'completed') {
    throw new AppError('Only completed rentals qualify for reviews.', { statusCode: 409, code: 'RENTAL_NOT_COMPLETED' });
  }

  if (side === 'as_renter') {
    if (booking.renter_user_id !== user.id) {
      throw new AppError('Only the renter of this booking can review the provider.', { statusCode: 403, code: 'FORBIDDEN' });
    }
    if (booking.owner_type !== 'SELLER' || !booking.owner_user_id) {
      throw new AppError('Only user-owned inventory can be reviewed.', { statusCode: 422, code: 'REVIEWEE_NOT_REVIEWABLE' });
    }
    return booking.owner_user_id;
  }
  // as_provider
  if (booking.owner_type !== 'SELLER' || booking.owner_user_id !== user.id) {
    throw new AppError('Only the provider of this rental can review the renter.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return booking.renter_user_id;
}

async function resolveOrderParticipant(user, orderId, side) {
  const { rows: orderRows } = await pool.query(
    `SELECT id, buyer_user_id, status FROM public.orders WHERE id = $1 LIMIT 1`,
    [orderId],
  );
  const order = orderRows[0];
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  if (order.status !== 'paid') {
    throw new AppError('Only paid orders qualify for reviews.', { statusCode: 409, code: 'ORDER_NOT_PAID' });
  }
  if (side !== 'as_buyer') {
    throw new AppError('Order reviews use side "as_buyer".', { statusCode: 400 });
  }
  if (order.buyer_user_id !== user.id) {
    throw new AppError('Only the buyer of this order can review the seller.', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const { rows: ownerRows } = await pool.query(
    `SELECT DISTINCT l.owner_type, l.owner_user_id
     FROM public.order_items oi JOIN public.listings l ON l.id = oi.listing_id
     WHERE oi.order_id = $1`,
    [orderId],
  );
  const sellerOwner = ownerRows.find((row) => row.owner_type === 'SELLER' && row.owner_user_id);
  if (!sellerOwner) {
    throw new AppError('Only user-owned inventory can be reviewed.', { statusCode: 422, code: 'REVIEWEE_NOT_REVIEWABLE' });
  }
  return sellerOwner.owner_user_id;
}

function mapListingReviewRow(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment ?? null,
    reviewerDisplayName: row.reviewer_display_name ?? null,
    sizeWorn: row.size_worn ?? null,
    reviewerHeightCm: row.reviewer_height_cm === null || row.reviewer_height_cm === undefined ? null : Number(row.reviewer_height_cm),
    reviewerWeightKg: row.reviewer_weight_kg === null || row.reviewer_weight_kg === undefined ? null : Number(row.reviewer_weight_kg),
    bustSize: row.bust_size ?? null,
    bodyType: row.body_type ?? null,
    fitRating: row.fit_rating ?? null,
    createdAt: row.created_at,
  };
}

// -------------------------------------------------------------- moderation

export async function moderateReview(user, context, reviewId, body) {
  const status = expectEnum(body.status, 'status', ['published', 'hidden']).toLowerCase();
  const moved = await withTransaction(async (client) => {
    const movedRow = await repository.setReviewStatus(client, reviewId, status);
    if (movedRow) {
      await writeAuditLog(client, {
        ...context,
        action: 'REVIEW_MODERATED',
        entityType: 'review',
        entityId: reviewId,
        newValue: { status },
      });
    }
    return movedRow;
  });
  if (!moved) {
    throw new AppError('Review not found.', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
  }
  return { id: reviewId, status };
}

export async function deleteReview(user, reviewId) {
  if (!isUuid(reviewId)) {
    throw new AppError('The review identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const deleted = await withTransaction((client) => repository.deleteReview(reviewId, user, client));
  if (!deleted) {
    throw new AppError('Review not found.', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
  }
}

function mapPublicRow(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment ?? null,
    reviewerDisplayName: row.reviewer_display_name ?? null,
    qualifyingRentalBookingId: row.qualifying_rental_booking_id ?? null,
    qualifyingOrderId: row.qualifying_order_id ?? null,
    sizeWorn: row.size_worn ?? null,
    reviewerHeightCm: row.reviewer_height_cm === null || row.reviewer_height_cm === undefined ? null : Number(row.reviewer_height_cm),
    reviewerWeightKg: row.reviewer_weight_kg === null || row.reviewer_weight_kg === undefined ? null : Number(row.reviewer_weight_kg),
    bustSize: row.bust_size ?? null,
    bodyType: row.body_type ?? null,
    fitRating: row.fit_rating ?? null,
    createdAt: row.created_at,
  };
}

function mapReviewDetail(row) {
  return {
    id: row.id,
    reviewerUserId: row.reviewer_user_id,
    revieweeUserId: row.reviewee_user_id,
    reviewerDisplayName: row.reviewer_display_name ?? null,
    revieweeDisplayName: row.reviewee_display_name ?? null,
    rating: row.rating,
    comment: row.comment ?? null,
    status: row.status,
    sizeWorn: row.size_worn ?? null,
    reviewerHeightCm: row.reviewer_height_cm === null || row.reviewer_height_cm === undefined ? null : Number(row.reviewer_height_cm),
    reviewerWeightKg: row.reviewer_weight_kg === null || row.reviewer_weight_kg === undefined ? null : Number(row.reviewer_weight_kg),
    bustSize: row.bust_size ?? null,
    bodyType: row.body_type ?? null,
    fitRating: row.fit_rating ?? null,
    qualifyingRentalBookingId: row.qualifying_rental_booking_id ?? null,
    qualifyingOrderId: row.qualifying_order_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
