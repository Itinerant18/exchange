// Settings repository: the single source of truth for configurable business
// policy. Values are JSONB payloads keyed by name; services interpret them.

import { pool } from '../../config/database.js';

export const SETTING_COLUMNS = `key, value, category, description, is_approved, updated_by, created_at, updated_at`;

export async function findSettingByKey(key, client = pool) {
  const { rows } = await (client ?? pool).query(
    `SELECT ${SETTING_COLUMNS} FROM public.platform_settings WHERE key = $1 LIMIT 1`,
    [key],
  );
  return rows[0] ?? null;
}

export async function listSettings(client = pool) {
  const { rows } = await (client ?? pool).query(
    `SELECT ${SETTING_COLUMNS} FROM public.platform_settings ORDER BY category, key`,
  );
  return rows;
}

export async function upsertSetting(key, value, { category = 'listing', isApproved = null, updatedBy = null, description = null } = {}, client = pool) {
  const { rows } = await (client ?? pool).query(
    `INSERT INTO public.platform_settings (key, value, category, description, is_approved, updated_by)
     VALUES ($1, $2::jsonb,
             (SELECT category FROM public.platform_settings WHERE key = $1),
             COALESCE($3, (SELECT description FROM public.platform_settings WHERE key = $1)),
             COALESCE($4::boolean, (SELECT is_approved FROM public.platform_settings WHERE key = $1)),
             $5)
     ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         is_approved = COALESCE($4::boolean, public.platform_settings.is_approved),
         updated_by = EXCLUDED.updated_by
     RETURNING ${SETTING_COLUMNS}`,
    [key, JSON.stringify(value), description, isApproved, updatedBy],
  );
  return rows[0];
}

export async function setSettingApproval(key, isApproved, updatedBy, client = pool) {
  const { rows } = await (client ?? pool).query(
    `UPDATE public.platform_settings
     SET is_approved = $2, updated_by = $3
     WHERE key = $1
     RETURNING ${SETTING_COLUMNS}`,
    [key, isApproved, updatedBy],
  );
  return rows[0] ?? null;
}
