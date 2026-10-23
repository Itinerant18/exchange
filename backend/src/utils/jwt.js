// Minimal HS256 JWT helper (sign/verify) built on node:crypto. No external
// JWT dependency. Access tokens only; refresh tokens are opaque random values.

import { createHmac, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url');
}

/**
 * Creates a signed HS256 token. payload should be a plain object; exp is
 * injected here.
 */
export function signAccessToken(payload, { secret, ttlSeconds }) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  }));
  const segment = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(segment).digest();
  return `${segment}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies a token's signature and expiry. Returns the payload or null.
 * Very large or malformed inputs return null; no information is logged.
 */
export function verifyAccessToken(token, { secret }) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  let parsedHeader;
  try {
    parsedHeader = JSON.parse(base64UrlDecode(header).toString('utf8'));
  } catch {
    return null;
  }
  if (parsedHeader?.alg !== 'HS256' || parsedHeader?.typ !== 'JWT') return null;

  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const supplied = base64UrlDecode(signature);
  if (supplied.length !== expected.length) return null;
  if (!timingSafeEqual(supplied, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number') return null;
  if (payload.exp * 1000 <= Date.now()) return null;

  return payload;
}
