/**
 * Cloudflare Worker for Exchnage
 * Full-stack luxury occasion-wear rental & circular resale platform.
 * Complete serverless backend integrated with Cloudflare Hyperdrive (Neon PostgreSQL)
 * and Cloudflare Workers Static Assets (React 19 SPA).
 */

import { Client } from 'pg';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE?: Hyperdrive;
  UPLOADS_BUCKET?: R2Bucket;
  AUTH_JWT_SECRET?: string;
  API_PREFIX?: string;
  PLATFORM_NAME?: string;
  PLATFORM_CURRENCY?: string;
  PLATFORM_TIMEZONE?: string;
}

interface ApiResponse<T = unknown> {
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: {
    message: string;
    code: string;
  };
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse<T>(
  body: ApiResponse<T>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

// ---------------------------------------------------------------------- Crypto & Auth Helpers

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 32_768, r: 8, p: 1 };
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;

  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64url');
  try {
    const derived = (await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    })) as Buffer;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds = 86400 * 30): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + ttlSeconds,
    }),
  ).toString('base64url');
  const segment = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(segment).digest('base64url');
  return `${segment}.${sig}`;
}

function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;

  const expectedSig = createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest('base64url');
  if (sigB64 !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearerUser(request: Request, secret: string): { userId: string } | null {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  const payload = verifyJwt(token, secret);
  if (!payload || !payload.sub) return null;
  return { userId: String(payload.sub) };
}

// ---------------------------------------------------------------------- Database Helper

async function withDb<T>(env: Env, ctx: ExecutionContext, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('Hyperdrive connection string is not available.');
  }
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    ctx.waitUntil(client.end());
  }
}

// ---------------------------------------------------------------------- API Request Handler

async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const method = request.method;
  const jwtSecret = env.AUTH_JWT_SECRET || 'exchnage_default_production_jwt_secret_min32';

  // 1. Health & Readiness checks
  if (path === '/health' || path === '/health/ready') {
    let dbStatus = 'disconnected';
    let dbLatencyMs = 0;
    let migrationsApplied = 0;

    if (env.HYPERDRIVE?.connectionString) {
      try {
        const start = Date.now();
        await withDb(env, ctx, async (client) => {
          const res = await client.query('SELECT count(*)::int AS applied FROM public.schema_migrations');
          migrationsApplied = res.rows[0]?.applied ?? 0;
          dbStatus = 'connected';
        });
        dbLatencyMs = Date.now() - start;
      } catch (err) {
        console.error('[Health] DB probe error:', err);
        dbStatus = 'error';
      }
    }

    return jsonResponse(
      {
        data: {
          status: 'ok',
          service: 'exchnage-worker-api',
          platform: env.PLATFORM_NAME || 'Exchnage',
          currency: env.PLATFORM_CURRENCY || 'INR',
          timezone: env.PLATFORM_TIMEZONE || 'Asia/Kolkata',
          database: dbStatus,
          databaseLatencyMs: dbLatencyMs,
          migrationsApplied,
          timestamp: new Date().toISOString(),
        },
      },
      200,
      cors,
    );
  }

  // 2. Categories
  if (path === '/categories' || path === '/categories/tree') {
    try {
      const categories = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, name, slug, is_active
           FROM categories
           WHERE is_active = true
           ORDER BY name ASC`,
        );
        return res.rows;
      });
      return jsonResponse({ data: categories }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DB_ERROR' } }, 500, cors);
    }
  }

  if (path.startsWith('/categories/')) {
    const slugOrId = path.replace('/categories/', '');
    try {
      const category = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, name, slug, is_active
           FROM categories
           WHERE (slug = $1 OR id::text = $1) AND is_active = true
           LIMIT 1`,
          [slugOrId],
        );
        return res.rows[0];
      });
      if (!category) {
        return jsonResponse({ error: { message: 'Category not found', code: 'NOT_FOUND' } }, 404, cors);
      }
      return jsonResponse({ data: category }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DB_ERROR' } }, 500, cors);
    }
  }

  // 3. Listings Catalog
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

  // 4. Listing Details
  if (path.startsWith('/listings/') && !path.includes('/units') && !path.includes('/facets')) {
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

  // 5. Listing Inventory Units
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

  // 6. Auth Register & Login
  if (path === '/auth/register' && method === 'POST') {
    try {
      const body = (await request.json()) as any;
      const { email, password, displayName } = body;
      if (!email || !password) {
        return jsonResponse({ error: { message: 'Email and password required', code: 'INVALID_INPUT' } }, 400, cors);
      }

      const pwdHash = await hashPassword(password);

      const user = await withDb(env, ctx, async (client) => {
        const insertUser = await client.query(
          `INSERT INTO users (email, password_hash, status)
           VALUES ($1, $2, 'active')
           RETURNING id, email`,
          [email.toLowerCase().trim(), pwdHash],
        );
        const userId = insertUser.rows[0].id;

        await client.query(
          `INSERT INTO user_roles (user_id, role_name) VALUES ($1, 'customer') ON CONFLICT DO NOTHING`,
          [userId],
        );

        if (displayName) {
          await client.query(
            `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, displayName],
          );
        }

        return {
          id: userId,
          email: insertUser.rows[0].email,
          displayName: displayName || null,
          roles: ['customer'],
        };
      });

      const accessToken = signJwt({ sub: user.id, email: user.email }, jwtSecret);
      return jsonResponse({ data: { user, accessToken } }, 201, cors);
    } catch (err: any) {
      if (err.message.includes('unique constraint') || err.message.includes('users_email_key')) {
        return jsonResponse({ error: { message: 'Email already registered', code: 'EMAIL_EXISTS' } }, 409, cors);
      }
      return jsonResponse({ error: { message: err.message, code: 'REGISTER_FAILED' } }, 500, cors);
    }
  }

  if (path === '/auth/login' && method === 'POST') {
    try {
      const body = (await request.json()) as any;
      const { email, password } = body;

      const user = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT u.id, u.email, u.password_hash, p.display_name,
                  COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN user_roles r ON r.user_id = u.id
           WHERE LOWER(u.email) = LOWER($1)
           GROUP BY u.id, u.email, u.password_hash, p.display_name`,
          [email.trim()],
        );
        return res.rows[0];
      });

      if (!user) {
        return jsonResponse({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } }, 401, cors);
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return jsonResponse({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } }, 401, cors);
      }

      const userData = {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles: user.roles || ['customer'],
      };

      const accessToken = signJwt({ sub: user.id, email: user.email }, jwtSecret);
      return jsonResponse({ data: { user: userData, accessToken } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'LOGIN_FAILED' } }, 500, cors);
    }
  }

  // 7. Auth Me
  if (path === '/auth/me' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const user = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT u.id, u.email, p.display_name, p.phone_number,
                  COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN user_roles r ON r.user_id = u.id
           WHERE u.id::text = $1
           GROUP BY u.id, u.email, p.display_name, p.phone_number`,
          [auth.userId],
        );
        return res.rows[0];
      });

      if (!user) {
        return jsonResponse({ error: { message: 'User not found', code: 'NOT_FOUND' } }, 404, cors);
      }

      return jsonResponse(
        {
          data: {
            user: {
              id: user.id,
              email: user.email,
              displayName: user.display_name,
              phoneNumber: user.phone_number,
              roles: user.roles || ['customer'],
            },
          },
        },
        200,
        cors,
      );
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DB_ERROR' } }, 500, cors);
    }
  }

  // 8. Auth Logout & Refresh
  if (path === '/auth/logout') {
    return jsonResponse({ data: { success: true } }, 200, cors);
  }
  if (path === '/auth/refresh' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Invalid token', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const accessToken = signJwt({ sub: auth.userId }, jwtSecret);
    return jsonResponse({ data: { accessToken } }, 200, cors);
  }

  // 9. Favorites
  if (path === '/favorites') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ data: [] }, 200, cors);
    }
    try {
      const favorites = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT listing_id AS "listingId", created_at AS "createdAt"
           FROM user_favorites
           WHERE user_id::text = $1`,
          [auth.userId],
        );
        return res.rows;
      });
      return jsonResponse({ data: favorites }, 200, cors);
    } catch {
      return jsonResponse({ data: [] }, 200, cors);
    }
  }

  // Fallback for unhandled API endpoints
  return jsonResponse(
    {
      error: {
        message: `Endpoint ${method} ${url.pathname} not found`,
        code: 'NOT_FOUND',
      },
    },
    404,
    cors,
  );
}

// ---------------------------------------------------------------------- Worker Entrypoint

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          ...SECURITY_HEADERS,
        },
      });
    }

    // 1. API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx, url, cors);
    }

    // 2. Uploaded image retrieval from R2 (if configured)
    if (url.pathname.startsWith('/uploads/') && env.UPLOADS_BUCKET) {
      const key = url.pathname.replace(/^\/uploads\//, '');
      const object = await env.UPLOADS_BUCKET.get(key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(object.body, { headers });
      }
    }

    // 3. Cloudflare Workers Static Assets (React 19 SPA)
    try {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        return asset;
      }
    } catch (err) {
      console.warn('[Assets] Asset fallback:', err);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
