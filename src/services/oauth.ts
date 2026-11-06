import type { KVNamespace } from '@cloudflare/workers-types';

export interface OAuthUserInfo {
  email: string;
  sub: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export type OAuthResult =
  | { success: true; user: OAuthUserInfo; error?: never }
  | { success: false; error: string; user?: never };

interface AppleJwkKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleJwksResponse {
  keys: AppleJwkKey[];
}

/**
 * Validates Google ID tokens via Google's tokeninfo endpoint.
 */
export async function verifyGoogleToken(
  credential: string,
  expectedAudience?: string,
): Promise<OAuthResult> {
  if (!credential || typeof credential !== 'string') {
    return { success: false, error: 'Missing Google credential' };
  }

  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as any;
      const errMsg = errJson?.error_description || errJson?.error || res.statusText;
      return { success: false, error: `Google verification failed: ${errMsg}` };
    }

    const data = (await res.json()) as any;
    if (!data || !data.email) {
      return { success: false, error: 'Google credential did not return an email address' };
    }

    const emailVerified = data.email_verified === 'true' || data.email_verified === true;
    if (!emailVerified) {
      return { success: false, error: 'Google email is not verified' };
    }

    if (expectedAudience && expectedAudience.trim() && data.aud !== expectedAudience.trim()) {
      return { success: false, error: 'Google token audience mismatch' };
    }

    return {
      success: true,
      user: {
        email: String(data.email).toLowerCase().trim(),
        sub: String(data.sub || ''),
        displayName: data.name ? String(data.name).trim() : null,
        avatarUrl: data.picture ? String(data.picture).trim() : null,
      },
    };
  } catch (err: any) {
    return { success: false, error: `Google authentication network failure: ${err.message}` };
  }
}

async function getApplePublicKeys(kv?: KVNamespace): Promise<AppleJwkKey[]> {
  const cacheKey = 'cache:apple:jwks';
  if (kv) {
    try {
      const cached = await kv.get(cacheKey, 'json');
      if (cached && Array.isArray((cached as any).keys)) {
        return (cached as any).keys;
      }
    } catch {
      // Continue to upstream fetch on cache miss/error
    }
  }

  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) {
    throw new Error(`Failed to fetch Apple public keys: ${res.statusText}`);
  }

  const data = (await res.json()) as AppleJwksResponse;
  if (kv && data?.keys) {
    try {
      await kv.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });
    } catch {
      // Non-fatal if cache write fails
    }
  }
  return data.keys || [];
}

/**
 * Validates Apple Sign-In identity tokens (RS256 JWTs) against Apple's public keys.
 */
export async function verifyAppleToken(
  idToken: string,
  expectedAudience?: string,
  kv?: KVNamespace,
): Promise<OAuthResult> {
  if (!idToken || typeof idToken !== 'string') {
    return { success: false, error: 'Missing Apple identity token' };
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    return { success: false, error: 'Malformed Apple identity token' };
  }

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // 1. Verify issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      return { success: false, error: 'Invalid Apple token issuer' };
    }

    // 2. Verify token expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return { success: false, error: 'Apple token has expired' };
    }

    // 3. Verify audience if configured
    if (expectedAudience && expectedAudience.trim() && payload.aud !== expectedAudience.trim()) {
      return { success: false, error: 'Apple token audience mismatch' };
    }

    // 4. Verify cryptographic signature via Apple's JWKS
    const keys = await getApplePublicKeys(kv);
    const matchingKey = keys.find((k) => k.kid === header.kid);
    if (!matchingKey) {
      return { success: false, error: `Apple signing key not found for kid: ${header.kid}` };
    }

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchingKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' },
      },
      false,
      ['verify'],
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = Buffer.from(sigB64, 'base64url');

    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
    if (!isValid) {
      return { success: false, error: 'Apple token signature verification failed' };
    }

    const safeSub = String(payload.sub || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');

    const email = payload.email
      ? String(payload.email).toLowerCase().trim()
      : `apple.${safeSub.slice(0, 32)}@privaterelay.appleid.com`;

    return {
      success: true,
      user: {
        email,
        sub: String(payload.sub),
        displayName: null,
        avatarUrl: null,
      },
    };
  } catch (err: any) {
    return { success: false, error: `Apple verification failure: ${err.message}` };
  }
}
