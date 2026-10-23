import { pool } from '../../config/database.js';

const ITEM_COLUMNS = `
    i.id, i.listing_id, i.owner_type, i.owner_user_id, i.serial_or_sku, i.condition,
    i.operational_status, i.acquired_at, i.created_at, i.updated_at,
    l.title AS listing_title`;

export async function insertItem(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.inventory_items
        (listing_id, owner_type, owner_user_id, serial_or_sku, condition, operational_status)
     VALUES ($1, $2, $3, $4, $5, 'AVAILABLE')
     RETURNING id, listing_id, operational_status, created_at`,
    [fields.listing_id, fields.owner_type, fields.owner_user_id, fields.serial_or_sku ?? null, fields.condition],
  );
  return rows[0];
}

export async function findItemById(itemId) {
  const { rows } = await pool.query(
    `SELECT ${ITEM_COLUMNS} FROM public.inventory_items i
     JOIN public.listings l ON l.id = i.listing_id
     WHERE i.id = $1 LIMIT 1`,
    [itemId],
  );
  return rows[0] ?? null;
}

export async function listItemsForOwner(ownerUserId, { limit, offset }) {
  const conditions = ['i.owner_user_id = $1 AND i.owner_type = $2'];
  const where = conditions.join(' AND ');
  const [listResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${ITEM_COLUMNS} FROM public.inventory_items i
       JOIN public.listings l ON l.id = i.listing_id
       WHERE ${where}
       ORDER BY i.created_at DESC
       LIMIT $3 OFFSET $4`,
      [ownerUserId, 'SELLER', limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM public.inventory_items i WHERE ${where}`,
      [ownerUserId, 'SELLER'],
    ),
  ]);
  return { rows: listResult.rows.map(mapItemRow), total: countResult.rows[0].total };
}

export async function updateItemRow(client, itemId, fields) {
  const has = (key) => fields[key] !== undefined;
  const { rows } = await client.query(
    `UPDATE public.inventory_items SET
        serial_or_sku      = CASE WHEN $2 THEN $3::varchar ELSE serial_or_sku END,
        condition          = CASE WHEN $4 THEN $5::varchar ELSE condition END,
        operational_status = CASE WHEN $6 THEN $7::varchar ELSE operational_status END
     WHERE id = $1
     RETURNING ${ITEM_COLUMNS.replace(/l\./g, '')}`,
    [
      itemId,
      has('serial_or_sku'), fields.serial_or_sku ?? null,
      has('condition'), fields.condition,
      has('operational_status'), fields.operational_status ?? null,
    ],
  );
  return rows[0] ?? null;
}

/**
 * Conditional status update used by rental and sale transaction flows:
 * a unit is claimed only when its current operational status is in
 * `requireOneOf`; returns the claimed unit id or null when someone else won.
 */
export async function claimUnitsToStatus(client, itemIds, requireOneOf, newStatus) {
  if (itemIds.length === 0) return true;
  const { rowCount } = await client.query(
    `UPDATE public.inventory_items
     SET operational_status = $3, updated_at = now()
     WHERE id = ANY($1::uuid[]) AND operational_status = ANY($2::varchar[])
     AND updated_at = updated_at`,
    [itemIds, requireOneOf, newStatus],
  );
  return rowCount === itemIds.length;
}

/** Blocking (pending/confirmed/active) rental reservations touching a unit. */
export async function findBlockingRentals(itemIds, { fromDate = null, toDate = null } = {}, client = pool) {
  if (itemIds.length === 0) return [];
  const { rows } = await client.query(
    `SELECT rbi.inventory_item_id, rbi.start_date, rbi.end_date, rbi.item_status
     FROM public.rental_booking_items rbi
     WHERE rbi.inventory_item_id = ANY($1::uuid[])
       AND rbi.item_status IN ('pending', 'confirmed', 'active')
       AND ($2::date IS NULL OR rbi.start_date < $2::date)
       AND ($3::date IS NULL OR rbi.end_date > $3::date)
     ORDER BY rbi.start_date ASC`,
    [itemIds, fromDate, toDate],
  );
  return rows;
}

export async function countBlockingRentals(itemId, client = pool) {
  const rows = await findBlockingRentals([itemId], {}, client);
  return rows.length;
}

/** Units of a listing available for a requested period (physical + dates). */
export async function findAvailableUnitsForPeriod(listingId, { startDate, endDate }, client = pool) {
  const { rows } = await client.query(
    `SELECT i.id
     FROM public.inventory_items i
     WHERE i.listing_id = $1
       AND i.operational_status = 'AVAILABLE'
       AND NOT EXISTS (
           SELECT 1 FROM public.rental_booking_items rbi
           WHERE rbi.inventory_item_id = i.id
             AND rbi.item_status IN ('pending', 'confirmed', 'active')
             AND rbi.start_date < $3::date
             AND rbi.end_date > $2::date
       )
     ORDER BY i.created_at ASC`,
    [listingId, startDate, endDate],
  );
  return rows.map((row) => row.id);
}

export function mapItemRow(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title ?? null,
    ownerType: row.owner_type,
    ownerId: row.owner_user_id ?? null,
    serialOrSku: row.serial_or_sku ?? null,
    condition: row.condition,
    operationalStatus: row.operational_status,
    acquiredAt: row.acquired_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
