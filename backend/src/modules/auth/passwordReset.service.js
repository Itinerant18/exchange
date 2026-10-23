// Password recovery: single-use hashed tokens, 1h expiry, revoke-all on use.
// Dev/staging surfaces the token in the response so the flow can be tested
// without an email provider; production must wire an email sender and NOT
// leak the token.

import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { pool } from '../../config/database.js';

export async function requestPasswordReset({ email }) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT id FROM public.users WHERE email = $1 AND is_active = true LIMIT 1`,
    [normalized],
  );
  const user = rows[0] ?? null;
  if (!user) {
    return { ok: true };
  }

  const plaintext = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(plaintext, 'utf8').digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE public.password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );
    await client.query(
      `INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hash, expiresAt],
    );
  });

  if (process.env.NODE_ENV !== 'production') {
    return { ok: true, devToken: plaintext };
  }
  return { ok: true };
}

export async function resetPassword({ token, newPassword }) {
  if (typeof token !== 'string' || token.length !== 64) {
    throw new AppError('The reset token is not valid.', { statusCode: 400, code: 'INVALID_TOKEN' });
  }
  const { isAcceptablePassword, hashPassword } = await import('../../utils/passwordCrypto.js');
  if (!isAcceptablePassword(newPassword)) {
    throw new AppError('The new password does not meet the policy.', { statusCode: 400, code: 'WEAK_PASSWORD' });
  }

  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM public.password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [hash],
    );
    const record = rows[0];
    if (!record || record.used_at !== null || new Date(record.expires_at) < new Date()) {
      throw new AppError('The reset token is invalid or has expired.', { statusCode: 400, code: 'INVALID_TOKEN' });
    }

    const passwordHash = await hashPassword(newPassword);
    await client.query(
      `UPDATE public.users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [record.user_id, passwordHash],
    );
    await client.query(
      `UPDATE public.password_reset_tokens SET used_at = now() WHERE id = $1`,
      [record.id],
    );
    await client.query(
      `UPDATE public.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [record.user_id],
    );
    await writeAuditLog(client, {
      userId: record.user_id,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: record.user_id,
    });
    return { ok: true };
  });
}
