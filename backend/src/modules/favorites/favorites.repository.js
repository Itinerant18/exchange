import { pool } from '../../config/database.js';

export async function listUserFavoriteIds(userId) {
  const { rows } = await pool.query(
    `SELECT listing_id FROM public.favorites WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => r.listing_id);
}

export async function listUserFavorites(userId, { limit = 20, offset = 0 } = {}) {
  const listSql = `
    SELECT l.id, l.title, l.description, l.condition, l.size, l.colour, l.brand,
           l.rental_price_paise, l.sale_price_paise, l.deposit_paise,
           l.is_rental, l.is_sale, l.listing_status, l.attributes,
           c.name AS category_name, c.slug AS category_slug,
           f.created_at AS favorited_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', li.id,
                 'objectKey', li.object_key,
                 'isPrimary', li.is_primary
               ) ORDER BY li.is_primary DESC
             ) FILTER (WHERE li.id IS NOT NULL), '[]'
           ) AS images
    FROM public.favorites f
    JOIN public.listings l ON l.id = f.listing_id
    JOIN public.categories c ON c.id = l.category_id
    LEFT JOIN public.listing_images li ON li.listing_id = l.id
    WHERE f.user_id = $1 AND l.listing_status = 'active'
    GROUP BY l.id, c.id, f.created_at
    ORDER BY f.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countSql = `
    SELECT count(*)::int AS total
    FROM public.favorites f
    JOIN public.listings l ON l.id = f.listing_id
    WHERE f.user_id = $1 AND l.listing_status = 'active'
  `;

  const [list, count] = await Promise.all([
    pool.query(listSql, [userId, limit, offset]),
    pool.query(countSql, [userId]),
  ]);

  return {
    rows: list.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      condition: row.condition,
      size: row.size,
      colour: row.colour,
      brand: row.brand,
      rentalPricePaise: row.rental_price_paise !== null ? Number(row.rental_price_paise) : null,
      salePricePaise: row.sale_price_paise !== null ? Number(row.sale_price_paise) : null,
      depositPaise: row.deposit_paise !== null ? Number(row.deposit_paise) : null,
      isRental: row.is_rental,
      isSale: row.is_sale,
      listingStatus: row.listing_status,
      attributes: row.attributes ?? {},
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      favoritedAt: row.favorited_at,
      images: row.images,
    })),
    total: count.rows[0].total,
  };
}

export async function addFavorite(userId, listingId) {
  const { rows } = await pool.query(
    `INSERT INTO public.favorites (user_id, listing_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, listing_id) DO NOTHING
     RETURNING listing_id, created_at`,
    [userId, listingId],
  );
  return rows[0] ?? { listing_id: listingId, created_at: new Date() };
}

export async function removeFavorite(userId, listingId) {
  const { rowCount } = await pool.query(
    `DELETE FROM public.favorites WHERE user_id = $1 AND listing_id = $2`,
    [userId, listingId],
  );
  return rowCount > 0;
}

export async function listUserShortlists(userId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.description, s.created_at, s.updated_at,
            count(si.listing_id)::int AS item_count
     FROM public.shortlists s
     LEFT JOIN public.shortlist_items si ON si.shortlist_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id
     ORDER BY s.updated_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    itemCount: r.item_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createShortlist(userId, { title, description }) {
  const { rows } = await pool.query(
    `INSERT INTO public.shortlists (user_id, title, description)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, title, description, created_at, updated_at`,
    [userId, title, description ?? null],
  );
  return {
    id: rows[0].id,
    title: rows[0].title,
    description: rows[0].description,
    itemCount: 0,
    createdAt: rows[0].created_at,
    updatedAt: rows[0].updated_at,
  };
}

export async function addShortlistItem(userId, shortlistId, listingId) {
  // Verify ownership
  const ownerCheck = await pool.query(
    `SELECT 1 FROM public.shortlists WHERE id = $1 AND user_id = $2`,
    [shortlistId, userId],
  );
  if (ownerCheck.rowCount === 0) return null;

  await pool.query(
    `INSERT INTO public.shortlist_items (shortlist_id, listing_id)
     VALUES ($1, $2)
     ON CONFLICT (shortlist_id, listing_id) DO NOTHING`,
    [shortlistId, listingId],
  );
  await pool.query(
    `UPDATE public.shortlists SET updated_at = now() WHERE id = $1`,
    [shortlistId],
  );
  return true;
}

export async function removeShortlistItem(userId, shortlistId, listingId) {
  const ownerCheck = await pool.query(
    `SELECT 1 FROM public.shortlists WHERE id = $1 AND user_id = $2`,
    [shortlistId, userId],
  );
  if (ownerCheck.rowCount === 0) return null;

  await pool.query(
    `DELETE FROM public.shortlist_items WHERE shortlist_id = $1 AND listing_id = $2`,
    [shortlistId, listingId],
  );
  return true;
}

export async function listShortlistItems(userId, shortlistId) {
  const sql = `
    SELECT l.id, l.title, l.description, l.condition, l.size, l.colour, l.brand,
           l.rental_price_paise, l.sale_price_paise, l.deposit_paise,
           l.is_rental, l.is_sale, l.listing_status, l.attributes,
           c.name AS category_name, c.slug AS category_slug,
           si.created_at AS added_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', li.id,
                 'objectKey', li.object_key,
                 'isPrimary', li.is_primary
               ) ORDER BY li.is_primary DESC
             ) FILTER (WHERE li.id IS NOT NULL), '[]'
           ) AS images
    FROM public.shortlist_items si
    JOIN public.shortlists s ON s.id = si.shortlist_id
    JOIN public.listings l ON l.id = si.listing_id
    JOIN public.categories c ON c.id = l.category_id
    LEFT JOIN public.listing_images li ON li.listing_id = l.id
    WHERE s.id = $1 AND s.user_id = $2 AND l.listing_status = 'active'
    GROUP BY l.id, c.id, si.created_at
    ORDER BY si.created_at DESC
  `;
  const { rows } = await pool.query(sql, [shortlistId, userId]);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    condition: row.condition,
    size: row.size,
    colour: row.colour,
    brand: row.brand,
    rentalPricePaise: row.rental_price_paise !== null ? Number(row.rental_price_paise) : null,
    salePricePaise: row.sale_price_paise !== null ? Number(row.sale_price_paise) : null,
    depositPaise: row.deposit_paise !== null ? Number(row.deposit_paise) : null,
    isRental: row.is_rental,
    isSale: row.is_sale,
    listingStatus: row.listing_status,
    attributes: row.attributes ?? {},
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    addedAt: row.added_at,
    images: row.images,
  }));
}

