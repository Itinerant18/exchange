import { AppError } from '../../appErrors/AppError.js';
import { pool, withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { loadListingRow } from '../listings/listings.service.js';
import { claimUnitsToStatus, findAvailableUnitsForPeriod } from '../inventory/inventory.repository.js';
import { expectIsoDate, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as settingsService from '../settings/settings.service.js';
import * as deliveryService from '../delivery/delivery.service.js';
import * as repository from './rentals.repository.js';

const STATUSES = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired'];

// -------------------------------------------------------------------- create

/**
 * Creates a pending rental. Everything happens in one transaction:
 *   1. header snapshot (price/deposit/transport) for the requested period,
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
  const maxDays = await settingsService.maxRentalDays();
  if (days > maxDays) {
    throw new AppError(`Rental periods are limited to ${maxDays} days.`, { statusCode: 400, code: 'PERIOD_TOO_LONG' });
  }
  if (days < await settingsService.minRentalDays()) {
    throw new AppError(`Rental periods must span at least ${await settingsService.minRentalDays()} day(s).`, {
      statusCode: 400,
      code: 'PERIOD_TOO_SHORT',
    });
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

  // Transportation: quoted BEFORE any money looks committed, from the single
  // configured rate. Distances come from the client; we never invent them.
  const transportQuote = await deliveryService.quoteTransport({
    mode: body.transportMode ?? 'none',
    outboundDistanceKm: body.outboundDistanceKm,
    returnDistanceKm: body.returnDistanceKm,
  });

  const unitCount = selectedItemIds.length;
  const ratePaise = Number(listing.rental_price_paise);
  const depositPaise = Number(listing.deposit_paise ?? 0);

  // Damage waiver: an opt-in flat fee per booking, priced by platform policy.
  // Never applied unless the renter explicitly selected it.
  const wantsDamageWaiver = Boolean(body.damageWaiver);
  const damageWaiverFeePaise = wantsDamageWaiver ? await settingsService.damageWaiverPaise() : 0;

  // Free backup size: a preference recorded on the booking; when the owner
  // holds a spare unit for the same window it is reserved as a zero-rated
  // line travelling in the same delivery.
  const backupSize = typeof body.backupSize === 'string' && body.backupSize.trim().length > 0
    ? body.backupSize.trim().slice(0, 50)
    : null;
  const backupRequested = backupSize !== null;
  if (backupRequested) {
    const backupEnabled = await settingsService.isBackupSizesEnabled();
    if (!backupEnabled) {
      throw new AppError('Free backup sizes are not offered for this listing.', {
        statusCode: 409,
        code: 'BACKUP_SIZES_DISABLED',
      });
    }
  }

  const subtotal = ratePaise * days * unitCount; // header subtotal = sum of primary item lines
  const total = subtotal + depositPaise + damageWaiverFeePaise; // CHECK: total = subtotal + deposit + waiver
  // Whether the free backup-size pairing actually reserved a spare unit.
  // Declared outside the transaction so the response can report it.
  let backupReserved = false;

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
        damage_waiver_selected: wantsDamageWaiver,
        damage_waiver_fee_paise: damageWaiverFeePaise,
        backup_size: backupSize,
        transport_mode: transportQuote.mode,
        outbound_distance_km: transportQuote.outbound?.distanceKm ?? null,
        return_distance_km: transportQuote.return?.distanceKm ?? null,
        transport_rate_paise_per_km: transportQuote.ratePaisePerKm > 0 ? transportQuote.ratePaisePerKm : null,
        outbound_transport_amount_paise: transportQuote.outbound?.amountPaise ?? 0,
        return_transport_amount_paise: transportQuote.return?.amountPaise ?? 0,
      });

      for (const itemId of selectedItemIds) {
        await repository.insertBookingItem(client, {
          rental_booking_id: header.id,
          inventory_item_id: itemId,
          item_status: 'pending',
          start_date: startDate,
          end_date: endDate,
          daily_rate_paise: ratePaise,
          line_total_paise: ratePaise * days,
        });
      }

      const reservedUnitIds = [...selectedItemIds];
      if (backupRequested) {
        const stillAvailable = await findAvailableUnitsForPeriod(body.listingId, { startDate, endDate });
        const spareUnitId = stillAvailable.find((id) => !selectedItemIds.includes(id));
        if (spareUnitId) {
          await repository.insertBookingItem(client, {
            rental_booking_id: header.id,
            inventory_item_id: spareUnitId,
            item_status: 'pending',
            start_date: startDate,
            end_date: endDate,
            daily_rate_paise: 0,
            line_total_paise: 0,
            is_backup_size: true,
          });
          reservedUnitIds.push(spareUnitId);
          backupReserved = true;
        }
      }

      // Each unit must still be AVAILABLE here. If a concurrent transaction
      // claimed one, the update count mismatches and everything rolls back.
      const claimed = await claimUnitsToStatus(client, reservedUnitIds, ['AVAILABLE'], 'RESERVED');
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
        newValue: {
          listingId: body.listingId,
          startDate,
          endDate,
          units: unitCount,
          damageWaiver: wantsDamageWaiver,
          backupSize,
          backupReserved,
          transportMode: transportQuote.mode,
          transportTotalPaise: transportQuote.totalAmountPaise,
        },
      });
      return header;
    });

    return {
      id: booking.id,
      status: booking.status,
      startDate,
      endDate,
      rentalDays: days,
      unitCount,
      subtotalAmountPaise: subtotal,
      depositAmountPaise: depositPaise,
      damageWaiver: {
        selected: wantsDamageWaiver,
        feePaise: damageWaiverFeePaise,
      },
      backupSize,
      backupReserved,
      totalAmountPaise: total,
      transport: {
        mode: transportQuote.mode,
        ratePaisePerKm: transportQuote.ratePaisePerKm,
        outboundDistanceKm: transportQuote.outbound?.distanceKm ?? null,
        returnDistanceKm: transportQuote.return?.distanceKm ?? null,
        outboundAmountPaise: transportQuote.outbound?.amountPaise ?? 0,
        returnAmountPaise: transportQuote.return?.amountPaise ?? 0,
        totalAmountPaise: transportQuote.totalAmountPaise,
      },
      // COD, not a gateway: the renter owes these amounts on handover.
      amountDueOnHandoverPaise: total + transportQuote.totalAmountPaise,
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
  const [items, history, inspection, extensions, disputes] = await Promise.all([
    repository.findBookingItems(bookingId),
    repository.findBookingHistory(bookingId),
    repository.findInspectionForBooking(bookingId),
    repository.listExtensionsForBooking(bookingId),
    repository.findDisputesForBooking(bookingId),
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
      isBackupSize: row.is_backup_size === true,
    })),
    history: history.map((row) => ({
      id: row.id,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      changedByUserId: row.changed_by_user_id ?? null,
      reason: row.reason ?? null,
      createdAt: row.created_at,
    })),
    inspection: inspection ? {
      id: inspection.id,
      result: inspection.result,
      notes: inspection.notes,
      evidenceUrls: inspection.evidence_urls ?? [],
      estimatedRecoveryPaise: inspection.estimated_recovery_paise === null || inspection.estimated_recovery_paise === undefined ? null : Number(inspection.estimated_recovery_paise),
      createdAt: inspection.created_at,
    } : null,
    extensions: extensions.map((row) => ({
      id: row.id,
      requestedByType: row.requested_by_type,
      newEndDate: row.new_end_date,
      additionalDays: row.additional_days,
      additionalAmountPaise: Number(row.additional_amount_paise),
      status: row.status,
      decidedAt: row.decided_at,
      rejectionReason: row.rejection_reason,
    })),
    disputes: disputes.map((row) => ({
      id: row.id,
      type: row.dispute_type,
      status: row.status,
      resolution: row.resolution,
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
  return { listingId, startDate, endDate, availableUnits: availableUnitIds.length, unitIds: availableUnitIds };
}

// ---------------------------------------------------------------- transitions

/**
 * Provider accepts a pending booking. With COD as the only payment method,
 * acceptance means the renter owes the agreed amounts at handover.
 */
export async function acceptRentalBooking(user, context, bookingId) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  const isProvider = booking.listing_owner_type === 'SELLER' && booking.listing_owner_id === user.id;
  if (!isProvider && !user.isAdmin) {
    throw new AppError('Only the provider (listing owner) or an administrator can accept a booking.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  if (booking.status !== 'pending') {
    throw new AppError(`A booking in status ${booking.status} cannot be accepted.`, {
      statusCode: 409,
      code: 'BOOKING_CONFIRM_NOT_ALLOWED',
    });
  }

  await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, { fromStatus: ['pending'], toStatus: 'confirmed' });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }
    await repository.setBookingItemsStatus(client, bookingId, { fromStatus: 'pending', toStatus: 'confirmed' });
    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: 'pending',
      to_status: 'confirmed',
      changed_by_user_id: user.id,
      reason: 'Booking accepted (COD due on handover)',
    });
    await writeAuditLog(client, { ...context, action: 'RENTAL_BOOKING_ACCEPTED', entityType: 'rental_booking', entityId: bookingId });
  });
  return { id: bookingId, status: 'confirmed' };
}

/**
 * Provider rejects a pending booking: releases the reserved units and creates
 * cancellation refund records for any already-collected COD amounts.
 */
export async function rejectRentalBooking(user, context, bookingId, reason) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  const isProvider = booking.listing_owner_type === 'SELLER' && booking.listing_owner_id === user.id;
  if (!isProvider && !user.isAdmin) {
    throw new AppError('Only the provider (listing owner) or an administrator can reject a booking.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  if (booking.status !== 'pending') {
    throw new AppError(`A booking in status ${booking.status} cannot be rejected.`, {
      statusCode: 409,
      code: 'BOOKING_REJECT_NOT_ALLOWED',
    });
  }
  await cancelRentalBooking(user, context, bookingId, `Rejected by provider${reason ? `: ${reason}` : ''}`);
  return { id: bookingId, status: 'cancelled' };
}

/**
 * Cancels a pending/confirmed booking. Renter-initiated cancellation is
 * allowed only before the rental starts; admins may cancel any pre-completion
 * booking. Succeeded COD payments automatically create pending refund records
 * so the money trail stays complete.
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

  await withTransaction(async (client) => {
    const moved = await repository.transitionBookingStatus(client, bookingId, {
      fromStatus: [booking.status],
      toStatus: 'cancelled',
    });
    if (!moved) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }

    await client.query(
      `UPDATE public.rental_booking_items
       SET item_status = 'cancelled', updated_at = now()
       WHERE rental_booking_id = $1 AND item_status IN ('pending','confirmed','active')`,
      [bookingId],
    );

    const itemIds = (await repository.findBookingItems(bookingId, client)).map((row) => row.inventory_item_id);
    // Release units: pending/confirmed bookings hold RESERVED, active ones RENTED.
    await client.query(
      `UPDATE public.inventory_items
       SET operational_status = 'AVAILABLE', updated_at = now()
       WHERE id = ANY($1::uuid[]) AND operational_status IN ('RESERVED', 'RENTED')`,
      [itemIds],
    );

    // Pending refund when money was already collected.
    const succeededPayments = await client.query(
      `SELECT id, amount_paise FROM public.payments
       WHERE rental_booking_id = $1 AND status = 'succeeded' AND direction = 'in'`,
      [bookingId],
    );
    for (const payment of succeededPayments.rows) {
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

/**
 * Transparent late-fee preview for an active booking. Returns the amount that
 * WOULD apply under the current policy — but only an approved policy actually
 * charges: until `late_fee_approved` is set by an administrator the fee stays
 * a preview and nothing is imposed.
 */
export async function getLateFeeQuote(user, bookingId) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  return computeLateFee(booking, booking.actual_return_date ?? null);
}

function daysBetweenInclusive(fromIso, toIso) {
  return Math.max(0, Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000));
}

async function computeLateFee(booking, actualReturnDate) {
  const graceDays = await settingsService.lateFeeGraceDays();
  const ratePaise = await settingsService.lateFeePaisePerDay();
  const approved = await settingsService.isLateFeeApproved();
  const dueDate = booking.end_date; // end of booking = due-back day
  const referenceDate = actualReturnDate ?? new Date().toISOString().slice(0, 10);
  const rawOverdue = daysBetweenInclusive(dueDate, referenceDate) - graceDays;
  const overdueDays = Math.max(0, rawOverdue);
  const quotedAmountPaise = overdueDays * ratePaise;
  return {
    dueDate,
    actualDate: actualReturnDate,
    graceDays,
    overdueDays,
    ratePaisePerDay: ratePaise,
    quotedAmountPaise,
    enforced: approved && overdueDays > 0 && quotedAmountPaise > 0,
    policyApproved: approved,
  };
}

/**
 * Post-completion late-fee application (admin decision): persists the overdue
 * computation on the booking. The fee only charges through the standard COD
 * payment intent workflow, so it never silently leaves the audit trail.
 */
export async function applyLateFee(user, context, bookingId, { overdueDays, lateFeeAmountPaise }) {
  if (!user.isAdmin) {
    throw new AppError('You do not have permission to perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  if (!['active', 'completed'].includes(booking.status)) {
    throw new AppError('A late fee applies to active or completed bookings.', {
      statusCode: 409,
      code: 'BOOKING_LATE_FEE_NOT_APPLICABLE',
    });
  }
  if (!Number.isInteger(overdueDays) || overdueDays < 0) {
    throw new AppError('overdueDays must be a non-negative integer.', { statusCode: 400 });
  }
  if (!Number.isInteger(lateFeeAmountPaise) || lateFeeAmountPaise < 0) {
    throw new AppError('lateFeeAmountPaise must be a non-negative integer.', { statusCode: 400 });
  }
  const approved = await settingsService.isLateFeeApproved();
  if (lateFeeAmountPaise > 0 && !approved) {
    throw new AppError('The late-fee policy is not approved; charges are not allowed until an administrator approves it.', {
      statusCode: 409,
      code: 'POLICY_NOT_APPROVED',
    });
  }

  await withTransaction(async (client) => {
    await repository.setLateFeeFields(client, bookingId, { overdueDays, lateFeeAmount: lateFeeAmountPaise });
    await client.query(
      `UPDATE public.rental_bookings SET late_fee_approved_at = now(), late_fee_approved_by = $2, updated_at = now()
       WHERE id = $1`, [bookingId, user.id],
    );
    await writeAuditLog(client, {
      ...context,
      action: 'LATE_FEE_APPLIED',
      entityType: 'rental_booking',
      entityId: bookingId,
      newValue: { overdueDays, lateFeeAmountPaise },
    });
  });
  return { id: bookingId, overdueDays, lateFeeAmountPaise };
}

/**
 * Return: active -> completed; units move RENTED -> AVAILABLE; the provider's
 * optional inspection is recorded with the return so damage/missing reports
 * always carry evidence and a timestamp from the same transaction.
 */
export async function completeRentalBooking(user, context, bookingId, body = {}) {
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

  let returnDate = body.actualReturnDate ?? body.returnDate;
  if (returnDate !== undefined) {
    expectIsoDate(returnDate, 'actualReturnDate');
    if (returnDate < booking.start_date) {
      throw new AppError('actualReturnDate cannot be before the rental start.', { statusCode: 400, code: 'INVALID_DATE_RANGE' });
    }
  }

  // Inspection is optional; when supplied it must be complete.
  let inspection = null;
  if (body.inspection !== undefined && body.inspection !== null) {
    const spec = body.inspection;
    if (typeof spec !== 'object' || Array.isArray(spec)) {
      throw new AppError('inspection must be an object.', { statusCode: 400 });
    }
    const result = String(spec.result ?? '').trim().toLowerCase();
    if (!['pass', 'damage', 'missing'].includes(result)) {
      throw new AppError("inspection.result must be 'pass', 'damage', or 'missing'.", { statusCode: 400 });
    }
    let recovery = null;
    if (result !== 'pass') {
      recovery = spec.estimatedRecoveryPaise;
      if (recovery === undefined || !Number.isInteger(Number(recovery)) || Number(recovery) <= 0) {
        throw new AppError('inspection.estimatedRecoveryPaise must be a positive integer when the result is damage or missing.', {
          statusCode: 400,
        });
      }
      recovery = Number(recovery);
    }
    const evidence = Array.isArray(spec.evidenceUrls) ? spec.evidenceUrls.filter((u) => typeof u === 'string' && u.length > 3).slice(0, 10) : [];
    inspection = {
      result,
      notes: typeof spec.notes === 'string' && spec.notes.length > 0 ? spec.notes.slice(0, 2000) : null,
      evidence,
      estimatedRecoveryPaise: recovery,
    };
  }

  // Late-fee context is informational here; charging happens via an approved
  // policy downstream (applyLateFee + COD intent), never automatically.
  const lateFeeContext = await computeLateFee(booking, returnDate ?? null);

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

    if (inspection) {
      await repository.insertInspection(client, {
        rental_booking_id: bookingId,
        inspected_by_user_id: user.id,
        result: inspection.result,
        notes: inspection.notes,
        evidence_urls: JSON.stringify(inspection.evidence),
        estimated_recovery_paise: inspection.estimatedRecoveryPaise,
      });
      await writeAuditLog(client, {
        ...context,
        action: 'RETURN_INSPECTED',
        entityType: 'rental_booking',
        entityId: bookingId,
        newValue: { result: inspection.result, estimatedRecoveryPaise: inspection.estimatedRecoveryPaise },
      });
    }

    await repository.insertStatusHistory(client, {
      rental_booking_id: bookingId,
      from_status: 'active',
      to_status: 'completed',
      changed_by_user_id: user.id,
      reason: inspection && inspection.result !== 'pass'
        ? `Item returned (inspection: ${inspection.result})`
        : 'Item returned',
    });
    await writeAuditLog(client, { ...context, action: 'RENTAL_BOOKING_COMPLETED', entityType: 'rental_booking', entityId: bookingId, newValue: { overduePreviewDays: lateFeeContext.overdueDays } });
  });

  void result;
  return {
    id: bookingId,
    status: 'completed',
    lateFee: { ...lateFeeContext },
    inspection: inspection ? { ...inspection } : null,
  };
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

// ---------------------------------------------------------------- extensions

/**
 * Renter (or provider/admin) requests a booking extension. The extra amount is
 * quoted from the stored rate; nothing changes on the booking until approval.
 */
export async function requestBookingExtension(user, context, bookingId, body) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  const viewer = assertViewer(booking, user);
  const requestedByType = user.isAdmin && !viewer.isRenter && !viewer.isProvider ? 'admin' : viewer.isProvider ? 'provider' : 'renter';

  if (!['pending', 'confirmed', 'active'].includes(booking.status)) {
    throw new AppError(`A booking in status ${booking.status} cannot be extended.`, {
      statusCode: 409,
      code: 'BOOKING_EXTENSION_NOT_ALLOWED',
    });
  }

  const newEndDateRaw = body.newEndDate ?? body.endDate;
  if (typeof newEndDateRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newEndDateRaw)) {
    throw new AppError('newEndDate must be an ISO date (YYYY-MM-DD).', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (newEndDateRaw < booking.end_date) {
    throw new AppError('A new end date must be on or after the current end date.', {
      statusCode: 400,
      code: 'INVALID_DATE_RANGE',
    });
  }
  const additionalDays = Math.round((Date.parse(`${newEndDateRaw}T00:00:00Z`) - Date.parse(`${booking.end_date}T00:00:00Z`)) / 86_400_000);
  const maxDays = await settingsService.maxRentalDays();
  const totalDays = Math.round((Date.parse(`${newEndDateRaw}T00:00:00Z`) - Date.parse(`${booking.start_date}T00:00:00Z`)) / 86_400_000);
  if (additionalDays <= 0) {
    throw new AppError('The extension must add at least one day.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (totalDays > maxDays) {
    throw new AppError(`Rental periods are limited to ${maxDays} days including extensions.`, {
      statusCode: 400,
      code: 'PERIOD_TOO_LONG',
    });
  }

  const dailyRate = Number(booking.listing_rate_paise ?? 0);
  const additionalAmount = dailyRate * additionalDays; // deposit unchanged by extension

  const extension = await withTransaction(async (client) => {
    const row = await repository.insertExtension(client, {
      rental_booking_id: bookingId,
      requested_by_type: requestedByType,
      new_end_date: newEndDateRaw,
      additional_days: additionalDays,
      additional_amount_paise: additionalAmount,
    });
    await writeAuditLog(client, {
      ...context,
      action: 'BOOKING_EXTENSION_REQUESTED',
      entityType: 'rental_booking',
      entityId: bookingId,
      newValue: { newEndDate: newEndDateRaw, additionalDays },
    });
    return row;
  }).catch(translatePgError);
  return mapExtension(extension);
}

function mapExtension(row) {
  return {
    id: row.id,
    rentalBookingId: row.rental_booking_id,
    requestedByType: row.requested_by_type,
    newEndDate: row.new_end_date,
    additionalDays: row.additional_days,
    additionalAmountPaise: Number(row.additional_amount_paise),
    status: row.status,
    decidedBy: row.decided_by ?? null,
    decidedAt: row.decided_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at,
  };
}

export async function listBookingExtensions(user, bookingId) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }
  assertViewer(booking, user);
  const rows = await repository.listExtensionsForBooking(bookingId);
  return rows.map(mapExtension);
}

/**
 * Approves or rejects a pending extension. Approval extends the booking item
 * rows in the same transaction — the GiST exclusion constraint re-arbitrates
 * the new ranges, so an extension colliding with another reservation fails
 * without ever changing the booking.
 */
export async function decideBookingExtension(user, context, extensionId, body) {
  if (!user.isAdmin) {
    throw new AppError('You do not have permission to perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  const decision = String(body.decision ?? '').trim().toLowerCase();
  if (!['approve', 'reject'].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'.", { statusCode: 400 });
  }
  return withTransaction(async (client) => {
    const row = await repository.findExtensionById(extensionId, client);
    if (!row) {
      throw new AppError('Extension request not found.', { statusCode: 404, code: 'EXTENSION_NOT_FOUND' });
    }
    const booking = await repository.findBookingById(row.rental_booking_id, client);
    if (decision === 'reject') {
      const decided = await repository.decideExtension(client, extensionId, {
        toStatus: 'rejected',
        decidedBy: user.id,
        rejectionReason: typeof body.reason === 'string' && body.reason.length > 0 ? body.reason.slice(0, 500) : null,
      });
      if (!decided) {
        throw new AppError('The extension request has already been decided.', { statusCode: 409, code: 'EXTENSION_STATE_CONFLICT' });
      }
      await writeAuditLog(client, { ...context, action: 'BOOKING_EXTENSION_REJECTED', entityType: 'rental_booking', entityId: row.rental_booking_id });
      return { ...mapExtension(decided) };
    }

    const dailyRate = Number(booking.listing_rate_paise ?? 0);
    const deposit = Number(booking.deposit_amount_paise ?? 0);
    const extended = await repository.applyBookingExtension(client, row.rental_booking_id, {
      newEndDate: row.new_end_date,
      dailyRatePaise: dailyRate,
      additionalDays: row.additional_days,
      currentSubtotal: Number(booking.subtotal_amount_paise),
      depositAmountPaise: deposit,
      damageWaiverFeePaise: Number(booking.damage_waiver_fee_paise ?? 0),
    });
    if (!extended) {
      throw new AppError('The booking has already changed state.', { statusCode: 409, code: 'BOOKING_STATE_CONFLICT' });
    }
    // Item rows carry the new blocking ranges; overlaps roll this whole tx back.
    const guard = await repository.extendBookingItemDates(client, row.rental_booking_id, {
      newEndDate: row.new_end_date,
      dailyRatePaise: dailyRate,
      additionalDays: row.additional_days,
    });
    if (guard === 0) {
      throw new AppError('No blocking reservation rows remain; the extension cannot be applied.', {
        statusCode: 409,
        code: 'BOOKING_STATE_CONFLICT',
      });
    }
    const decided = await repository.decideExtension(client, extensionId, {
      toStatus: 'approved',
      decidedBy: user.id,
    });
    if (!decided) {
      throw new AppError('The extension request has already been decided.', { statusCode: 409, code: 'EXTENSION_STATE_CONFLICT' });
    }
    await repository.insertStatusHistory(client, {
      rental_booking_id: row.rental_booking_id,
      from_status: booking.status,
      to_status: booking.status,
      changed_by_user_id: user.id,
      reason: `Extended to ${row.new_end_date} (+${row.additional_days} day(s))`,
    });
    await writeAuditLog(client, { ...context, action: 'BOOKING_EXTENSION_APPROVED', entityType: 'rental_booking', entityId: row.rental_booking_id, newValue: { newEndDate: row.new_end_date } });
    return mapExtension(decided);
  }).catch(translatePgError);
}

// -------------------------------------------------- used by payments service

/**
 * Confirms a pending booking after its rental payment is recorded (COD
 * collected). Runs inside the caller's transaction, so all effects commit
 * together.
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
  void pool;
  return rowCount === 1;
}
