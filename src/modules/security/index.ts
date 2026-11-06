import type { Env } from '../../types';
import { jsonResponse, emitQueueEvent } from '../../types';
import { extractBearerUser } from '../../middleware/auth';
import { extractTurnstileToken, verifyTurnstileToken } from '../../middleware/turnstile';

export async function handleSecurityRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  const jwtSecret = env.AUTH_JWT_SECRET || 'exchnage_default_production_jwt_secret_min32';

  // 1. Events Test Dispatcher
  if (path === '/events/test' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const body = (await request.json().catch(() => ({}))) as any;
    const eventType = body.type || 'SYSTEM_TEST_PING';
    emitQueueEvent(env, ctx, eventType, {
      userId: auth.userId,
      message: body.message || 'Cloudflare Queues async pipeline test',
    });
    return jsonResponse({ data: { queued: true, type: eventType, queue: 'exchange-events' } }, 202, cors);
  }

  // 2. Turnstile Bot Verification Endpoint
  if (path === '/security/turnstile/verify' && method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const body = (await request.json().catch(() => ({}))) as any;
    const token = extractTurnstileToken(request, body) || body.token;
    const action = body.action || undefined;

    const result = await verifyTurnstileToken(token, clientIp, env.TURNSTILE_SECRET, action);
    if (!result.success) {
      return jsonResponse({ data: { valid: false, error: result.error } }, 403, cors);
    }
    return jsonResponse(
      {
        data: {
          valid: true,
          hostname: result.hostname,
          sitekey: env.TURNSTILE_SITEKEY || '0x4AAAAAAF2CZKS04qmu5moS',
        },
      },
      200,
      cors,
    );
  }

  return null;
}
