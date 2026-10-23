// Password hashing with Node's built-in scrypt KDF (memory-hard).
// Stored format: scrypt$N$r$p$<salt-base64url>$<hash-base64url>

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH_BYTES = 64;
// OWASP-recommended, memory-hard parameters (N=2^15, r=8, p=1 → 32 MiB).
const SCRYPT_PARAMS = { N: 32_768, r: 8, p: 1 };
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;

export function isAcceptablePassword(password) {
  return typeof password === 'string'
    && password.length >= PASSWORD_MIN_LENGTH
    && password.length <= PASSWORD_MAX_LENGTH
    && /[a-zA-Z]/.test(password)
    && /\d/.test(password);
}

export function passwordPolicyError() {
  return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and contain letters and digits.`;
}

export async function hashPassword(password) {
  if (!isAcceptablePassword(password)) {
    throw new Error(passwordPolicyError());
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH_BYTES, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64url');
  try {
    const derived = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Exposes the policy bounds for validation layers. */
export const passwordBounds = Object.freeze({
  min: PASSWORD_MIN_LENGTH,
  max: PASSWORD_MAX_LENGTH,
});
