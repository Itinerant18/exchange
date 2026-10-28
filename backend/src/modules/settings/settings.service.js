// Settings service: typed policy readers shared by rentals, delivery, and the
// admin console. Numeric reads never trust malformed values; they fail closed
// to 500-style configuration errors instead of inventing behavior.

import { AppError } from '../../appErrors/AppError.js';
import * as repository from './settings.repository.js';

/** Reads a JSONB setting and validates its shape through `validator`. */
export async function readSetting(key, validator) {
  const row = await repository.findSettingByKey(key);
  if (!row || row.value === null || row.value === undefined) {
    throw new AppError(`Required platform setting is missing: ${key}.`, {
      statusCode: 500,
      code: 'SETTING_MISSING',
    });
  }
  const validated = validator(row.value);
  if (validated === undefined || validated === null) {
    throw new AppError(`Platform setting ${key} has an unusable value.`, {
      statusCode: 500,
      code: 'SETTING_INVALID',
    });
  }
  return validated;
}

export async function readIntegerSetting(key, { min = 0 } = {}) {
  return readSetting(key, (value) => {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed >= min ? parsed : undefined;
  });
}

export async function readBooleanSetting(key) {
  return readSetting(key, (value) => (typeof value === 'boolean' && value) || false);
}

export async function deliveryRatePaisePerKm() {
  return readIntegerSetting('delivery_rate_paise_per_km', { min: 0 });
}

export async function isLateFeeApproved() {
  return readBooleanSetting('late_fee_approved');
}

export async function lateFeePaisePerDay() {
  return readIntegerSetting('late_fee_paise_per_day', { min: 0 });
}

export async function lateFeeGraceDays() {
  return readIntegerSetting('late_fee_grace_days', { min: 0 });
}

export async function commissionBps() {
  return readIntegerSetting('commission_bps', { min: 0 });
}

export async function maxRentalDays() {
  return readIntegerSetting('max_rental_days', { min: 1 });
}

export async function minRentalDays() {
  return readIntegerSetting('min_rental_days', { min: 1 });
}

/** Optional damage waiver flat fee per booking (paise). Only charged when the renter opts in. */
export async function damageWaiverPaise() {
  return readIntegerSetting('damage_waiver_fee_paise', { min: 0 });
}

/** Whether free backup-size pairing is offered at booking time. */
export async function isBackupSizesEnabled() {
  return readBooleanSetting('backup_sizes_enabled');
}

// ---------------------------------------------------------------- admin

export async function listAllSettings() {
  return repository.listSettings();
}

export async function adminUpdateValue(user, key, value) {
  const existing = await repository.findSettingByKey(key);
  if (!existing) {
    throw new AppError('Setting not found.', { statusCode: 404, code: 'SETTING_NOT_FOUND' });
  }
  return repository.upsertSetting(key, value, {
    category: existing.category,
    updatedBy: user.id,
  });
}

export async function adminSetApproval(user, key, isApproved) {
  const updated = await repository.setSettingApproval(key, isApproved, user.id);
  if (!updated) {
    throw new AppError('Setting not found.', { statusCode: 404, code: 'SETTING_NOT_FOUND' });
  }
  return updated;
}
