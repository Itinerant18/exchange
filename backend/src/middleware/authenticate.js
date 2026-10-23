// Authentication middleware: verifies a Bearer HS256 access token, loads the
// user, and refuses suspended/deleted accounts. Sets req.authUser.

import { AppError } from '../appErrors/AppError.js';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';

export function extractBearerToken(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim();
}

export async function authenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError('Authentication is required.', { statusCode: 401, code: 'UNAUTHENTICATED' });
    }

    const payload = verifyAccessToken(token, { secret: env.auth.jwtSecret });
    if (!payload?.sub) {
      throw new AppError('The access token is invalid or has expired.', { statusCode: 401, code: 'INVALID_TOKEN' });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.status,
              COALESCE(
                  (SELECT array_agg(r.role_name ORDER BY r.role_name)
                   FROM public.user_roles r WHERE r.user_id = u.id),
                  '{}'
              ) AS roles
       FROM public.users u
       WHERE u.id = $1
       LIMIT 1`,
      [payload.sub],
    );

    const user = rows[0];
    if (!user) {
      throw new AppError('The access token is invalid or has expired.', { statusCode: 401, code: 'INVALID_TOKEN' });
    }
    if (user.status !== 'active') {
      throw new AppError('This account is no longer active.', { statusCode: 403, code: 'ACCOUNT_NOT_ACTIVE' });
    }

    req.authUser = Object.freeze({
      id: user.id,
      email: user.email,
      roles: user.roles ?? [],
      isAdmin: user.roles?.includes('admin') ?? false,
    });
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication for public endpoints that behave differently for the
 * owner (e.g. listing detail visibility). A present-but-invalid token degrades
 * to anonymous instead of failing a public read; a valid token sets
 * req.authUser exactly like authenticate().
 */
export async function maybeAuthenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (token) {
      try {
        const payload = verifyAccessToken(token, { secret: env.auth.jwtSecret });
        if (payload?.sub) {
          const { rows } = await pool.query(
            `SELECT u.id, u.email, u.status,
                    COALESCE(
                        (SELECT array_agg(r.role_name ORDER BY r.role_name)
                         FROM public.user_roles r WHERE r.user_id = u.id),
                        '{}'
                    ) AS roles
             FROM public.users u
             WHERE u.id = $1
             LIMIT 1`,
            [payload.sub],
          );
          const user = rows[0];
          if (user && user.status === 'active') {
            req.authUser = Object.freeze({
              id: user.id,
              email: user.email,
              roles: user.roles ?? [],
              isAdmin: user.roles?.includes('admin') ?? false,
            });
          }
        }
      } catch {
        // Invalid/expired tokens mean "anonymous" on public endpoints.
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Factory: requires the authenticated user to hold one of the roles. */
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.authUser) {
      next(new AppError('Authentication is required.', { statusCode: 401, code: 'UNAUTHENTICATED' }));
      return;
    }
    const hasRole = allowedRoles.some((role) => req.authUser.roles.includes(role));
    if (!hasRole) {
      next(new AppError('You do not have permission to perform this action.', { statusCode: 403, code: 'FORBIDDEN' }));
      return;
    }
    next();
  };
}
