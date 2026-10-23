import { pool } from '../../config/database.js';

/** Finds an active-leaning user by lowercased email (any status). */
export async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, status FROM public.users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

/**
 * Registration transaction: user + profile + base roles must all exist or
 * none. Returns the created user row.
 */
export async function registerUserTransaction({ client, email, passwordHash, displayName }) {
  const { rows: userRows } = await client.query(
    `INSERT INTO public.users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, status, created_at`,
    [email.toLowerCase(), passwordHash],
  );
  const user = userRows[0];

  await client.query(
    `INSERT INTO public.user_profiles (user_id, display_name) VALUES ($1, $2)`,
    [user.id, displayName],
  );

  await client.query(
    `INSERT INTO public.user_roles (user_id, role_name)
     VALUES ($1, 'customer'), ($1, 'seller')`,
    [user.id],
  );

  return user;
}

export async function findUserByIdForAuth(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.status, u.last_login_at, u.created_at, u.updated_at,
            p.display_name, p.phone_number,
            COALESCE(
                (SELECT array_agg(r.role_name ORDER BY r.role_name)
                 FROM public.user_roles r WHERE r.user_id = u.id),
                '{}'
            ) AS roles
     FROM public.users u
     LEFT JOIN public.user_profiles p ON p.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function touchLastLogin(userId, client = pool) {
  await (client ?? pool).query(
    `UPDATE public.users SET last_login_at = now() WHERE id = $1`,
    [userId],
  );
}

export async function insertRefreshSession({ userId, tokenHash, expiresAt }, client = pool) {
  const { rows } = await (client ?? pool).query(
    `INSERT INTO public.refresh_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, tokenHash, expiresAt],
  );
  return rows[0];
}

/** Unused; sessions create their own rows through findByTokenHash/revocation. */
export async function findRefreshSessionByTokenHash(tokenHash) {
  const { rows } = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at FROM public.refresh_sessions WHERE token_hash = $1 LIMIT 1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function revokeRefreshSession(sessionId, client) {
  await (client ?? pool).query(
    `UPDATE public.refresh_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId],
  );
}

export async function revokeAllSessionsForUser(userId, client) {
  await (client ?? pool).query(
    `UPDATE public.refresh_sessions SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
