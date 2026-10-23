import { pool } from '../../config/database.js';

export async function getProfile(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, display_name, phone_number, avatar_url, bio, created_at, updated_at
     FROM public.user_profiles WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateProfile(userId, fields, client = pool) {
  const { display_name, phone_number, avatar_url, bio } = fields;
  const { rows } = await client.query(
    `UPDATE public.user_profiles
     SET display_name = COALESCE($2, display_name),
         phone_number = COALESCE($3, phone_number),
         avatar_url   = COALESCE($4, avatar_url),
         bio          = COALESCE($5, bio)
     WHERE user_id = $1
     RETURNING user_id, display_name, phone_number, avatar_url, bio, created_at, updated_at`,
    [userId, display_name, phone_number, avatar_url, bio],
  );
  return rows[0] ?? null;
}

export async function listAddresses(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, address_type, full_name, phone_number, line1, line2, city, state, postal_code,
            country, is_default, created_at, updated_at
     FROM public.user_addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at ASC`,
    [userId],
  );
  return rows.map(mapAddress);
}

export async function getAddress(userId, addressId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, address_type, full_name, phone_number, line1, line2, city, state, postal_code,
            country, is_default, created_at, updated_at
     FROM public.user_addresses
     WHERE user_id = $1 AND id = $2`,
    [userId, addressId],
  );
  return rows[0] ? mapAddress(rows[0]) : null;
}

/**
 * Creates an address inside a transaction; when is_default is requested the
 * previous default is demoted first so the partial unique index never trips.
 */
export async function createAddress(userId, fields, client) {
  const {
    address_type, full_name, phone_number, line1, line2, city, state, postal_code, country, is_default,
  } = fields;
  // is_default is NOT NULL in the schema; an omitted value means false.
  const isDefault = is_default === true;

  await client.query(
    `UPDATE public.user_addresses SET is_default = false
     WHERE user_id = $1 AND is_default AND $2`,
    [userId, isDefault],
  );

  const { rows } = await client.query(
    `INSERT INTO public.user_addresses
        (user_id, address_type, full_name, phone_number, line1, line2, city, state, postal_code, country, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::boolean)
     RETURNING id, address_type, full_name, phone_number, line1, line2, city, state, postal_code,
               country, is_default, created_at, updated_at`,
    [userId, address_type, full_name, phone_number, line1, line2, city, state, postal_code, country, isDefault],
  );
  return mapAddress(rows[0]);
}

export async function updateAddress(userId, addressId, fields, client) {
  const {
    address_type, full_name, phone_number, line1, line2, city, state, postal_code, country, is_default,
  } = fields;

  if (is_default === true) {
    await client.query(
      `UPDATE public.user_addresses SET is_default = false WHERE user_id = $1 AND id <> $2 AND is_default`,
      [userId, addressId],
    );
  }

  const { rows } = await client.query(
    `UPDATE public.user_addresses
     SET address_type = COALESCE($3, address_type),
         full_name    = COALESCE($4, full_name),
         phone_number = COALESCE($5, phone_number),
         line1        = COALESCE($6, line1),
         line2        = $7::varchar,
         city         = COALESCE($8, city),
         state        = $9::varchar,
         postal_code  = COALESCE($10, postal_code),
         country      = COALESCE($11, country),
         is_default   = COALESCE($12, is_default)
     WHERE user_id = $1 AND id = $2
     RETURNING id, address_type, full_name, phone_number, line1, line2, city, state, postal_code,
               country, is_default, created_at, updated_at`,
    [userId, addressId, address_type, full_name, phone_number, line1,
      line2 ?? null, city, state ?? null, postal_code, country,
      is_default === null ? null : is_default],
  );
  return rows[0] ? mapAddress(rows[0]) : null;
}

export async function deleteAddress(userId, addressId, client = pool) {
  const { rowCount } = await client.query(
    `DELETE FROM public.user_addresses WHERE user_id = $1 AND id = $2`,
    [userId, addressId],
  );
  return rowCount > 0;
}

function mapAddress(row) {
  return {
    id: row.id,
    addressType: row.address_type,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    line1: row.line1,
    line2: row.line2 ?? null,
    city: row.city,
    state: row.state ?? null,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
