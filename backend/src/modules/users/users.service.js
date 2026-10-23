import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import * as repository from './users.repository.js';

const KNOWN_PROFILE_FIELDS = ['displayName', 'phoneNumber', 'avatarUrl', 'bio'];
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{4,31}$/;
const ADDRESS_TYPES = ['shipping', 'billing', 'both'];

// ------------------------------------------------------------------- profile

export async function getMyProfile(userId) {
  const row = await repository.getProfile(userId);
  if (!row) {
    throw new AppError('Profile not found.', { statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  }
  return {
    displayName: row.display_name ?? null,
    phoneNumber: row.phone_number ?? null,
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateMyProfile(userId, body) {
  const updates = {};
  for (const key of KNOWN_PROFILE_FIELDS) {
    if (body[key] === undefined) continue;
    updates[key] = normalizeProfileField(key, body[key], key === 'phoneNumber');
  }

  const row = await repository.updateProfile(userId, {
    display_name: 'displayName' in updates ? updates.displayName : undefined,
    phone_number: 'phoneNumber' in updates ? updates.phoneNumber : undefined,
    avatar_url: 'avatarUrl' in updates ? updates.avatarUrl : undefined,
    bio: 'bio' in updates ? updates.bio : undefined,
  });
  if (!row) {
    throw new AppError('Profile not found.', { statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  }
  return {
    displayName: row.display_name ?? null,
    phoneNumber: row.phone_number ?? null,
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? null,
    updatedAt: row.updated_at,
  };
}

function normalizeProfileField(key, value, isPhone) {
  if (isPhone) {
    if (value === null) return null;
    const phone = String(value ?? '').trim();
    if (!PHONE_PATTERN.test(phone)) {
      throw new AppError('phoneNumber is not valid.', { statusCode: 400, code: 'INVALID_FIELD' });
    }
    return phone;
  }
  if (value === null) return null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text;
}

// ----------------------------------------------------------------- addresses

/**
 * Creates an address. Required fields are enforced here (service layer), while
 * the database enforces the value formats. Setting a new default demotes the
 * previous default inside the same transaction.
 */
export async function createAddress(userId, body) {
  const mapped = mapAddressFields(body, { requireComplete: true });

  const required = ['full_name', 'phone_number', 'line1', 'city', 'postal_code'];
  for (const field of required) {
    if (!mapped[field]) {
      throw new AppError(`${snakeToCamel(field)} is required.`, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
  }
  if (!PHONE_PATTERN.test(mapped.phone_number)) {
    throw new AppError('phoneNumber is not valid.', { statusCode: 400, code: 'INVALID_FIELD' });
  }

  const row = await withTransaction((client) => repository.createAddress(userId, mapped, client));
  return row;
}

export async function updateAddress(userId, addressId, body) {
  const mapped = mapAddressFields(body, { requireComplete: false });
  if (Object.keys(mapped).length === 0) {
    throw new AppError('No fields provided to update.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (mapped.phone_number !== undefined && !PHONE_PATTERN.test(mapped.phone_number)) {
    throw new AppError('phoneNumber is not valid.', { statusCode: 400, code: 'INVALID_FIELD' });
  }

  const row = await withTransaction((client) =>
    repository.updateAddress(userId, addressId, mapped, client),
  );
  if (!row) {
    throw new AppError('Address not found.', { statusCode: 404, code: 'ADDRESS_NOT_FOUND' });
  }
  return row;
}

export async function listMyAddresses(userId) {
  return repository.listAddresses(userId);
}

export async function getMyAddress(userId, addressId) {
  const row = await repository.getAddress(userId, addressId);
  if (!row) {
    throw new AppError('Address not found.', { statusCode: 404, code: 'ADDRESS_NOT_FOUND' });
  }
  return row;
}

export async function deleteAddress(userId, addressId) {
  const deleted = await repository.deleteAddress(userId, addressId);
  if (!deleted) {
    throw new AppError('Address not found.', { statusCode: 404, code: 'ADDRESS_NOT_FOUND' });
  }
}

function mapAddressFields(body, { requireComplete }) {
  const has = (key) => body[key] !== undefined && body[key] !== null;
  const mapped = {};

  if (requireComplete || has('addressType')) {
    const type = body.addressType ?? 'shipping';
    if (!ADDRESS_TYPES.includes(type)) {
      throw new AppError(`addressType must be one of: ${ADDRESS_TYPES.join(', ')}.`, { statusCode: 400, code: 'INVALID_FIELD' });
    }
    mapped.address_type = type;
  }
  if (requireComplete) {
    (['fullName', 'line1', 'line2', 'city', 'state', 'postalCode', 'country']).forEach((camel) => {
      mapped[camelToSnake(camel)] = toText(body[camel], { required: true, camel });
    });
    // line2/state may legitimately be absent on creation.
    if (!('line2' in mapped) && !has('line2')) delete mapped.line2;
    if (!('state' in mapped) && !has('state')) delete mapped.state;
    mapped.phone_number = String(body.phoneNumber ?? '').trim();
    if (body.isDefault !== undefined) mapped.is_default = Boolean(body.isDefault);
  } else {
    (['fullName', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'phoneNumber']).forEach((camel) => {
      if (has(camel)) mapped[camelToSnake(camel)] = toText(body[camel], { camel });
    });
    if (body.isDefault !== undefined) mapped.is_default = Boolean(body.isDefault);
  }

  return mapped;
}

function toText(value, { camel }) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  if (text.length > 500) {
    throw new AppError(`${camel} is too long.`, { statusCode: 400, code: 'INVALID_FIELD' });
  }
  return text;
}

function camelToSnake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_all, c) => c.toUpperCase());
}
