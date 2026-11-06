/**
 * Cloudflare Worker for Exchnage
 * Full-stack luxury occasion-wear rental & circular resale platform.
 * Complete serverless backend integrated with Cloudflare Hyperdrive (Neon PostgreSQL)
 * and Cloudflare Workers Static Assets (React 19 SPA).
 */

import { Client } from 'pg';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DurableObject } from 'cloudflare:workers';

const scrypt = promisify(scryptCallback);

export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE?: Hyperdrive;
  EXCHANGE_D1?: D1Database;
  EXCHANGE_KV?: KVNamespace;
  EVENT_QUEUE?: Queue<any>;
  INVENTORY_LOCK?: DurableObjectNamespace<InventoryLockDO>;
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

// ---------------------------------------------------------------------- Edge D1 & KV Helpers

function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function recordEdgeAudit(
  env: Env,
  ctx: ExecutionContext,
  eventType: string,
  userId: string | null,
  ip: string | null,
  payload: Record<string, unknown> = {},
): void {
  if (!env.EXCHANGE_D1) return;
  ctx.waitUntil(
    env.EXCHANGE_D1.prepare(
      'INSERT INTO edge_audit_logs (id, event_type, user_id, ip_address, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        crypto.randomUUID(),
        eventType,
        userId,
        ip || 'unknown',
        JSON.stringify(payload),
        Date.now(),
      )
      .run()
      .catch((err) => console.error('[EdgeAudit] Failed to log:', err)),
  );
}

async function checkEdgeRateLimit(
  env: Env,
  ip: string,
  maxAttempts = 20,
  windowSeconds = 60,
): Promise<boolean> {
  if (!env.EXCHANGE_D1 || !ip) return true;
  try {
    const key = `ratelimit:auth:${ip}`;
    const now = Date.now();
    const existing = await env.EXCHANGE_D1.prepare(
      'SELECT count, reset_at FROM edge_rate_limits WHERE key = ?',
    )
      .bind(key)
      .first<{ count: number; reset_at: number }>();

    if (!existing || existing.reset_at < now) {
      await env.EXCHANGE_D1.prepare(
        'INSERT OR REPLACE INTO edge_rate_limits (key, count, reset_at) VALUES (?, 1, ?)',
      )
        .bind(key, now + windowSeconds * 1000)
        .run();
      return true;
    }

    if (existing.count >= maxAttempts) {
      return false; // Rate limit reached
    }

    await env.EXCHANGE_D1.prepare('UPDATE edge_rate_limits SET count = count + 1 WHERE key = ?')
      .bind(key)
      .run();
    return true;
  } catch (err) {
    console.warn('[RateLimit] Error:', err);
    return true; // Fail open
  }
}

function emitQueueEvent(
  env: Env,
  ctx: ExecutionContext,
  eventType: string,
  payload: Record<string, unknown> = {},
): void {
  if (!env.EVENT_QUEUE) return;
  ctx.waitUntil(
    env.EVENT_QUEUE.send({
      type: eventType,
      payload,
      timestamp: Date.now(),
    }).catch((err) => console.error('[QueueProducer] Failed to send event:', err)),
  );
}

// ---------------------------------------------------------------------- Durable Object: InventoryLockDO

export class InventoryLockDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS unit_holds (
        hold_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  async acquireHold(
    userId: string,
    startDate: string,
    endDate: string,
    durationMinutes = 15,
  ): Promise<{ success: boolean; reason?: string; holdId?: string; expiresAt?: number }> {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE expires_at <= ?', now);

    const existing = [...this.ctx.storage.sql.exec(
      'SELECT hold_id, user_id, start_date, end_date, expires_at FROM unit_holds WHERE start_date < ? AND end_date > ? LIMIT 1',
      endDate,
      startDate,
    )];

    if (existing.length > 0) {
      const active = existing[0] as any;
      if (active.user_id === userId) {
        const newExpiry = now + durationMinutes * 60 * 1000;
        this.ctx.storage.sql.exec('UPDATE unit_holds SET expires_at = ? WHERE hold_id = ?', newExpiry, active.hold_id);
        return { success: true, holdId: active.hold_id, expiresAt: newExpiry };
      }
      return {
        success: false,
        reason: 'This garment unit is currently reserved in another customer checkout.',
      };
    }

    const holdId = crypto.randomUUID();
    const expiresAt = now + durationMinutes * 60 * 1000;
    this.ctx.storage.sql.exec(
      'INSERT INTO unit_holds (hold_id, user_id, start_date, end_date, expires_at) VALUES (?, ?, ?, ?, ?)',
      holdId,
      userId,
      startDate,
      endDate,
      expiresAt,
    );
    return { success: true, holdId, expiresAt };
  }

  async releaseHold(userId: string): Promise<{ success: boolean }> {
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE user_id = ?', userId);
    return { success: true };
  }

  async getHoldStatus(): Promise<{ isHeld: boolean; hold?: any }> {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE expires_at <= ?', now);
    const holds = [...this.ctx.storage.sql.exec('SELECT hold_id, user_id, start_date, end_date, expires_at FROM unit_holds LIMIT 1')];
    if (holds.length === 0) return { isHeld: false };
    return { isHeld: true, hold: holds[0] };
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

    let d1Status = 'disconnected';
    let d1LatencyMs = 0;
    let d1Sessions = 0;
    if (env.EXCHANGE_D1) {
      try {
        const start = Date.now();
        const d1Res = await env.EXCHANGE_D1.prepare('SELECT count(*) AS total FROM edge_sessions').first<{ total: number }>();
        d1Sessions = d1Res?.total ?? 0;
        d1LatencyMs = Date.now() - start;
        d1Status = 'connected';
      } catch (err) {
        console.error('[Health] D1 probe error:', err);
        d1Status = 'error';
      }
    }

    let kvStatus = 'disconnected';
    if (env.EXCHANGE_KV) {
      try {
        await env.EXCHANGE_KV.get('health_probe');
        kvStatus = 'connected';
      } catch (err) {
        console.error('[Health] KV probe error:', err);
        kvStatus = 'error';
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
          edgeD1: d1Status,
          edgeD1LatencyMs: d1LatencyMs,
          edgeD1Sessions: d1Sessions,
          edgeKV: kvStatus,
          edgeQueue: env.EVENT_QUEUE ? 'connected' : 'unbound',
          edgeDurableObjects: env.INVENTORY_LOCK ? 'connected' : 'unbound',
          timestamp: new Date().toISOString(),
        },
      },
      200,
      cors,
    );
  }

  // 2. Categories (with KV caching)
  if (path === '/categories' || path === '/categories/tree') {
    try {
      if (env.EXCHANGE_KV) {
        const cached = await env.EXCHANGE_KV.get('cache:categories:tree', 'json');
        if (cached) {
          return jsonResponse({ data: cached }, 200, { ...cors, 'X-Cache': 'HIT' });
        }
      }

      const categories = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, name, slug, is_active
           FROM categories
           WHERE is_active = true
           ORDER BY name ASC`,
        );
        return res.rows;
      });

      if (env.EXCHANGE_KV) {
        ctx.waitUntil(
          env.EXCHANGE_KV.put('cache:categories:tree', JSON.stringify(categories), {
            expirationTtl: 3600,
          }),
        );
      }

      return jsonResponse({ data: categories }, 200, { ...cors, 'X-Cache': 'MISS' });
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
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const allowed = await checkEdgeRateLimit(env, clientIp, 15, 60);
      if (!allowed) {
        return jsonResponse(
          { error: { message: 'Too many registration attempts. Please wait a minute.', code: 'RATE_LIMITED' } },
          429,
          cors,
        );
      }

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

      if (env.EXCHANGE_D1) {
        const sessionTokenHash = hashToken(accessToken, jwtSecret);
        ctx.waitUntil(
          env.EXCHANGE_D1.prepare(
            'INSERT OR REPLACE INTO edge_sessions (session_id, user_id, email, roles, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
            .bind(
              sessionTokenHash,
              user.id,
              user.email,
              JSON.stringify(user.roles),
              Date.now(),
              Date.now() + 86400 * 30 * 1000,
            )
            .run()
            .catch((e) => console.error('[EdgeSession] Failed to store session:', e)),
        );
      }

      recordEdgeAudit(env, ctx, 'AUTH_REGISTER_SUCCESS', user.id, clientIp, { email: user.email });

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
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const allowed = await checkEdgeRateLimit(env, clientIp, 20, 60);
      if (!allowed) {
        return jsonResponse(
          { error: { message: 'Too many login attempts. Please wait a minute.', code: 'RATE_LIMITED' } },
          429,
          cors,
        );
      }

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
        recordEdgeAudit(env, ctx, 'AUTH_LOGIN_FAILED_USER_NOT_FOUND', null, clientIp, { email: email.trim() });
        return jsonResponse({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } }, 401, cors);
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        recordEdgeAudit(env, ctx, 'AUTH_LOGIN_FAILED_WRONG_PASSWORD', user.id, clientIp, { email: user.email });
        return jsonResponse({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } }, 401, cors);
      }

      const userData = {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles: user.roles || ['customer'],
      };

      const accessToken = signJwt({ sub: user.id, email: user.email }, jwtSecret);

      if (env.EXCHANGE_D1) {
        const sessionTokenHash = hashToken(accessToken, jwtSecret);
        ctx.waitUntil(
          env.EXCHANGE_D1.prepare(
            'INSERT OR REPLACE INTO edge_sessions (session_id, user_id, email, roles, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
            .bind(
              sessionTokenHash,
              user.id,
              user.email,
              JSON.stringify(userData.roles),
              Date.now(),
              Date.now() + 86400 * 30 * 1000,
            )
            .run()
            .catch((e) => console.error('[EdgeSession] Failed to write session:', e)),
        );
      }

      recordEdgeAudit(env, ctx, 'AUTH_LOGIN_SUCCESS', user.id, clientIp, { email: user.email });

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
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ') && env.EXCHANGE_D1) {
      const token = authHeader.substring(7).trim();
      const tokenHash = hashToken(token, jwtSecret);
      ctx.waitUntil(
        env.EXCHANGE_D1.prepare('DELETE FROM edge_sessions WHERE session_id = ?')
          .bind(tokenHash)
          .run()
          .catch(() => {}),
      );
    }
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

  // 10. Rentals Availability
  if (path === '/rentals/availability' && method === 'GET') {
    const listingId = url.searchParams.get('listingId');
    if (!listingId) {
      return jsonResponse({ error: { message: 'listingId is required', code: 'INVALID_INPUT' } }, 400, cors);
    }
    const startDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDefault = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('endDate') || endDefault;

    try {
      const result = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT inv.id, inv.serial_or_sku AS "serialOrSku", inv.condition, inv.operational_status AS "operationalStatus"
           FROM inventory_items inv
           WHERE inv.listing_id::text = $1
             AND inv.operational_status = 'AVAILABLE'
             AND NOT EXISTS (
               SELECT 1 FROM rental_booking_items rbi
               WHERE rbi.inventory_item_id = inv.id
                 AND rbi.item_status IN ('pending', 'confirmed', 'active')
                 AND daterange(rbi.start_date, rbi.end_date, '[)') && daterange($2::date, $3::date, '[)')
             )`,
          [listingId, startDate, endDate],
        );
        return res.rows;
      });

      return jsonResponse(
        {
          data: {
            listingId,
            startDate,
            endDate,
            isAvailable: result.length > 0,
            availableCount: result.length,
            availableUnits: result,
          },
        },
        200,
        cors,
      );
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 11. Rentals Bookings - Creation
  if (path === '/rentals/bookings' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
      const body = (await request.json()) as any;
      const { listingId, startDate, endDate, damageWaiver, backupSize } = body;
      if (!listingId || !startDate || !endDate) {
        return jsonResponse(
          { error: { message: 'listingId, startDate, and endDate are required', code: 'INVALID_INPUT' } },
          400,
          cors,
        );
      }

      if (endDate <= startDate) {
        return jsonResponse(
          { error: { message: 'endDate must be after startDate', code: 'INVALID_DATE_RANGE' } },
          400,
          cors,
        );
      }

      const startMs = Date.parse(`${startDate}T00:00:00Z`);
      const endMs = Date.parse(`${endDate}T00:00:00Z`);
      const days = Math.round((endMs - startMs) / 86400000);
      if (days < 1 || days > 30) {
        return jsonResponse(
          { error: { message: 'Rental duration must be between 1 and 30 days', code: 'INVALID_DURATION' } },
          400,
          cors,
        );
      }

      const bookingResult = await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        try {
          const listingRes = await client.query(
            `SELECT id, is_rental, rental_price_paise, deposit_paise, listing_status, owner_user_id
             FROM listings
             WHERE id::text = $1
             FOR SHARE`,
            [listingId],
          );
          const listing = listingRes.rows[0];
          if (!listing || listing.listing_status !== 'active' || !listing.is_rental) {
            throw new Error('Listing is not available for rental');
          }

          if (listing.owner_user_id === auth.userId) {
            throw new Error('You cannot rent your own listing');
          }

          // Concurrency safe unit allocation with row-level lock
          const unitRes = await client.query(
            `SELECT inv.id
             FROM inventory_items inv
             WHERE inv.listing_id = $1
               AND inv.operational_status = 'AVAILABLE'
               AND NOT EXISTS (
                 SELECT 1 FROM rental_booking_items rbi
                 WHERE rbi.inventory_item_id = inv.id
                   AND rbi.item_status IN ('pending', 'confirmed', 'active')
                   AND daterange(rbi.start_date, rbi.end_date, '[)') && daterange($2::date, $3::date, '[)')
               )
             LIMIT 1
             FOR UPDATE OF inv SKIP LOCKED`,
            [listing.id, startDate, endDate],
          );

          if (unitRes.rows.length === 0) {
            throw new Error('Selected dates are no longer available for this garment');
          }
          const unitId = unitRes.rows[0].id;

          // Edge coordination check: acquire distributed hold in Durable Object
          if (env.INVENTORY_LOCK) {
            const doId = env.INVENTORY_LOCK.idFromName(unitId);
            const stub = env.INVENTORY_LOCK.get(doId);
            const lockCheck = await stub.acquireHold(auth.userId, startDate, endDate);
            if (!lockCheck.success) {
              throw new Error(lockCheck.reason || 'Unit is temporarily reserved in another checkout');
            }
          }

          const ratePaise = Number(listing.rental_price_paise);
          const subtotalPaise = ratePaise * days;
          const depositPaise = Number(listing.deposit_paise ?? 0);
          const wantsWaiver = Boolean(damageWaiver);
          const waiverFeePaise = wantsWaiver ? 1250 : 0;
          const totalPaise = subtotalPaise + depositPaise + waiverFeePaise;

          const headerRes = await client.query(
            `INSERT INTO rental_bookings (
               renter_user_id, rental_listing_id, status, start_date, end_date,
               subtotal_amount_paise, deposit_amount_paise, total_amount_paise, deposit_paid,
               damage_waiver_selected, damage_waiver_fee_paise, backup_size
             )
             VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, false, $8, $9, $10)
             RETURNING id, status, created_at AS "createdAt"`,
            [
              auth.userId,
              listing.id,
              startDate,
              endDate,
              subtotalPaise,
              depositPaise,
              totalPaise,
              wantsWaiver,
              waiverFeePaise,
              backupSize || null,
            ],
          );
          const header = headerRes.rows[0];

          await client.query(
            `INSERT INTO rental_booking_items (
               rental_booking_id, inventory_item_id, item_status, start_date, end_date,
               daily_rate_paise, line_total_paise, is_backup_size
             )
             VALUES ($1, $2, 'pending', $3, $4, $5, $6, false)`,
            [header.id, unitId, startDate, endDate, ratePaise, subtotalPaise],
          );

          await client.query(
            `INSERT INTO rental_booking_status_history (
               rental_booking_id, from_status, to_status, changed_by_user_id, reason
             )
             VALUES ($1, NULL, 'pending', $2, 'Booking created')`,
            [header.id, auth.userId],
          );

          await client.query('COMMIT');

          if (env.INVENTORY_LOCK) {
            const doId = env.INVENTORY_LOCK.idFromName(unitId);
            const stub = env.INVENTORY_LOCK.get(doId);
            ctx.waitUntil(stub.releaseHold(auth.userId));
          }
          return {
            id: header.id,
            status: header.status,
            listingId: listing.id,
            startDate,
            endDate,
            days,
            subtotalPaise,
            depositPaise,
            damageWaiverFeePaise: waiverFeePaise,
            totalPaise,
            createdAt: header.createdAt,
          };
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        }
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_CREATED', auth.userId, clientIp, {
        bookingId: bookingResult.id,
        listingId,
        totalPaise: bookingResult.totalPaise,
      });

      emitQueueEvent(env, ctx, 'RENTAL_BOOKING_CREATED', {
        bookingId: bookingResult.id,
        listingId,
        userId: auth.userId,
        startDate,
        endDate,
        totalPaise: bookingResult.totalPaise,
      });

      return jsonResponse({ data: bookingResult }, 201, cors);
    } catch (err: any) {
      console.error('[Rentals] Create error:', err);
      return jsonResponse({ error: { message: err.message, code: 'BOOKING_FAILED' } }, 409, cors);
    }
  }

  // 11. Rentals Bookings - List
  if (path === '/rentals/bookings' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = url.searchParams.get('status');

    try {
      const result = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT 
            b.id, b.status, b.start_date AS "startDate", b.end_date AS "endDate",
            b.subtotal_amount_paise AS "subtotalPaise",
            b.deposit_amount_paise AS "depositPaise",
            b.total_amount_paise AS "totalPaise",
            b.damage_waiver_selected AS "damageWaiverSelected",
            b.created_at AS "createdAt",
            l.id AS "listingId", l.title AS "listingTitle", l.brand AS "listingBrand",
            l.rental_price_paise AS "rentalPricePaise",
            COALESCE(
              (SELECT object_key FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1),
              ''
            ) AS "primaryImageUrl"
          FROM rental_bookings b
          JOIN listings l ON l.id = b.rental_listing_id
          WHERE (b.renter_user_id::text = $1 OR l.owner_user_id::text = $1)
        `;
        const params: any[] = [auth.userId];

        if (statusFilter) {
          params.push(statusFilter);
          sql += ` AND b.status = $${params.length}`;
        }

        sql += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const rowsRes = await client.query(sql, params);

        const countRes = await client.query(
          `SELECT count(*)::int AS total
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE (b.renter_user_id::text = $1 OR l.owner_user_id::text = $1)` +
            (statusFilter ? ` AND b.status = $2` : ''),
          statusFilter ? [auth.userId, statusFilter] : [auth.userId],
        );

        return { items: rowsRes.rows, total: countRes.rows[0]?.total ?? 0 };
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
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 11. Rentals Bookings - Single Detail
  if (path.startsWith('/rentals/bookings/') && !path.includes('/cancel') && !path.includes('/accept')) {
    const bookingId = path.replace('/rentals/bookings/', '');
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const booking = await withDb(env, ctx, async (client) => {
        const sql = `
          SELECT 
            b.id, b.status, b.start_date AS "startDate", b.end_date AS "endDate",
            b.subtotal_amount_paise AS "subtotalPaise",
            b.deposit_amount_paise AS "depositPaise",
            b.total_amount_paise AS "totalPaise",
            b.deposit_paid AS "depositPaid",
            b.damage_waiver_selected AS "damageWaiverSelected",
            b.backup_size AS "backupSize",
            b.created_at AS "createdAt",
            l.id AS "listingId", l.title AS "listingTitle", l.brand AS "listingBrand",
            l.size AS "listingSize", l.condition AS "listingCondition",
            l.owner_user_id AS "ownerUserId", b.renter_user_id AS "renterUserId",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', img.id, 'url', img.object_key, 'isPrimary', img.is_primary))
                FROM listing_images img
                WHERE img.listing_id = l.id
              ), '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', rbi.id, 'itemId', rbi.inventory_item_id, 'dailyRatePaise', rbi.daily_rate_paise,
                  'lineTotalPaise', rbi.line_total_paise, 'isBackupSize', rbi.is_backup_size
                ))
                FROM rental_booking_items rbi
                WHERE rbi.rental_booking_id = b.id
              ), '[]'::json
            ) AS items
          FROM rental_bookings b
          JOIN listings l ON l.id = b.rental_listing_id
          WHERE b.id::text = $1 AND (b.renter_user_id::text = $2 OR l.owner_user_id::text = $2)
          LIMIT 1
        `;
        const res = await client.query(sql, [bookingId, auth.userId]);
        return res.rows[0];
      });

      if (!booking) {
        return jsonResponse({ error: { message: 'Booking not found', code: 'NOT_FOUND' } }, 404, cors);
      }

      return jsonResponse({ data: booking }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 11. Rentals Bookings - Cancel
  if (path.match(/^\/rentals\/bookings\/[^/]+\/cancel$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        const check = await client.query(
          `SELECT b.id, b.status, b.renter_user_id, l.owner_user_id
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id::text = $1 FOR UPDATE`,
          [bookingId],
        );
        const b = check.rows[0];
        if (!b) throw new Error('Booking not found');
        if (b.renter_user_id !== auth.userId && b.owner_user_id !== auth.userId) {
          throw new Error('Not authorized to cancel this booking');
        }
        if (b.status !== 'pending' && b.status !== 'confirmed') {
          throw new Error(`Cannot cancel booking in ${b.status} state`);
        }

        await client.query(`UPDATE rental_bookings SET status = 'cancelled' WHERE id = $1`, [b.id]);
        await client.query(`UPDATE rental_booking_items SET item_status = 'cancelled' WHERE rental_booking_id = $1`, [b.id]);
        await client.query(
          `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
           VALUES ($1, $2, 'cancelled', $3, 'User cancelled booking')`,
          [b.id, b.status, auth.userId],
        );
        await client.query('COMMIT');
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_CANCELLED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        bookingId,
      });

      return jsonResponse({ data: { success: true, status: 'cancelled' } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'CANCEL_FAILED' } }, 400, cors);
    }
  }

  // 11. Rentals Bookings - Accept (Owner)
  if (path.match(/^\/rentals\/bookings\/[^/]+\/accept$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        const check = await client.query(
          `SELECT b.id, b.status, l.owner_user_id
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id::text = $1 FOR UPDATE`,
          [bookingId],
        );
        const b = check.rows[0];
        if (!b) throw new Error('Booking not found');
        if (b.owner_user_id !== auth.userId) {
          throw new Error('Only the listing owner can accept this booking');
        }
        if (b.status !== 'pending') {
          throw new Error(`Cannot accept booking in ${b.status} state`);
        }

        await client.query(`UPDATE rental_bookings SET status = 'confirmed' WHERE id = $1`, [b.id]);
        await client.query(`UPDATE rental_booking_items SET item_status = 'confirmed' WHERE rental_booking_id = $1`, [b.id]);
        await client.query(
          `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
           VALUES ($1, 'pending', 'confirmed', $2, 'Owner accepted booking')`,
          [b.id, auth.userId],
        );
        await client.query('COMMIT');
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_ACCEPTED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        bookingId,
      });

      return jsonResponse({ data: { success: true, status: 'confirmed' } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'ACCEPT_FAILED' } }, 400, cors);
    }
  }

  // 12. Sales Orders - Creation (Pre-loved Resale Purchases)
  if (path === '/orders' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const body = (await request.json()) as any;
      const { listingId } = body;
      if (!listingId) {
        return jsonResponse({ error: { message: 'listingId is required', code: 'INVALID_INPUT' } }, 400, cors);
      }

      const orderResult = await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        try {
          const listingRes = await client.query(
            `SELECT id, is_sale, sale_price_paise, listing_status, owner_user_id
             FROM listings WHERE id::text = $1 FOR SHARE`,
            [listingId],
          );
          const listing = listingRes.rows[0];
          if (!listing || listing.listing_status !== 'active' || !listing.is_sale) {
            throw new Error('Listing is not available for sale');
          }

          if (listing.owner_user_id === auth.userId) {
            throw new Error('You cannot buy your own listing');
          }

          // Allocate physical unit
          const unitRes = await client.query(
            `SELECT inv.id FROM inventory_items inv
             WHERE inv.listing_id = $1 AND inv.operational_status = 'AVAILABLE'
               AND NOT EXISTS (
                 SELECT 1 FROM order_items oi WHERE oi.inventory_item_id = inv.id AND oi.status IN ('pending', 'paid')
               )
             LIMIT 1 FOR UPDATE OF inv SKIP LOCKED`,
            [listing.id],
          );

          if (unitRes.rows.length === 0) {
            throw new Error('No units available for sale');
          }
          const unitId = unitRes.rows[0].id;
          const salePricePaise = Number(listing.sale_price_paise);

          const orderInsert = await client.query(
            `INSERT INTO orders (buyer_user_id, status, total_amount_paise)
             VALUES ($1, 'paid', $2)
             RETURNING id, status, total_amount_paise AS "totalPaise", created_at AS "createdAt"`,
            [auth.userId, salePricePaise],
          );
          const order = orderInsert.rows[0];

          await client.query(
            `INSERT INTO order_items (order_id, inventory_item_id, listing_id, unit_price_paise, status)
             VALUES ($1, $2, $3, $4, 'paid')`,
            [order.id, unitId, listing.id, salePricePaise],
          );

          await client.query(
            `UPDATE inventory_items SET operational_status = 'SOLD' WHERE id = $1`,
            [unitId],
          );

          await client.query('COMMIT');
          return order;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        }
      });

      recordEdgeAudit(env, ctx, 'SALE_ORDER_CREATED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        orderId: orderResult.id,
        listingId,
        totalPaise: orderResult.totalPaise,
      });

      emitQueueEvent(env, ctx, 'ORDER_PLACED', {
        orderId: orderResult.id,
        listingId,
        userId: auth.userId,
        totalPaise: orderResult.totalPaise,
      });

      return jsonResponse({ data: orderResult }, 201, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'ORDER_FAILED' } }, 409, cors);
    }
  }

  // 12. Sales Orders - List
  if (path === '/orders' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const orders = await withDb(env, ctx, async (client) => {
        const sql = `
          SELECT 
            o.id, o.status, o.total_amount_paise AS "totalPaise", o.created_at AS "createdAt",
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', oi.id, 'listingId', l.id, 'listingTitle', l.title,
                  'unitPricePaise', oi.unit_price_paise, 'brand', l.brand,
                  'primaryImageUrl', COALESCE((SELECT object_key FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1), '')
                ))
                FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
                WHERE oi.order_id = o.id
              ), '[]'::json
            ) AS items
          FROM orders o
          WHERE o.buyer_user_id::text = $1
          ORDER BY o.created_at DESC
        `;
        const res = await client.query(sql, [auth.userId]);
        return res.rows;
      });

      return jsonResponse({ data: orders }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 13. Reviews - Listing Reviews or All Reviews
  if ((path === '/reviews' || path.startsWith('/listings/') && path.endsWith('/reviews')) && method === 'GET') {
    let listingId = url.searchParams.get('listingId');
    if (path.startsWith('/listings/') && path.endsWith('/reviews')) {
      listingId = path.replace('/listings/', '').replace('/reviews', '');
    }

    try {
      const reviews = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT 
            r.id, r.rating, r.comment, r.photos, r.status, r.created_at AS "createdAt",
            p.display_name AS "reviewerName", p.avatar_url AS "reviewerAvatar"
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_user_id
          LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE r.status = 'published'
        `;
        const params: any[] = [];
        if (listingId) {
          sql += ` AND (
            r.qualifying_rental_booking_id IN (SELECT id FROM rental_bookings WHERE rental_listing_id::text = $1)
            OR r.qualifying_order_id IN (SELECT order_id FROM order_items WHERE listing_id::text = $1)
          )`;
          params.push(listingId);
        }
        sql += ` ORDER BY r.created_at DESC LIMIT 50`;
        const res = await client.query(sql, params);
        return res.rows;
      });

      return jsonResponse({ data: reviews }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 13. Reviews - Submit Review
  if (path === '/reviews' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const body = (await request.json()) as any;
      const { revieweeUserId, rentalBookingId, orderId, rating, comment, photos } = body;
      const numRating = Number(rating);

      if (!numRating || numRating < 1 || numRating > 5) {
        return jsonResponse({ error: { message: 'Rating must be an integer between 1 and 5', code: 'INVALID_INPUT' } }, 400, cors);
      }

      if (!revieweeUserId || revieweeUserId === auth.userId) {
        return jsonResponse({ error: { message: 'Self-review is not allowed', code: 'SELF_REVIEW' } }, 400, cors);
      }

      if ((!rentalBookingId && !orderId) || (rentalBookingId && orderId)) {
        return jsonResponse({ error: { message: 'Exactly one qualifying booking or order must be provided', code: 'INVALID_TARGET' } }, 400, cors);
      }

      const review = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `INSERT INTO reviews (
             reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id, qualifying_order_id,
             rating, comment, photos, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'published')
           RETURNING id, rating, comment, photos, created_at AS "createdAt"`,
          [
            auth.userId,
            revieweeUserId,
            rentalBookingId || null,
            orderId || null,
            numRating,
            comment ? String(comment).slice(0, 1000) : null,
            JSON.stringify(Array.isArray(photos) ? photos : []),
          ],
        );
        return res.rows[0];
      });

      recordEdgeAudit(env, ctx, 'REVIEW_SUBMITTED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        reviewId: review.id,
        rating: numRating,
      });

      return jsonResponse({ data: review }, 201, cors);
    } catch (err: any) {
      if (err.message.includes('unique') || err.message.includes('reviews_rental_unique')) {
        return jsonResponse({ error: { message: 'Review already submitted for this transaction', code: 'DUPLICATE_REVIEW' } }, 409, cors);
      }
      return jsonResponse({ error: { message: err.message, code: 'REVIEW_FAILED' } }, 500, cors);
    }
  }

  // 14. User Profile (/users/me/profile)
  if (path === '/users/me/profile' && (method === 'GET' || method === 'PUT' || method === 'PATCH')) {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    if (method === 'GET') {
      try {
        const profile = await withDb(env, ctx, async (client) => {
          const res = await client.query(
            `SELECT u.id, u.email, p.display_name AS "displayName", p.phone_number AS "phoneNumber",
                    p.avatar_url AS "avatarUrl", p.bio,
                    COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE u.id::text = $1
             GROUP BY u.id, u.email, p.display_name, p.phone_number, p.avatar_url, p.bio`,
            [auth.userId],
          );
          return res.rows[0];
        });
        return jsonResponse({ data: profile }, 200, cors);
      } catch (err: any) {
        return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
      }
    }

    if (method === 'PUT' || method === 'PATCH') {
      try {
        const body = (await request.json()) as any;
        const { displayName, phoneNumber, bio, avatarUrl } = body;

        const updated = await withDb(env, ctx, async (client) => {
          const res = await client.query(
            `INSERT INTO user_profiles (user_id, display_name, phone_number, bio, avatar_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
               display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
               phone_number = COALESCE(EXCLUDED.phone_number, user_profiles.phone_number),
               bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
               avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
               updated_at = now()
             RETURNING display_name AS "displayName", phone_number AS "phoneNumber", bio, avatar_url AS "avatarUrl"`,
            [
              auth.userId,
              displayName !== undefined ? displayName : null,
              phoneNumber !== undefined ? phoneNumber : null,
              bio !== undefined ? bio : null,
              avatarUrl !== undefined ? avatarUrl : null,
            ],
          );
          return res.rows[0];
        });

        return jsonResponse({ data: updated }, 200, cors);
      } catch (err: any) {
        return jsonResponse({ error: { message: err.message, code: 'UPDATE_FAILED' } }, 500, cors);
      }
    }
  }

  // 14. User Addresses (/users/me/addresses)
  if (path === '/users/me/addresses' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const addresses = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, address_type AS "addressType", full_name AS "fullName", phone_number AS "phoneNumber",
                  line1, line2, city, state, postal_code AS "postalCode", country, is_default AS "isDefault"
           FROM user_addresses
           WHERE user_id::text = $1
           ORDER BY is_default DESC, created_at DESC`,
          [auth.userId],
        );
        return res.rows;
      });
      return jsonResponse({ data: addresses }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  if (path === '/users/me/addresses' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const body = (await request.json()) as any;
      const { addressType, fullName, phoneNumber, line1, line2, city, state, postalCode, country, isDefault } = body;
      if (!fullName || !phoneNumber || !line1 || !city || !postalCode) {
        return jsonResponse({ error: { message: 'Full name, phone, line1, city, and postalCode are required', code: 'INVALID_INPUT' } }, 400, cors);
      }

      const address = await withDb(env, ctx, async (client) => {
        if (isDefault) {
          await client.query(`UPDATE user_addresses SET is_default = false WHERE user_id::text = $1`, [auth.userId]);
        }
        const res = await client.query(
          `INSERT INTO user_addresses (
             user_id, address_type, full_name, phone_number, line1, line2, city, state, postal_code, country, is_default
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, address_type AS "addressType", full_name AS "fullName", phone_number AS "phoneNumber",
                     line1, line2, city, state, postal_code AS "postalCode", country, is_default AS "isDefault"`,
          [
            auth.userId,
            addressType || 'shipping',
            fullName,
            phoneNumber,
            line1,
            line2 || null,
            city,
            state || null,
            postalCode,
            country || 'India',
            Boolean(isDefault),
          ],
        );
        return res.rows[0];
      });

      return jsonResponse({ data: address }, 201, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'INSERT_FAILED' } }, 500, cors);
    }
  }

  if (path.startsWith('/users/me/addresses/') && method === 'DELETE') {
    const addressId = path.replace('/users/me/addresses/', '');
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      await withDb(env, ctx, async (client) => {
        await client.query(`DELETE FROM user_addresses WHERE id::text = $1 AND user_id::text = $2`, [addressId, auth.userId]);
      });
      return jsonResponse({ data: { success: true } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DELETE_FAILED' } }, 500, cors);
    }
  }

  // 15. Inventory Items (/inventory/items)
  if (path === '/inventory/items' && method === 'GET') {
    const listingId = url.searchParams.get('listingId');
    try {
      const items = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT id, listing_id AS "listingId", condition, operational_status AS "operationalStatus",
                 serial_or_sku AS "serialOrSku", created_at AS "createdAt"
          FROM inventory_items
        `;
        const params: any[] = [];
        if (listingId) {
          sql += ` WHERE listing_id::text = $1`;
          params.push(listingId);
        }
        sql += ` ORDER BY created_at DESC LIMIT 50`;
        const res = await client.query(sql, params);
        return res.rows;
      });
      return jsonResponse({ data: items }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 15. Inventory Item DO Locks (/inventory/items/:id/lock and /unlock)
  if (path.match(/^\/inventory\/items\/[^/]+\/lock$/) && method === 'POST') {
    const unitId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const body = (await request.json().catch(() => ({}))) as any;
    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return jsonResponse({ error: { message: 'startDate and endDate required', code: 'INVALID_INPUT' } }, 400, cors);
    }

    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ error: { message: 'Durable Object lock unavailable', code: 'UNAVAILABLE' } }, 503, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub = env.INVENTORY_LOCK.get(doId);
    const lockResult = await stub.acquireHold(auth.userId, startDate, endDate);

    if (!lockResult.success) {
      return jsonResponse({ error: { message: lockResult.reason, code: 'UNIT_LOCKED' } }, 409, cors);
    }

    return jsonResponse({ data: { unitId, ...lockResult } }, 200, cors);
  }

  if (path.match(/^\/inventory\/items\/[^/]+\/unlock$/) && method === 'POST') {
    const unitId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ data: { released: true } }, 200, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub = env.INVENTORY_LOCK.get(doId);
    await stub.releaseHold(auth.userId);

    return jsonResponse({ data: { unitId, released: true } }, 200, cors);
  }

  if (path.match(/^\/inventory\/items\/[^/]+\/lock$/) && method === 'GET') {
    const unitId = path.split('/')[3];
    if (!env.INVENTORY_LOCK) {
      return jsonResponse({ data: { isHeld: false } }, 200, cors);
    }

    const doId = env.INVENTORY_LOCK.idFromName(unitId);
    const stub = env.INVENTORY_LOCK.get(doId);
    const status = await stub.getHoldStatus();

    return jsonResponse({ data: { unitId, ...status } }, 200, cors);
  }

  // 16. Events Test Dispatcher
  if (path === '/events/test' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const body = (await request.json().catch(() => ({}))) as any;
    const eventType = body.type || 'SYSTEM_TEST_PING';
    emitQueueEvent(env, ctx, eventType, {
      userId: auth.userId,
      message: body.message || 'Cloudflare Queues async pipeline test',
    });
    return jsonResponse({ data: { queued: true, type: eventType, queue: 'exchange-events' } }, 202, cors);
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

  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        const event = message.body;
        console.log(`[QueueConsumer] Processing event: ${event.type}`, event);

        // 1. Record event in D1 edge_audit_logs asynchronously
        if (env.EXCHANGE_D1 && event.type) {
          await env.EXCHANGE_D1.prepare(
            'INSERT INTO edge_audit_logs (id, event_type, user_id, ip_address, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
            .bind(
              crypto.randomUUID(),
              `QUEUE_${event.type}`,
              event.payload?.userId || null,
              'queue-consumer',
              JSON.stringify(event.payload || {}),
              Date.now(),
            )
            .run();
        }

        // 2. Perform background dispatch / notification side-effects
        if (event.type === 'RENTAL_BOOKING_CREATED') {
          console.log(`[QueueConsumer:Logistics] Prepared courier dispatch notification for booking ${event.payload?.bookingId}`);
        } else if (event.type === 'ORDER_PLACED') {
          console.log(`[QueueConsumer:Fulfillment] Prepared packaging notification for order ${event.payload?.orderId}`);
        }

        message.ack();
      } catch (err) {
        console.error('[QueueConsumer] Error processing message:', err);
        message.retry({ delaySeconds: 15 });
      }
    }
  },
} satisfies ExportedHandler<Env>;
