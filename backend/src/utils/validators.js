// Small shared validators. Every controller uses these before touching a
// repository so callers receive a consistent 400 error shape.

import { AppError } from '../appErrors/AppError.js';

export function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function assert(value, message, code = 'VALIDATION_ERROR') {
  if (!value) {
    throw new AppError(message, { statusCode: 400, code });
  }
}

/** Requires `value` to be a trimmed string between min and max chars (inclusive). */
export function expectString(value, field, { min = 1, max = 255, required = true, optional = !required } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new AppError(`${field} is required.`, { statusCode: 400 });
  }
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be a string.`, { statusCode: 400 });
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new AppError(`${field} must be between ${min} and ${max} characters.`, { statusCode: 400 });
  }
  return trimmed;
}

export function expectEnum(value, field, allowed, { optional = false, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return fallback ?? null;
    throw new AppError(`${field} is required.`, { statusCode: 400 });
  }
  const normalized = String(value).trim().toUpperCase();
  const match = allowed.find((candidate) => candidate.toUpperCase() === normalized);
  if (!match) {
    throw new AppError(`${field} must be one of: ${allowed.join(', ')}.`, { statusCode: 400 });
  }
  return match;
}

export function expectBoolean(value, field, { optional = false, fallback = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return fallback;
    throw new AppError(`${field} is required.`, { statusCode: 400 });
  }
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new AppError(`${field} must be a boolean.`, { statusCode: 400 });
}

/** Integer paise: nonnegative, safely representable, at most 1e11 INR. */
export const MAX_AMOUNT_PAISE = Number.MAX_SAFE_INTEGER;
export const REASONABLE_AMOUNT_PAISE = 1_000_000_000_00; // 1e11 paise = 1 billion INR

export function expectAmount(value, field, { optional = false, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return fallback;
    throw new AppError(`${field} is required.`, { statusCode: 400 });
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new AppError(`${field} must be an integer number of paise.`, { statusCode: 400 });
  }
  if (value < 0) {
    throw new AppError(`${field} must be a nonnegative integer number of paise.`, { statusCode: 400 });
  }
  if (value > REASONABLE_AMOUNT_PAISE) {
    throw new AppError(`${field} exceeds the maximum supported amount.`, { statusCode: 400 });
  }
  return value;
}

export function expectInt(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return fallback ?? null;
    throw new AppError(`${field} is required.`, { statusCode: 400 });
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError(`${field} must be an integer between ${min} and ${max}.`, { statusCode: 400 });
  }
  return value;
}

/** ISO calendar date (YYYY-MM-DD). Returns {year, month, day} validated date string. */
export function expectIsoDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field} must be an ISO date string (YYYY-MM-DD).`, { statusCode: 400 });
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(`${field} is not a valid calendar date.`, { statusCode: 400 });
  }
  return value;
}

export function expectId(value, field = 'id') {
  if (!isUuid(value)) {
    throw new AppError(`${field} must be a valid identifier.`, { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

export function throwIfKeysUnknown(body, allowedKeys) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  const unknown = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (unknown.length > 0) {
    throw new AppError(`Unsupported field(s): ${unknown.join(', ')}.`, { statusCode: 400 });
  }
}

/** Returns at least the keys present in `body`, defaulting to `defaults`. */
export function pickFields(body, allowed, existing = undefined) {
  const result = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      result[key] = body[key];
    } else if (existing && Object.prototype.hasOwnProperty.call(existing, key)) {
      result[key] = existing[key];
    }
  }
  return result;
}
