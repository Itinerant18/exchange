import { AppError } from '../../appErrors/AppError.js';
import { pool, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import {
  hashPassword,
  isAcceptablePassword,
  passwordPolicyError,
  verifyPassword,
} from '../../utils/passwordCrypto.js';
import { signAccessToken } from '../../utils/jwt.js';
import { generateRefreshToken, hashRefreshToken } from '../../utils/refreshTokens.js';
import {
  findRefreshSessionByTokenHash,
  findUserByEmail,
  findUserByIdForAuth,
  insertRefreshSession,
  registerUserTransaction,
  revokeAllSessionsForUser,
  revokeRefreshSession,
  touchLastLogin,
} from './auth.repository.js';

const ACCESS_TTL_SECONDS = env.auth.accessTokenTtlSeconds;
const REFRESH_TTL_DAYS = env.auth.refreshTokenTtlDays;

function buildAccessToken(user, roles) {
  return signAccessToken(
    { sub: user.id, email: user.email, roles },
    { secret: env.auth.jwtSecret, ttlSeconds: ACCESS_TTL_SECONDS },
  );
}

function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Registers a user (active + base roles), then issues tokens.
 * `roles` come from the transaction (always customer + seller for MVP).
 */
export async function registerUser({ email, password, displayName }) {
  if (!isAcceptablePassword(password)) {
    throw new AppError(passwordPolicyError(), { statusCode: 400, code: 'WEAK_PASSWORD' });
  }

  const passwordHash = await hashPassword(password);

  let created;
  let roles = ['customer', 'seller'];
  try {
    created = await withTransaction((client) => registerUserTransaction({ client, email, passwordHash, displayName }));
  } catch (error) {
    if (error?.code === '23505') {
      throw new AppError('An account with this email already exists.', { statusCode: 409, code: 'EMAIL_ALREADY_REGISTERED', cause: error });
    }
    if (error?.code === '23514') {
      throw new AppError('The provided email address is not valid.', { statusCode: 400, code: 'INVALID_EMAIL', cause: error });
    }
    throw error;
  }

  const accessToken = buildAccessToken(created, roles);
  const { refreshToken } = await issueRefreshToken(created.id);
  return { user: publicUser(created, displayName, roles), accessToken, refreshToken };
}

export async function login({ email, password }) {
  const user = await findUserByEmail(String(email ?? ''));
  // Uniform failure so account existence is not disclosed by timing/shape alone.
  const failure = new AppError('Invalid email or password.', { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  if (!user) {
    // Perform a verification pass to keep response time comparable.
    await verifyPassword(password ?? '', 'scrypt$1$$x$y$z');
    throw failure;
  }
  if (user.status !== 'active') {
    throw new AppError('This account is not permitted to sign in.', { statusCode: 403, code: 'ACCOUNT_NOT_ACTIVE' });
  }

  const ok = await verifyPassword(password ?? '', user.password_hash);
  if (!ok) throw failure;

  const roles = await loadRoles(user.id);
  await touchLastLogin(user.id);

  const accessToken = buildAccessToken({ id: user.id, email: user.email }, roles);
  const refreshToken = await issueRefreshToken(user.id);
  return { user: publicUser({ id: user.id, email: user.email }, null, roles), accessToken, refreshToken };
}

async function loadRoles(userId) {
  const { rows } = await pool.query(
    `SELECT role_name FROM public.user_roles WHERE user_id = $1 ORDER BY role_name`,
    [userId],
  );
  return rows.map((row) => row.role_name);
}

/** Creates a refresh session row; returns the plaintext token for the cookie. */
async function issueRefreshToken(userId) {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  await insertRefreshSession({ userId, tokenHash, expiresAt: refreshExpiry() });
  return { refreshToken: token };
}

export async function refreshSession(token) {
  const failure = new AppError('The refresh session is invalid or has expired.', { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  if (!token) throw failure;

  const tokenHash = hashRefreshToken(token);
  const session = await findRefreshSessionByTokenHash(tokenHash);
  if (!session) throw failure;

  // Reuse of a revoked token: aggressive protection — revoke everything.
  if (session.revoked_at) {
    await revokeAllSessionsForUser(session.user_id);
    throw failure;
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw failure;
  }

  const user = await findUserByIdForAuth(session.user_id);
  if (!user || user.status !== 'active') {
    await revokeRefreshSession(session.id);
    throw failure;
  }

  // Rotate: old token revoked, new token minted for the same user.
  const newToken = generateRefreshToken();
  const newHash = hashRefreshToken(newToken);
  await withTransaction(async (client) => {
    await revokeRefreshSession(session.id, client);
    await insertRefreshSession({ userId: user.id, tokenHash: newHash, expiresAt: refreshExpiry() }, client);
  });

  const accessToken = buildAccessToken(user, user.roles ?? []);
  return { user: publicUser(user, user.display_name, user.roles ?? []), accessToken, refreshToken: newToken };
}

export async function logout(token) {
  if (!token) return;
  const tokenHash = hashRefreshToken(token);
  const session = await findRefreshSessionByTokenHash(tokenHash);
  if (session) {
    await revokeRefreshSession(session.id);
  }
}

export async function getCurrentUser(userId) {
  const user = await findUserByIdForAuth(userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    roles: user.roles ?? [],
    displayName: user.display_name ?? null,
    phoneNumber: user.phone_number ?? null,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function publicUser(user, displayName, roles) {
  return {
    id: user.id,
    email: user.email,
    displayName: displayName ?? null,
    roles,
    status: user.status ?? 'active',
  };
}
