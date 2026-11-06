import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { extractBearerUser } from '../../middleware/auth';

export async function handleListingsRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = env.AUTH_JWT_SECRET || 'exchnage_default_production_jwt_secret_min32';

  // 1. Listings Catalog
  if (path === '/listings' && method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const categoryId = url.searchParams.get('categoryId');
    const condition = url.searchParams.get('condition');
    const city = url.searchParams.get('city');
    const q = url.searchParams.get('q');
    const sort = url.searchParams.get('sort') || 'newest';

    const conditions: string[] = ["l.listing_status = 'active'"];
    const values: any[] = [];
    let idx = 1;

    if (categoryId) {
      conditions.push(`l.category_id = $${idx++}`);
      values.push(categoryId);
    }
    if (condition) {
      conditions.push(`l.condition = $${idx++}`);
      values.push(condition);
    }
    if (city) {
      conditions.push(`LOWER(l.city) = LOWER($${idx++})`);
      values.push(city);
    }
    if (q) {
      conditions.push(`(l.title ILIKE $${idx} OR l.brand ILIKE $${idx} OR l.description ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx++;
    }

    let orderBy = 'l.created_at DESC';
    if (sort === 'price_asc') orderBy = 'l.rental_price_paise ASC';
    if (sort === 'price_desc') orderBy = 'l.rental_price_paise DESC';

    try {
      const result = await withDb(env, ctx, async (client) => {
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRes = await client.query(`SELECT count(*)::int AS total FROM listings l ${whereClause}`, values);
        const total = countRes.rows[0]?.total ?? 0;

        const listSql = `
          SELECT 
            l.id, l.title, l.description, l.condition, l.size, l.colour, l.brand,
            l.is_rental AS "isRental", l.is_sale AS "isSale",
            l.rental_price_paise AS "rentalPricePaise",
            l.sale_price_paise AS "salePricePaise",
            l.deposit_paise AS "depositPaise",
            l.replacement_value_paise AS "replacementValuePaise",
            l.listing_status AS "status",
            l.city, l.delivery_available AS "deliveryAvailable",
            l.category_id AS "categoryId",
            c.name AS "categoryName", c.slug AS "categorySlug",
            l.created_at AS "createdAt",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', img.id, 'url', img.object_key, 'isPrimary', img.is_primary))
                FROM listing_images img
                WHERE img.listing_id = l.id
              ), '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT count(*)::int 
                FROM inventory_items inv 
                WHERE inv.listing_id = l.id AND inv.operational_status = 'AVAILABLE'
              ), 0
            ) AS "availableUnits"
          FROM listings l
          LEFT JOIN categories c ON c.id = l.category_id
          ${whereClause}
          ORDER BY ${orderBy}
          LIMIT $${idx++} OFFSET $${idx++}
        `;

        const listRes = await client.query(listSql, [...values, limit, offset]);
        return {
          items: listRes.rows,
          total,
        };
      });

      return jsonResponse(
        {
          data: result.items,
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
        200,
        cors,
      );
    } catch (err: any) {
      console.error('[Listings] Query error:', err);
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 2. Listing Inventory Units
  if (path.includes('/units')) {
    const match = path.match(/^\/listings\/([^/]+)\/units/);
    const listingId = match ? match[1] : '';
    try {
      const units = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, operational_status AS "operationalStatus"
           FROM inventory_items
           WHERE listing_id::text = $1 AND operational_status = 'AVAILABLE'`,
          [listingId],
        );
        return res.rows;
      });
      return jsonResponse({ data: units }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 3. Listing Images Addition
  if (path.match(/^\/listings\/[^/]+\/images$/) && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const match = path.match(/^\/listings\/([^/]+)\/images$/);
    const listingId = match ? match[1] : '';
    const body = (await request.json().catch(() => ({}))) as any;
    const { objectKey, mimeType, sizeBytes, isPrimary } = body || {};

    if (!objectKey) {
      return jsonResponse({ error: { message: 'objectKey is required', code: 'INVALID_INPUT' } }, 400, cors);
    }

    try {
      const newImage = await withDb(env, ctx, async (client) => {
        const listingRes = await client.query('SELECT owner_user_id, listing_status FROM listings WHERE id::text = $1', [listingId]);
        if (listingRes.rowCount === 0) {
          throw new Error('Listing not found');
        }
        if (listingRes.rows[0].owner_user_id !== auth.userId && auth.role !== 'admin') {
          throw new Error('Only the listing owner can add images');
        }
        if (listingRes.rows[0].listing_status === 'retired') {
          throw new Error('Retired listings cannot accept images');
        }

        if (isPrimary === true) {
          await client.query('UPDATE listing_images SET is_primary = false WHERE listing_id::text = $1', [listingId]);
        }

        const imgId = crypto.randomUUID();
        const insertRes = await client.query(
          `INSERT INTO listing_images (id, listing_id, object_key, mime_type, size_bytes, visibility, is_primary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'public', $6, NOW(), NOW())
           RETURNING id, listing_id AS "listingId", object_key AS "objectKey", mime_type AS "mimeType", size_bytes AS "sizeBytes", is_primary AS "isPrimary", created_at AS "createdAt"`,
          [imgId, listingId, objectKey, mimeType || 'image/jpeg', Number(sizeBytes) || 250000, isPrimary === true],
        );
        return insertRes.rows[0];
      });

      return jsonResponse({ data: newImage }, 201, cors);
    } catch (err: any) {
      console.error('[ListingImages] Add error:', err);
      const statusCode = err.message.includes('not found') ? 404 : err.message.includes('owner') ? 403 : 500;
      return jsonResponse({ error: { message: err.message, code: 'IMAGE_ADD_FAILED' } }, statusCode, cors);
    }
  }

  // 4. Listing Images Deletion
  if (path.match(/^\/listings\/[^/]+\/images\/[^/]+$/) && method === 'DELETE') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const match = path.match(/^\/listings\/([^/]+)\/images\/([^/]+)$/);
    const listingId = match ? match[1] : '';
    const imageId = match ? match[2] : '';

    try {
      await withDb(env, ctx, async (client) => {
        const listingRes = await client.query('SELECT owner_user_id FROM listings WHERE id::text = $1', [listingId]);
        if (listingRes.rowCount === 0) {
          throw new Error('Listing not found');
        }
        if (listingRes.rows[0].owner_user_id !== auth.userId && auth.role !== 'admin') {
          throw new Error('Unauthorized');
        }
        await client.query('DELETE FROM listing_images WHERE id::text = $1 AND listing_id::text = $2', [imageId, listingId]);
      });

      return new Response(null, { status: 204, headers: cors });
    } catch (err: any) {
      console.error('[ListingImages] Delete error:', err);
      const statusCode = err.message.includes('not found') ? 404 : err.message.includes('Unauthorized') ? 403 : 500;
      return jsonResponse({ error: { message: err.message, code: 'IMAGE_DELETE_FAILED' } }, statusCode, cors);
    }
  }

  // 5. Listing Details
  if (path.startsWith('/listings/') && !path.includes('/units') && !path.includes('/facets') && !path.includes('/images') && !path.includes('/reviews')) {
    const listingId = path.replace('/listings/', '');
    try {
      const listing = await withDb(env, ctx, async (client) => {
        const sql = `
          SELECT 
            l.id, l.title, l.description, l.condition, l.size, l.colour, l.brand,
            l.is_rental AS "isRental", l.is_sale AS "isSale",
            l.rental_price_paise AS "rentalPricePaise",
            l.sale_price_paise AS "salePricePaise",
            l.deposit_paise AS "depositPaise",
            l.replacement_value_paise AS "replacementValuePaise",
            l.listing_status AS "status",
            l.city, l.delivery_available AS "deliveryAvailable",
            l.category_id AS "categoryId",
            c.name AS "categoryName", c.slug AS "categorySlug",
            l.owner_user_id AS "ownerId",
            l.created_at AS "createdAt",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', img.id, 'url', img.object_key, 'isPrimary', img.is_primary))
                FROM listing_images img
                WHERE img.listing_id = l.id
              ), '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT count(*)::int 
                FROM inventory_items inv 
                WHERE inv.listing_id = l.id AND inv.operational_status = 'AVAILABLE'
              ), 0
            ) AS "availableUnits"
          FROM listings l
          LEFT JOIN categories c ON c.id = l.category_id
          WHERE l.id::text = $1
          LIMIT 1
        `;
        const res = await client.query(sql, [listingId]);
        return res.rows[0];
      });

      if (!listing) {
        return jsonResponse({ error: { message: 'Listing not found', code: 'NOT_FOUND' } }, 404, cors);
      }

      return jsonResponse({ data: listing }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  return null;
}
