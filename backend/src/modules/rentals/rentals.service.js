import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { loadListingRow } from '../listings/listings.service.js';
import { claimUnitsToStatus, findAvailableUnitsForPeriod } from '../inventory/inventory.repository.js';
import { expectIsoDate, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './rentals.repository.js';

// Business rule: rental periods span at most these many days per booking.
export const MAX_RENTAL_DAYS = 90;

const STATUSES = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'];

// -------------------------------------------------------------------- create

/**
 * Creates a pending rental. Everything happens in one transaction:
 *   1. header snapshot (price/deposit) for the requested period,
 *   2. one booking item row per physical unit (the GiST exclusion constraint
 *      arbitrates date conflicts at the database level),
 *   3. a conditional claim reserving each unit (fails -> whole booking rolls back).
 * Concurrency-safe: two racing bookings for the same days cannot both commit.
 */
export async function createRentalBooking(user, context, body) {
  const startDate = expectIsoDate(body.startDate, 'startDate');
  const endDate = expectIsoDate(body.endDate, 'endDate');
  if (endDate <= startDate) {
    throw new AppError('endDate must be after startDate (periods are half-open: end date is the handover day).', {
      statusCode: 400,
      code: 'INVALID_DATE_RANGE',
    });
  }
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  if (days > MAX_RENTAL_DAYS) {
    throw new AppError(`Rental periods are limited to ${MAX_RENTAL_DAYS} days.`, { statusCode: 400, code: 'PERIOD_TOO_LONG' });
  }

  if (body.listingId === undefined || !isUuid(body.listingId)) {
    throw new AppError('listingId must be a valid listing identifier.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const listing = await loadListingRow(body.listingId);

  if (!listing.is_rental || listing.rental_price_paise === null) {
    throw new AppError('This listing is not offered for rental.', { statusCode: 409, code: 'LISTING_NOT_RENTABLE' });
  }
  if (listing.listing_status !== 'active') {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  if (listing.owner_type === 'SELLER' && listing.owner_user_id === user.id) {
    throw new AppError('Renting your own listing is not supported.', { statusCode: 409, code: 'SELF_BOOKING_NOT_ALLOWED' });
  }

  // Unit selection: explicit subset or all units free for the requested dates.
  let selectedItemIds;
  if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
    for (const id of body.itemIds) {
      if (!isUuid(id)) {
        throw new AppError('itemIds must contain valid unit identifiers.', { statusCode: 400, code: 'INVALID_ID' });
      }
    }
    selectedItemIds = body.itemIds;
  } else {
    selectedItemIds = await findAvailableUnitsForPeriod(body.listingId, { startDate, endDate });
    if (selectedItemIds.length === 0) {
      throw new AppError('The selected days are not available for this listing.', {
        statusCode: 409,
        code: 'DATES_NOT_AVAILABLE',
      });
    }
  }

  const ratePaise = Number(listing.rental_price_paise);
  const depositPaise = Number(listing.deposit_paise ?? 0);
  const subtotal = ratePaise * days;
  const total = subtotal * selectedItemIds.length + depositPaise;

  try {
    const booking = await withTransaction(async (client) => {
      const header = await repository.insertBooking(client, {
        renter_user_id: user.id,
        rental_listing_id: body.listingId,
        status: 'pending',
        start_date: startDate,
        end_date: endDate,
        subtotal_amount_paise: subtotal,
        deposit_amount_paise: depositPaise,
        total_amount_paise: total,
        deposit_paid: false,
      });

      for (const itemId of selectedItemIds) {
        await repository.insertBookingItem(client, {
          rental_booking_id: header.id,
          inventory_item_id: itemId,
          item_status: 'pending',
          start_date: startDate,
          end_date: endDate,
          daily_rate_paise: ratePaise,
          line_total_paise: subtotal,
        });
      }

      // Each unit must still be AVAILABLE here. If a concurrent transaction
      // claimed one, the update count mismatches and everything rolls back.
      const claimed = await claimUnitsToStatus(client, selectedItemIds, ['AVAILABLE'], 'RESERVED');
      if (!claimed) {
        throw new AppError('One of the units is no longer available.', {
          statusCode: 409,
          code: 'ITEM_NO_LONGER_AVAILABLE',
        });
      }

      await repository.insertStatusHistory(client, {
        rental_booking_id: header.id,
        from_status: null,
        to_status: 'pending',
        changed_by_user_id: user.id,
        reason: 'Booking created',
      });
      await writeAuditLog(client, {
        ...context,
        action: 'RENTAL_BOOKING_CREATED',
        entityType: 'rental_booking',
        entityId: header.id,
        newValue: { listingId: body.listingId, startDate, endDate, units: selectedItemIds.length },
      });
      return header;
    });

    return {
      id: booking.id,
      status: booking.status,
      startDate,
      endDate,
      subtotalAmountPaise: subtotal,
      depositAmountPaise: depositPaise,
      totalAmountPaise: total,
      units: selectedItemIds.length,
    };
  } catch (error) {
    throw translatePgError(error);
  }
}

// ---------------------------------------------------------------------- read

function assertViewer(booking, user) {
  const isRenter = booking.renter_user_id === user.id;
  const isProvider = booking.listing_owner_type === 'SELLER' && booking.listing_owner_id === user.id;
  if (!isRenter && !isProvider && !user.isAdmin) {
    throw new AppError('You do not have access to this booking.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return { isRenter, isProvider };
}

export async function getBooking(user, bookingId) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  const [items, history] = await Promise.all([
    repository.findBookingItems(bookingId),
    repository.findBookingHistory(bookingId),
  ]);
  return {
    ...repository.mapBookingRow(booking),
    items: items.map((row) => ({
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      itemStatus: row.item_status,
      startDate: row.start_date,
      endDate: row.end_date,
      dailyRatePaise: Number(row.daily_rate_paise),
      lineTotalPaise: Number(row.line_total_paise),
    })),
    history: history.map((row) => ({
      id: row.id,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      changedByUserId: row.changed_by_user_id ?? null,
      reason: row.reason ?? null,
      createdAt: row.created_at,
    })),
  };
}

export async function listBookingsForViewer(user, query, pagination) {
  let viewer = 'all';
  const isAdmin = user.isAdmin;
  const requestedRole = query.role === undefined ? undefined : String(query.role).toLowerCase();

  if (requestedRole === undefined || requestedRole === '') {
    viewer = isAdmin ? 'all' : 'renter';
  } else if (requestedRole === 'renter') {
    viewer = 'renter';
  } else if (requestedRole === 'provider') {
    if (isAdmin) {
      throw new AppError('Administrators list all bookings by omitting the role filter.', { statusCode: 400 });
    }
    viewer = 'provider';
  } else {
    throw new AppError('role must be "renter" or "provider".', { statusCode: 400 });
  }

  let status = undefined;
  if (query.status !== undefined) {
    status = String(query.status).trim().toLowerCase();
    if (!STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${STATUSES.join(', ')}.`, { statusCode: 400 });
    }
  }

  return repository.listBookings({ viewer, viewerUserId: user.id, status, ...pagination });
}

/** Public availability projection for a listing and date range. */
export async function getListingAvailability(listingId, query) {
  const startDate = expectIsoDate(query.startDate, 'startDate');
  const endDate = expectIsoDate(query.endDate, 'endDate');
  if (endDate <= startDate) {
    throw new AppError('endDate must be after startDate.', { statusCode: 400, code: 'INVALID_DATE_RANGE' });
  }
  void listingId;
  const listing = await loadListingRow(listingId);
  if (!listing.is_rental || listing.listing_status !== 'active') {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  const availableUnitIds = await findAvailableUnitsForPeriod(listingId, { startDate, endDate });
  return { listingId, startDate, endDate, availableUnits: availableUnitIds.length };
}

// ---------------------------------------------------------------- transitions

/**
 * Cancels a pending/confirmed booking. Renter-initiated cancellation is
 * allowed only before the rental starts; admins may cancel any active
 * pre-completion booking. A succeeded payment automatically creates a pending
 * refund record so the money trail stays complete.
 */
export async function cancelRentalBooking(user, context, bookingId, reason) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  const viewer = assertViewer(booking, user);

  const cancellableByRenter = viewer.isRenter && (booking.status === 'pending' || booking.status === 'confirmed');
  const cancellableByAdmin = user.isAdmin && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'active');
  if (!cancellableByRenter && !cancellableByAdmin) {
    throw new AppError(`A booking in status ${booking.status} cannot be cancelled by this caller.`, {
      statusCode: 409,
      code: 'BOOKING_CANCEL_NOT_ALLOWED',
    });
  }

  const result = await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, {
      fromStatus: [booking.status],
      toStatus: 'cancelled',
    });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }

    const { rowCount: itemsMoved } = await client.query(
      `UPDATE public.rental_booking_items
       SET item_status = 'cancelled', updated_at = now()
       WHERE rental_booking_id = $1 AND item_status IN ('pending','confirmed','active')`,
      [bookingId],
    );
    void itemsMoved;

    const itemIds = (await repository.findBookingItems(bookingId, client)).map((row) => row.inventory_item_id);
    // Release units: pending/confirmed bookings hold RESERVED, active ones RENTED.
    await client.query(
      `UPDATE public.inventory_items
       SET operational_status = 'AVAILABLE', updated_at = now()
       WHERE id = ANY($1::uuid[]) AND operational_status IN ('RESERVED', 'RENTED')`,
      [itemIds],
    );

    // Pending refund when money was already captured.
    const succeededPayments = await client.query(
      `SELECT id, amount_paise, payment_type FROM public.payments
       WHERE rental_booking_id = $1 AND status = 'succeeded' AND direction = 'in'`,
      [bookingId],
    );
    for (const payment of succeededPayments.rows) {
      void payment.payment_type;
      const already = await client.query(
        `SELECT 1 FROM public.refunds WHERE payment_id = $1 AND status <> 'failed' AND status <> 'cancelled' LIMIT 1`,
        [payment.id],
      );
      if (already.rowCount === 0) {
        await client.query(
          `INSERT INTO public.refunds (payment_id, refund_amount_paise, reason, status, created_by_user_id)
           VALUES ($1, $2, 'cancellation', 'pending', $3)`,
          [payment.id, Number(payment.amount_paise), user.id],
        );
      }
    }

    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: booking.status,
      to_status: 'cancelled',
      changed_by_user_id: user.id,
      reason: reason ?? null,
    });
    await writeAuditLog(client, {
      ...context,
      action: 'RENTAL_BOOKING_CANCELLED',
      entityType: 'rental_booking',
      entityId: bookingId,
      newValue: { fromStatus: booking.status },
    });
  });

  return { id: bookingId, status: 'cancelled' };
}

/** Handover: confirmed -> active; units move RESERVED -> RENTED. */
export async function startRentalBooking(user, context, bookingId) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  if (booking.status !== 'confirmed') {
    throw new AppError('Only a confirmed booking can be started (handed over).', {
      statusCode: 409,
      code: 'BOOKING_START_NOT_ALLOWED',
    });
  }

  await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, { fromStatus: ['confirmed'], toStatus: 'active' });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }
    await repository.setBookingItemsStatus(client, bookingId, { fromStatus: 'confirmed', toStatus: 'active' });

    const itemIds = (await repository.findBookingItems(bookingId, client)).map((row) => row.inventory_item_id);
    const claimed = await claimUnitsToStatus(client, itemIds, ['RESERVED'], 'RENTED');
    if (!claimed) {
      throw new AppError('A unit is not in the reserved state; the rental cannot start.', {
        statusCode: 409,
        code: 'ITEM_STATE_CONFLICT',
      });
    }

    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: 'confirmed',
      to_status: 'active',
      changed_by_user_id: user.id,
      reason: 'Item handed over',
    });
    await writeAuditLog(client, { ...context, action: 'RENTAL_BOOKING_STARTED', entityType: 'rental_booking', entityId: bookingId });
  });
  return { id: bookingId, status: 'active' };
}

/** Return: active -> completed; units move RENTED -> AVAILABLE. */
export async function completeRentalBooking(user, context, bookingId, returnDate) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  const viewer = assertViewer(booking, user);
  if (!viewer.isProvider && !user.isAdmin) {
    throw new AppError('Only the provider (listing owner) or an administrator can record a return.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  if (booking.status !== 'active') {
    throw new AppError('Only an active booking can be completed (returned).', {
      statusCode: 409,
      code: 'BOOKING_RETURN_NOT_ALLOWED',
    });
  }
  if (returnDate !== undefined) {
    expectIsoDate(returnDate, 'actualReturnDate');
    if (returnDate < booking.start_date) {
      throw new AppError('actualReturnDate cannot be before the rental start.', { statusCode: 400, code: 'INVALID_DATE_RANGE' });
    }
  }

  const result = await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, { fromStatus: ['active'], toStatus: 'completed' });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }
    await repository.setBookingItemsStatus(client, bookingId, { fromStatus: 'active', toStatus: 'completed' });
    await repository.setActualReturnDate(client, bookingId, returnDate ?? null);

    const itemIds = (await repository.findBookingItems(bookingId, client)).map((row) => row.inventory_item_id);
    const released = await claimUnitsToStatus(client, itemIds, ['RENTED'], 'AVAILABLE');
    if (!released) {
      throw new AppError('A unit is not in the rented state; the return cannot be recorded.', {
        statusCode: 409,
        code: 'ITEM_STATE_CONFLICT',
      });
    }

    // Deposit moves to its release review state when one was collected.
    await client.query(
      `UPDATE public.security_deposits SET status = 'releasing', updated_at = now()
       WHERE rental_booking_id = $1 AND status = 'held'`,
      [bookingId],
    );

    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: 'active',
      to_status: 'completed',
      changed_by_user_id: user.id,
      reason: 'Item returned',
    });
    await writeAuditLog(client, { ...context, action: 'RENTAL_BOOKING_COMPLETED', entityType: 'rental_booking', entityId: bookingId });
  });

  return { id: bookingId, status: 'completed' };
}

/** Admin expire: confirmed -> expired when the rental never started. */
export async function expireRentalBooking(user, context, bookingId) {
  if (!user.isAdmin) {
    throw new AppError('You do not have permission to perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  if (booking.status !== 'confirmed') {
    throw new AppError('Only a confirmed booking can be expired.', { statusCode: 409, code: 'BOOKING_EXPIRE_NOT_ALLOWED' });
  }

  await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, { fromStatus: ['confirmed'], toStatus: 'expired' });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }
    await repository.setBookingItemsStatus(client, bookingId, { fromStatus: 'confirmed', toStatus: 'expired' });

    const itemIds = (await repository.findBookingItems(bookingId, client)).map((row) => row.inventory_item_id);
    await client.query(
      `UPDATE public.inventory_items SET operational_status = 'AVAILABLE', updated_at = now()
       WHERE id = ANY($1::uuid[]) AND operational_status = 'RESERVED'`,
      [itemIds],
    );

    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: 'confirmed',
      to_status: 'expired',
      changed_by_user_id: user.id,
      reason: 'Rental never started',
    });
    await writeAuditLog(client, { ...context, action: 'RENTAL_BOOKING_EXPIRED', entityType: 'rental_booking', entityId: bookingId });
  });
  return { id: bookingId, status: 'expired' };
}

// -------------------------------------------------- used by payments service

/**
 * Confirms a pending booking after its rental payment settles. Runs inside the
 * caller's transaction (payments settlement), so all effects commit together.
 */
export async function markBookingConfirmedInTransaction(client, bookingId, changedByUserId) {
  const booking = await repository.findBookingById(bookingId, client);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  if (booking.status === 'confirmed') return booking;
  if (booking.status !== 'pending') {
    throw new AppError(`A booking in status ${booking.status} cannot be confirmed.`, {
      statusCode: 409,
      code: 'BOOKING_CONFIRM_NOT_ALLOWED',
    });
  }

  const moved = await repository.transitionBookingStatus(client, bookingId, { fromStatus: ['pending'], toStatus: 'confirmed' });
  if (!moved) {
    throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
  }
  await repository.setBookingItemsStatus(client, bookingId, { fromStatus: 'pending', toStatus: 'confirmed' });

  await repository.insertStatusHistory(client, {
    rental_booking_id: bookingId,
    from_status: 'pending',
    to_status: 'confirmed',
    changed_by_user_id: changedByUserId,
    reason: 'Payment settled',
  });
  return booking;
}

/**
 * Marks the booking's deposit flag as paid. Caller's transaction.
 */
export async function setBookingDepositPaidInTransaction(client, bookingId) {
  const { rowCount } = await client.query(
    `UPDATE public.rental_bookings SET deposit_paid = true, updated_at = now()
     WHERE id = $1 AND deposit_paid = false`,
    [bookingId],
  );
  return rowCount === 1;
}
