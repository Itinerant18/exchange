import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';
import { recordEdgeAudit, storeEdgeSession, invalidateEdgeSession } from '../../services/d1Client';
import { checkEdgeRateLimit } from '../../middleware/ratelimit';
import { extractTurnstileToken, verifyTurnstileToken } from '../../middleware/turnstile';
import { hashPassword, verifyPassword, signJwt, extractBearerUser, hashToken } from '../../middleware/auth';

export async function handleAuthRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  // 1. Register
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

      const turnstileToken = extractTurnstileToken(request, body);
      if (turnstileToken || env.REQUIRE_TURNSTILE === 'true') {
        const turnstile = await verifyTurnstileToken(turnstileToken, clientIp, env.TURNSTILE_SECRET, 'signup');
        if (!turnstile.success) {
          recordEdgeAudit(env, ctx, 'AUTH_REGISTER_TURNSTILE_BLOCKED', null, clientIp, { error: turnstile.error });
          return jsonResponse(
            { error: { message: 'Bot verification challenge failed. Please verify you are human.', code: 'TURNSTILE_FAILED' } },
            403,
            cors,
          );
        }
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
        storeEdgeSession(env, ctx, sessionTokenHash, user.id, user.email, user.roles);
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

  // 2. Login
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

      const turnstileToken = extractTurnstileToken(request, body);
      if (turnstileToken || env.REQUIRE_TURNSTILE === 'true') {
        const turnstile = await verifyTurnstileToken(turnstileToken, clientIp, env.TURNSTILE_SECRET, 'login');
        if (!turnstile.success) {
          recordEdgeAudit(env, ctx, 'AUTH_LOGIN_TURNSTILE_BLOCKED', null, clientIp, { error: turnstile.error });
          return jsonResponse(
            { error: { message: 'Bot verification challenge failed. Please verify you are human.', code: 'TURNSTILE_FAILED' } },
            403,
            cors,
          );
        }
      }

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
        storeEdgeSession(env, ctx, sessionTokenHash, user.id, user.email, userData.roles);
      }

      recordEdgeAudit(env, ctx, 'AUTH_LOGIN_SUCCESS', user.id, clientIp, { email: user.email });

      return jsonResponse({ data: { user: userData, accessToken } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'LOGIN_FAILED' } }, 500, cors);
    }
  }

  // 3. Me
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

  // 4. Logout
  if (path === '/auth/logout') {
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ') && env.EXCHANGE_D1) {
      const token = authHeader.substring(7).trim();
      const tokenHash = hashToken(token, jwtSecret);
      invalidateEdgeSession(env, ctx, tokenHash);
    }
    return jsonResponse({ data: { success: true } }, 200, cors);
  }

  // 5. Refresh
  if (path === '/auth/refresh' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Invalid token', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const accessToken = signJwt({ sub: auth.userId }, jwtSecret);
    return jsonResponse({ data: { accessToken } }, 200, cors);
  }

  // 6. Favorites
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

  // 7. Profile
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

  // 8. Addresses
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

  return null;
}

