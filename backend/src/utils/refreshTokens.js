// Refresh tokens: opaque 256-bit random values delivered as HttpOnly cookies.
// Only their SHA-256 digest is stored in refresh_sessions.

import { createHash, randomBytes } from 'node:crypto';

export function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
