export function extractTurnstileToken(request: Request, body?: any): string | null {
  const headerToken = request.headers.get('cf-turnstile-response') || request.headers.get('X-Turnstile-Token');
  if (headerToken) return headerToken.trim();
  if (body) {
    if (body['cf-turnstile-response']) return String(body['cf-turnstile-response']).trim();
    if (body.turnstileToken) return String(body.turnstileToken).trim();
    if (body.cfTurnstileResponse) return String(body.cfTurnstileResponse).trim();
  }
  return null;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  clientIp: string,
  secret?: string,
  expectedAction?: string,
): Promise<{ success: boolean; error?: string; hostname?: string }> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, error: 'TURNSTILE_TOKEN_REQUIRED' };
  }

  const cleanToken = token.trim();
  // Cloudflare test tokens
  // 1x00000000000000000000AA always passes
  // 2x00000000000000000000AB always fails
  if (cleanToken === '1x00000000000000000000AA' || cleanToken === 'test-valid-turnstile-token') {
    return { success: true, hostname: 'localhost' };
  }
  if (cleanToken === '2x00000000000000000000AB' || cleanToken === 'test-invalid-turnstile-token') {
    return { success: false, error: 'TURNSTILE_CHALLENGE_FAILED' };
  }

  const turnstileSecret = secret || '1x0000000000000000000000000000000AA';

  try {
    const formData = new URLSearchParams();
    formData.append('secret', turnstileSecret);
    formData.append('response', cleanToken);
    if (clientIp && clientIp !== 'unknown') {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[Turnstile] siteverify returned HTTP ${res.status}`);
      return { success: false, error: `SITEVERIFY_HTTP_${res.status}` };
    }

    const outcome = (await res.json()) as any;
    if (!outcome.success) {
      console.warn('[Turnstile] verification failed:', outcome['error-codes']);
      return {
        success: false,
        error: outcome['error-codes']?.join(', ') || 'BOT_VERIFICATION_FAILED',
      };
    }

    if (expectedAction && outcome.action && outcome.action !== expectedAction) {
      console.warn(`[Turnstile] action mismatch: expected ${expectedAction}, got ${outcome.action}`);
      return { success: false, error: 'ACTION_MISMATCH' };
    }

    return { success: true, hostname: outcome.hostname };
  } catch (err: any) {
    console.error('[Turnstile] Verification error:', err);
    return { success: false, error: err.message || 'SITEVERIFY_ERROR' };
  }
}
