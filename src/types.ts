import type { InventoryLockDO } from './durable-objects/InventoryLockDO';

export type RentalWorkflowParams = {
  bookingId: string;
  renterUserId: string;
  startDate: string;
  endDate: string;
  totalPaise: number;
};

export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE?: Hyperdrive;
  EXCHANGE_D1?: D1Database;
  EXCHANGE_KV?: KVNamespace;
  EVENT_QUEUE?: Queue<any>;
  INVENTORY_LOCK?: DurableObjectNamespace<InventoryLockDO>;
  RENTAL_WORKFLOW?: Workflow<RentalWorkflowParams>;
  EXCHANGE_R2?: R2Bucket;
  UPLOADS_BUCKET?: R2Bucket;
  AUTH_JWT_SECRET?: string;
  API_PREFIX?: string;
  PLATFORM_NAME?: string;
  PLATFORM_CURRENCY?: string;
  PLATFORM_TIMEZONE?: string;
  TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
  REQUIRE_TURNSTILE?: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    cursor?: string | null;
    truncated?: boolean;
  };
  error?: {
    message: string;
    code: string;
  };
  message?: string;
}

export interface AuthUser {
  userId: string;
  role?: string;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

export function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID, cf-turnstile-response, X-Turnstile-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse<T>(
  body: ApiResponse<T>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

export function emitQueueEvent(
  env: Env,
  ctx: ExecutionContext,
  eventType: string,
  payload: Record<string, unknown> = {},
): void {
  if (!env.EVENT_QUEUE) return;
  ctx.waitUntil(
    env.EVENT_QUEUE.send({
      type: eventType,
      payload,
      timestamp: Date.now(),
    }).catch((err) => console.error('[QueueProducer] Failed to send event:', err)),
  );
}

// Fail closed: a missing/weak secret must never fall back to a guessable default (token forgery).
export function requireJwtSecret(env: Env): string {
  const secret = env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_JWT_SECRET is not configured');
  return secret;
}
