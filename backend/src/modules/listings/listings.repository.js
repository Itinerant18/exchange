import { pool } from '../../config/database.js';
import { FACET_KEYS } from './listingAttributes.js';

const LISTING_COLUMNS = `
    l.id, l.owner_type, l.owner_user_id, l.category_id, l.title, l.description,
    l.condition, l.size, l.colour, l.brand, l.rental_price_paise, l.sale_price_paise,
    l.deposit_paise, l.replacement_value_paise, l.is_rental, l.is_sale,
    l.listing_status, l.city, l.delivery_available, l.delivery_radius_km, l.attributes,
    l.created_at, l.updated_at,
    c.name AS category_name, c.slug AS category_slug, c.is_active AS category_is_active`;

function insertValues(fields) {
  return [fields.owner_type, fields.owner_user_id, fields.category_id, fields.title,
    fields.description ?? null, fields.condition, fields.size ?? null, fields.colour ?? null,
    fields.brand ?? null, fields.rental_price_paise ?? null, fields.sale_price_paise ?? null,
    fields.deposit_paise ?? null, fields.replacement_value_paise ?? null,
    fields.is_rental, fields.is_sale];
}

export async function insertListing(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.listings
        (owner_type, owner_user_id, category_id, title, description, condition, size, colour, brand,
         rental_price_paise, sale_price_paise, deposit_paise, replacement_value_paise,
         is_rental, is_sale, attributes, listing_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16::jsonb, COALESCE($17::varchar, 'active'))
     RETURNING id`,
    [...insertValues(fields), fields.attributes ? JSON.stringify(fields.attributes) : '{}',
      fields.listing_status ?? null],
  );
  return rows[0];
}

export async function findListingById(listingId) {
  const { rows } = await pool.query(
    `SELECT ${LISTING_COLUMNS} FROM public.listings l
     JOIN public.categories c ON c.id = l.category_id
     WHERE l.id = $1 LIMIT 1`,
    [listingId],
  );
  return rows[0] ?? null;
}

/**
 * Listing detail with images plus derived inventory counts.
 */
export async function findListingDetail(listingId) {
  const listing = await findListingById(listingId);
  if (!listing) return null;

  const [images, inventoryCounts] = await Promise.all([
    (async () => {
      const { rows } = await pool.query(
        `SELECT id, object_key, mime_type, size_bytes, visibility, is_primary, created_at
         FROM public.listing_images
         WHERE listing_id = $1
         ORDER BY is_primary DESC, created_at ASC`,
        [listingId],
      );
      return rows.map((row) => ({
        id: row.id,
        objectKey: row.object_key,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        visibility: row.visibility,
        isPrimary: row.is_primary,
        createdAt: row.created_at,
      }));
    })(),
    (async () => {
      const { rows } = await pool.query(
        `SELECT operational_status, count(*)::int AS count
         FROM public.inventory_items
         WHERE listing_id = $1
         GROUP BY operational_status`,
        [listingId],
      );
      return rows;
    })(),
  ]);

  const counts = { total: 0, available: 0 };
  for (const row of inventoryCounts) {
    counts.total += row.count;
    if (row.operational_status === 'AVAILABLE') counts.available += row.count;
  }

  return { ...mapListingRow(listing), images, inventory: counts };
}

/**
 * Public catalog query. Only active listings in active categories. Filters:
 * categoryId, condition, mode (rent|sale), price range, keyword, sort, and
 * facet attributes ({ occasion: [...], neckline: [...], ... }).
 */
export async function listPublicListings({ categoryId, condition, mode, minPrice, maxPrice, keyword, attributes, sortKey }, { limit, offset }) {
  const conditions = ['l.listing_status = $1', 'c.is_active = $2'];
  const filterParams = ['active', true];

  const addCondition = (conditionTemplate, value) => {
    filterParams.push(value);
    conditions.push(conditionTemplate.replace('$#', `$${filterParams.length}`));
  };

  if (mode === 'rent') conditions.push('l.is_rental = true');
  if (mode === 'sale') conditions.push('l.is_sale = true');

  if (minPrice !== undefined || maxPrice !== undefined) {
    const basis = mode === 'rent' ? 'l.rental_price_paise'
      : mode === 'sale' ? 'l.sale_price_paise'
        : 'COALESCE(l.rental_price_paise, l.sale_price_paise)';
    if (minPrice !== undefined) addCondition(`${basis} >= $#`, minPrice);
    if (maxPrice !== undefined) addCondition(`${basis} <= $#`, maxPrice);
  }

  if (categoryId) addCondition('l.category_id = $#', categoryId);
  if (condition) addCondition('l.condition = $#', condition);
  if (keyword) addCondition('l.title ILIKE $#', `%${keyword}%`);

  // Facet filters: every selected value of a facet must match (OR within a
  // facet, AND across facets) — ?occasion=Cocktail,BlackTie&neckline=VNeck.
  if (attributes) {
    for (const [key, values] of Object.entries(attributes)) {
      if (!FACET_KEYS.includes(key) || values.length === 0) continue;
      const facetParamIndex = filterParams.length + 1;
      const valuesParamIndex = filterParams.length + 2;
      conditions.push(`l.attributes ?$&$${facetParamIndex} = true
        AND l.attributes->$${facetParamIndex} ?| $${valuesParamIndex}::text[]`);
      // jsonb `?|` needs a text[] — bind values as array plus the key.
      conditions.pop();
      filterParams.push(key, values);
      const keyIdx = filterParams.length - 1;
      const valuesIdx = filterParams.length;
      conditions.push(
        `(l.attributes ? $${keyIdx} AND l.attributes->$${keyIdx} ?| $${valuesIdx}::text[])`,
      );
    }
  }

  const orderBy = sortKey === 'price_asc' || sortKey === 'price_desc'
    ? `ORDER BY ${(mode === 'rent' ? 'l.rental_price_paise' : mode === 'sale' ? 'l.sale_price_paise' : 'COALESCE(l.rental_price_paise, l.sale_price_paise)')} ${sortKey === 'price_asc' ? 'ASC NULLS LAST' : 'DESC NULLS LAST'}, l.created_at DESC`
    : 'ORDER BY l.created_at DESC';

  const whereSql = conditions.join(' AND ');
  const listQuery = `SELECT ${LISTING_COLUMNS} FROM public.listings l
     JOIN public.categories c ON c.id = l.category_id
     WHERE ${whereSql}
     ${orderBy}
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`;

  const countQuery = `SELECT count(*)::int AS total FROM public.listings l
     JOIN public.categories c ON c.id = l.category_id
     WHERE ${whereSql}`;

  const [listResult, countResult] = await Promise.all([
    pool.query(listQuery, [...filterParams, limit, offset]),
    pool.query(countQuery, filterParams),
  ]);
  return { rows: listResult.rows.map(mapListingRow), total: countResult.rows[0].total };
}

/**
 * Facet counts over the currently matching public catalog. Each facet key is
 * counted independently: counts for facet K include the base filters plus the
 * OTHER facet filters, but not K's own values, so the FilterModal can show
 * "how many results would this value add?" RTR-style.
 */
export async function listFacetCounts(filters, knownFacetCountsFilter = null) {
  const baseConditions = ['l.listing_status = $1', 'c.is_active = $2'];
  const baseParams = ['active', true];
  if (filters?.categoryId) {
    baseParams.push(filters.categoryId);
    baseConditions.push(`l.category_id = $${baseParams.length}`);
  }
  if (filters?.condition) {
    baseParams.push(filters.condition);
    baseConditions.push(`l.condition = $${baseParams.length}`);
  }
  if (filters?.mode === 'rent') baseConditions.push('l.is_rental = true');
  if (filters?.mode === 'sale') baseConditions.push('l.is_sale = true');
  if (filters?.keyword) {
    baseParams.push(`%${filters.keyword}%`);
    baseConditions.push(`l.title ILIKE $${baseParams.length}`);
  }

  // Other-facet attribute filters use JSONB containment so a value count
  // respects the remaining constraints without re-parsing per-key params.
  if (filters?.attributes) {
    for (const [key, values] of Object.entries(filters.attributes)) {
      baseParams.push(JSON.stringify({ [key]: values }));
      baseConditions.push(`l.attributes @> $${baseParams.length}::jsonb`);
    }
  }

  const facetsToCount = knownFacetCountsFilter?.facets ?? FACET_KEYS;
  const baseWhereSql = baseConditions.join(' AND ');
  const baseParamsCount = baseParams.length;

  const queries = facetsToCount.map((key) => {
    const params = [...baseParams];
    const keyIdx = params.push(key);
    const sql = `SELECT $${keyIdx}::text AS facet, v.value AS value, count(*)::int AS total
       FROM public.listings l
       JOIN public.categories c ON c.id = l.category_id
       CROSS JOIN LATERAL jsonb_array_elements_text(l.attributes->$${keyIdx}::text) AS v(value)
       WHERE ${baseWhereSql}
         AND NOT l.attributes @> $${baseParamsCount + 1}::jsonb
       GROUP BY v.value
       ORDER BY total DESC`;
    return { key, params, sql };
  });

  const facets = {};
  const results = await Promise.all(
    queries.map(({ key, params, sql }) => pool.query(sql, params)),
  );
  results.forEach((result, index) => {
    const key = facetsToCount[index];
    facets[key] = result.rows.map((row) => ({ value: row.value, count: row.total }));
  });
  return facets;
}

/**
 * Owner's own listings across all statuses (or a specific status).
 */
export async function listOwnerListings(ownerUserId, { status }, { limit, offset }) {
  const conditions = ['l.owner_user_id = $1', "l.owner_type = 'SELLER'"];
  const params = [ownerUserId];
  if (status) {
    params.push(status);
    conditions.push(`l.listing_status = $${params.length}`);
  }
  const whereSql = conditions.join(' AND ');

  const [listResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${LISTING_COLUMNS} FROM public.listings l
       JOIN public.categories c ON c.id = l.category_id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM public.listings l WHERE ${whereSql}`,
      params,
    ),
  ]);
  return { rows: listResult.rows.map(mapListingRow), total: countResult.rows[0].total };
}

export async function updateListingRow(client, listingId, fields) {
  const has = (key) => fields[key] !== undefined;
  const { rows } = await client.query(
    `UPDATE public.listings SET
        title          = CASE WHEN $2  THEN $3::varchar  ELSE title END,
        description    = CASE WHEN $4  THEN $5::text     ELSE description END,
        condition      = CASE WHEN $6  THEN $7::varchar  ELSE condition END,
        size           = CASE WHEN $8  THEN $9::varchar  ELSE size END,
        colour         = CASE WHEN $10 THEN $11::varchar ELSE colour END,
        brand          = CASE WHEN $12 THEN $13::varchar ELSE brand END,
        rental_price_paise      = CASE WHEN $14 THEN $15::bigint ELSE rental_price_paise END,
        sale_price_paise        = CASE WHEN $16 THEN $17::bigint ELSE sale_price_paise END,
        deposit_paise           = CASE WHEN $18 THEN $19::bigint ELSE deposit_paise END,
        replacement_value_paise = CASE WHEN $20 THEN $21::bigint ELSE replacement_value_paise END,
        is_rental      = CASE WHEN $22 THEN $23::boolean ELSE is_rental END,
        is_sale        = CASE WHEN $24 THEN $25::boolean ELSE is_sale END,
        listing_status = CASE WHEN $26 THEN $27::varchar ELSE listing_status END,
        attributes     = CASE WHEN $28 THEN $29::jsonb  ELSE attributes END
     WHERE id = $1
     RETURNING id, owner_type, owner_user_id, category_id, title, description, condition, size, colour, brand,
        rental_price_paise, sale_price_paise, deposit_paise, replacement_value_paise,
        is_rental, is_sale, listing_status, attributes, created_at, updated_at`,
    [
      listingId,
      has('title'), fields.title ?? null,
      has('description'), fields.description ?? null,
      has('condition'), fields.condition ?? null,
      has('size'), fields.size ?? null,
      has('colour'), fields.colour ?? null,
      has('brand'), fields.brand ?? null,
      has('rental_price_paise'), fields.rental_price_paise ?? null,
      has('sale_price_paise'), fields.sale_price_paise ?? null,
      has('deposit_paise'), fields.deposit_paise ?? null,
      has('replacement_value_paise'), fields.replacement_value_paise ?? null,
      has('is_rental'), fields.is_rental ?? null,
      has('is_sale'), fields.is_sale ?? null,
      has('listing_status'), fields.listing_status ?? null,
      has('attributes'), fields.attributes !== undefined ? JSON.stringify(fields.attributes) : null,
    ],
  );
  return rows[0] ?? null;
}

/** Available inventory unit ids for a listing (public buy-mode helper). */
export async function findAvailableUnitIds(listingId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT id FROM public.inventory_items
     WHERE listing_id = $1 AND operational_status = 'AVAILABLE'
     ORDER BY created_at ASC LIMIT $2`,
    [listingId, limit],
  );
  return rows.map((row) => row.id);
}

export async function countListingUnitClaims(listingId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count
     FROM public.inventory_items
     WHERE listing_id = $1 AND operational_status IN ('RESERVED', 'RENTED', 'SALE_PENDING')`,
    [listingId],
  );
  return rows[0].count;
}

// ------------------------------------------------------------------- images

export async function insertListingImage(client, { listingId, objectKey, mimeType, sizeBytes, isPrimary }) {
  const { rows } = await client.query(
    `INSERT INTO public.listing_images
        (listing_id, object_key, mime_type, size_bytes, is_primary)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, object_key, mime_type, size_bytes, is_primary, visibility, created_at`,
    [listingId, objectKey, mimeType, sizeBytes, isPrimary === true],
  );
  return rows[0];
}

export async function demotePrimaryImages(listingId, { exceptImageId = null } = {}, client) {
  await client.query(
    `UPDATE public.listing_images SET is_primary = false
     WHERE listing_id = $1 AND is_primary AND ($2::uuid IS NULL OR id <> $2)`,
    [listingId, exceptImageId],
  );
}

export async function findImage(listingId, imageId) {
  const { rows } = await pool.query(
    `SELECT id, listing_id, object_key, mime_type, size_bytes, visibility, is_primary, created_at
     FROM public.listing_images WHERE id = $1 AND listing_id = $2 LIMIT 1`,
    [imageId, listingId],
  );
  return rows[0] ?? null;
}

export async function deleteImage(listingId, imageId, client) {
  const { rowCount } = await client.query(
    `DELETE FROM public.listing_images WHERE listing_id = $1 AND id = $2`,
    [listingId, imageId],
  );
  return rowCount > 0;
}

export function mapListingRow(row) {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_user_id ?? null,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    categorySlug: row.category_slug ?? null,
    title: row.title,
    description: row.description ?? null,
    condition: row.condition,
    size: row.size ?? null,
    colour: row.colour ?? null,
    brand: row.brand ?? null,
    rentalPricePaise: row.rental_price_paise === null || row.rental_price_paise === undefined ? null : Number(row.rental_price_paise),
    salePricePaise: row.sale_price_paise === null || row.sale_price_paise === undefined ? null : Number(row.sale_price_paise),
    depositPaise: row.deposit_paise === null || row.deposit_paise === undefined ? null : Number(row.deposit_paise),
    replacementValuePaise: row.replacement_value_paise === null || row.replacement_value_paise === undefined ? null : Number(row.replacement_value_paise),
    isRental: row.is_rental,
    isSale: row.is_sale,
    status: row.listing_status,
    city: row.city ?? null,
    deliveryAvailable: row.delivery_available ?? false,
    deliveryRadiusKm: row.delivery_radius_km !== null && row.delivery_radius_km !== undefined ? Number(row.delivery_radius_km) : null,
    attributes: row.attributes ?? {},
    categoryActive: row.category_is_active === undefined ? null : row.category_is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
