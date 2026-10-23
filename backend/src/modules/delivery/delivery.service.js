// Delivery/transport quote calculation.
//
// The client supplies the distances (km). The service NEVER invents a
// distance: if routing/disance calculation is unavailable, callers either pass
// a manual quote entered by staff or show an error. Fees are derived purely
// from the configured rate so no journey is ever double-charged.

import { AppError } from '../../appErrors/AppError.js';
import * as settingsService from '../settings/settings.service.js';

export const MAX_DISTANCE_KM = 500;

function normalizeDistance(value, field) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${field} must be a non-negative number of kilometres when transportation is requested.`, {
      statusCode: 400,
      code: 'INVALID_DISTANCE',
    });
  }
  if (parsed > MAX_DISTANCE_KM) {
    throw new AppError(`${field} exceeds the supported ${MAX_DISTANCE_KM} km maximum.`, {
      statusCode: 400,
      code: 'INVALID_DISTANCE',
    });
  }
  // Round to 2 decimals to avoid float dust; charges round UP to the next
  // whole km so partial kilometres are not undercharged.
  return Math.round(parsed * 100) / 100;
}

function billableKm(distanceKm) {
  return Math.max(1, Math.ceil(distanceKm));
}

/**
 * Returns per-direction line items for a chosen transport mode:
 *   none | outbound | return | both
 * Rows are omitted entirely when a journey is not selected — no silent fees.
 */
export async function quoteTransport({ mode, outboundDistanceKm, returnDistanceKm }) {
  const selectedMode = String(mode ?? 'none').trim().toLowerCase();
  if (!['none', 'outbound', 'return', 'both'].includes(selectedMode)) {
    throw new AppError('transportMode must be one of: none, outbound, return, both.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (selectedMode === 'none') {
    return { mode: 'none', ratePaisePerKm: 0, outbound: null, return: null, totalAmountPaise: 0 };
  }

  const ratePaisePerKm = await settingsService.deliveryRatePaisePerKm();
  const wantsOutbound = selectedMode === 'outbound' || selectedMode === 'both';
  const wantsReturn = selectedMode === 'return' || selectedMode === 'both';

  if (wantsOutbound && (outboundDistanceKm === undefined || outboundDistanceKm === null)) {
    throw new AppError('outboundDistanceKm is required when outbound transportation is selected.', {
      statusCode: 400,
      code: 'DISTANCE_REQUIRED',
    });
  }
  if (wantsReturn && (returnDistanceKm === undefined || returnDistanceKm === null)) {
    throw new AppError('returnDistanceKm is required when return transportation is selected.', {
      statusCode: 400,
      code: 'DISTANCE_REQUIRED',
    });
  }

  const outboundDistance = wantsOutbound ? normalizeDistance(outboundDistanceKm, 'outboundDistanceKm') : null;
  const returnDistance = wantsReturn ? normalizeDistance(returnDistanceKm, 'returnDistanceKm') : null;

  const outbound = wantsOutbound
    ? {
        direction: 'outbound',
        description: 'Outbound delivery (owner to renter)',
        distanceKm: outboundDistance,
        billableKm: billableKm(outboundDistance),
        ratePaisePerKm,
        amountPaise: billableKm(outboundDistance) * ratePaisePerKm,
      }
    : null;
  const returnLeg = wantsReturn
    ? {
        direction: 'return',
        description: 'Return transportation (renter to owner)',
        distanceKm: returnDistance,
        billableKm: billableKm(returnDistance),
        ratePaisePerKm,
        amountPaise: billableKm(returnDistance) * ratePaisePerKm,
      }
    : null;

  return {
    mode: selectedMode,
    ratePaisePerKm,
    outbound,
    return: returnLeg,
    totalAmountPaise: (outbound?.amountPaise ?? 0) + (returnLeg?.amountPaise ?? 0),
  };
}

/** Re-quotes from stored booking row fields (used at booking detail time). */
export function quoteFromBookingRow(row, ratePaisePerKm) {
  const legs = [];
  const outboundSelected = row.transport_mode === 'outbound' || row.transport_mode === 'both';
  const returnSelected = row.transport_mode === 'return' || row.transport_mode === 'both';
  if (outboundSelected && row.outbound_distance_km !== null) {
    legs.push({
      direction: 'outbound',
      description: 'Outbound delivery (owner to renter)',
      distanceKm: Number(row.outbound_distance_km),
      billableKm: Math.max(1, Math.ceil(Number(row.outbound_distance_km))),
      ratePaisePerKm,
      amountPaise: Number(row.outbound_transport_amount_paise),
    });
  }
  if (returnSelected && row.return_distance_km !== null) {
    legs.push({
      direction: 'return',
      description: 'Return transportation (renter to owner)',
      distanceKm: Number(row.return_distance_km),
      billableKm: Math.max(1, Math.ceil(Number(row.return_distance_km))),
      ratePaisePerKm,
      amountPaise: Number(row.return_transport_amount_paise),
    });
  }
  return legs;
}
