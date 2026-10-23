import { pool } from '../../config/database.js';

const CATEGORY_COLUMNS = `
    id, parent_id, name, slug, description, image_url, display_order, is_active,
    created_at, updated_at`;

/** Public tree: active categories only. */
export async function listPublicCategories() {
  const { rows } = await pool.query(`
    WITH RECURSIVE category_tree AS (
        SELECT id, parent_id, name, slug, description, image_url, display_order, is_active, 0 AS depth
        FROM public.categories
        WHERE parent_id IS NULL AND is_active
        UNION ALL
        SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.image_url, c.display_order, c.is_active, ct.depth + 1
        FROM public.categories c
        JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.is_active AND ct.depth < 4
    )
    SELECT id, parent_id, name, slug, description, image_url, display_order
    FROM category_tree
    ORDER BY display_order ASC, name ASC`);
  return rows.map(mapCategoryRow);
}

export async function listAdminCategories() {
  const { rows } = await pool.query(
    `SELECT ${CATEGORY_COLUMNS} FROM public.categories ORDER BY display_order ASC, name ASC`,
  );
  return rows.map(mapCategoryRow);
}

export async function findCategoryById(categoryId) {
  const { rows } = await pool.query(
    `SELECT ${CATEGORY_COLUMNS} FROM public.categories WHERE id = $1 LIMIT 1`,
    [categoryId],
  );
  return rows[0] ? mapCategoryRow(rows[0]) : null;
}

export async function insertCategory(fields, client) {
  const { rows } = await client.query(
    `INSERT INTO public.categories (parent_id, name, slug, description, image_url, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
     RETURNING ${CATEGORY_COLUMNS}`,
    [fields.parent_id, fields.name, fields.slug, fields.description, fields.image_url, fields.display_order, fields.is_active],
  );
  return mapCategoryRow(rows[0]);
}

export async function updateCategory(categoryId, fields, client) {
  const has = (key) => fields[key] !== undefined;
  const { rows } = await client.query(
    `UPDATE public.categories SET
        parent_id     = CASE WHEN $2::boolean  THEN $3::uuid  ELSE parent_id  END,
        name          = CASE WHEN $4::boolean  THEN $5::varchar ELSE name  END,
        slug          = CASE WHEN $6::boolean  THEN $7::varchar ELSE slug  END,
        description   = CASE WHEN $8::boolean  THEN $9::text  ELSE  description  END,
        image_url     = CASE WHEN $10::boolean THEN $11::varchar ELSE image_url END,
        display_order = CASE WHEN $12::boolean THEN $13::int  ELSE display_order END,
        is_active     = CASE WHEN $14::boolean THEN $15::boolean ELSE is_active END
     WHERE id = $1
     RETURNING ${CATEGORY_COLUMNS}`,
    [
      categoryId,
      has('parent_id'), fields.parent_id ?? null,
      has('name'), fields.name ?? null,
      has('slug'), fields.slug ?? null,
      has('description'), fields.description ?? null,
      has('image_url'), fields.image_url ?? null,
      has('display_order'), fields.display_order ?? null,
      has('is_active'), fields.is_active ?? null,
    ],
  );
  return rows[0] ? mapCategoryRow(rows[0]) : null;
}

export async function countActiveChildren(categoryId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM public.categories WHERE parent_id = $1 AND is_active`,
    [categoryId],
  );
  return rows[0].count;
}

export async function setCategoryActive(categoryId, isActive, client) {
  const { rows } = await client.query(
    `UPDATE public.categories SET is_active = $2 WHERE id = $1 RETURNING ${CATEGORY_COLUMNS}`,
    [categoryId, isActive],
  );
  return rows[0] ? mapCategoryRow(rows[0]) : null;
}

/** Returns ancestor ids (including the row itself) for cycle detection. */
export async function getAncestorIds(categoryId) {
  const { rows } = await pool.query(
    `WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM public.categories WHERE id = $1
        UNION
        SELECT c.id, c.parent_id FROM public.categories c
        JOIN ancestors a ON c.id = a.parent_id
     )
     SELECT id FROM ancestors`,
    [categoryId],
  );
  return rows.map((row) => row.id);
}

export async function countListingsForCategory(categoryId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM public.listings WHERE category_id = $1`,
    [categoryId],
  );
  return rows[0].count;
}

export function mapCategoryRow(row) {
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
