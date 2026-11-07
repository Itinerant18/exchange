/**
 * Cloudflare Worker for Exchnage
 * Full-stack luxury occasion-wear rental & circular resale platform.
 * Complete serverless backend integrated with Cloudflare Hyperdrive (Neon PostgreSQL),
 * D1 SQLite edge database, KV caching, Durable Objects, Workflows, Queues, R2, and Static Assets.
 */

import type { Env, RentalWorkflowParams } from './types';
import { getCorsHeaders, SECURITY_HEADERS, jsonResponse } from './types';
import { InventoryLockDO } from './durable-objects/InventoryLockDO';
import { RentalLifecycleWorkflow } from './workflows/RentalWorkflow';
import { AppError } from './utils/errors';
import { recordEdgeAudit } from './services/d1Client';

import { handleHealthRoutes } from './modules/health';
import { handleCategoriesRoutes } from './modules/categories';
import { handleListingsRoutes } from './modules/listings';
import { handleAuthRoutes } from './modules/auth';
import { handleInventoryRoutes } from './modules/inventory';
import { handleRentalsRoutes } from './modules/rentals';
import { handleOrdersRoutes } from './modules/orders';
import { handleDepositsRoutes } from './modules/deposits';
import { handlePaymentsRoutes } from './modules/payments';
import { handleReviewsRoutes } from './modules/reviews';
import { handleMediaRoutes } from './modules/media';
import { handleSecurityRoutes } from './modules/security';
import { handleAdminRoutes } from './modules/admin';

export { InventoryLockDO };
export { RentalLifecycleWorkflow };
export type { Env, RentalWorkflowParams };

/**
 * Main API Router dispatching requests to modular route handlers
 */
async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const method = request.method;

  try {
    // 1. Health & readiness checks
    const healthRes = await handleHealthRoutes(request, env, ctx, path, method, cors);
    if (healthRes) return healthRes;

    // 2. Categories & taxonomy
    const categoriesRes = await handleCategoriesRoutes(request, env, ctx, path, method, cors);
    if (categoriesRes) return categoriesRes;

    // 3. Listings catalog & items
    const listingsRes = await handleListingsRoutes(request, env, ctx, path, method, cors, url);
    if (listingsRes) return listingsRes;

    // 4. Authentication, user profile & addresses
    const authRes = await handleAuthRoutes(request, env, ctx, path, method, cors);
    if (authRes) return authRes;

    // 5. Inventory items & Durable Object holds
    const inventoryRes = await handleInventoryRoutes(request, env, ctx, path, method, cors, url);
    if (inventoryRes) return inventoryRes;

    // 6. Rentals bookings & workflows
    const rentalsRes = await handleRentalsRoutes(request, env, ctx, path, method, cors, url);
    if (rentalsRes) return rentalsRes;

    // 7. Orders & pre-loved resale purchases
    const ordersRes = await handleOrdersRoutes(request, env, ctx, path, method, cors);
    if (ordersRes) return ordersRes;

    // 8. Deposits & financial escrow
    const depositsRes = await handleDepositsRoutes(request, env, ctx, path, method, cors);
    if (depositsRes) return depositsRes;

    // 8b. Deposit payments (renter initiates, admin confirms offline receipt)
    const paymentsRes = await handlePaymentsRoutes(request, env, ctx, path, method, cors);
    if (paymentsRes) return paymentsRes;

    // 9. Reviews & ratings
    const reviewsRes = await handleReviewsRoutes(request, env, ctx, path, method, cors, url);
    if (reviewsRes) return reviewsRes;

    // 10. Media uploads & object management
    const mediaRes = await handleMediaRoutes(request, env, ctx, path, method, cors, url);
    if (mediaRes) return mediaRes;

    // 11. Turnstile bot challenge & queue events testing
    const securityRes = await handleSecurityRoutes(request, env, ctx, path, method, cors);
    if (securityRes) return securityRes;

    // 12. Administration & analytics
    const adminRes = await handleAdminRoutes(request, env, ctx, path, method, cors, url);
    if (adminRes) return adminRes;

    // Fallback for unhandled API endpoints
    return jsonResponse(
      {
        error: {
          message: `Endpoint ${method} ${url.pathname} not found`,
          code: 'NOT_FOUND',
        },
      },
      404,
      cors,
    );
  } catch (err: any) {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    if (err instanceof AppError) {
      return jsonResponse(
        {
          error: {
            message: err.message,
            code: err.code,
            details: err.details,
            retryable: err.retryable,
          },
          requestId,
        } as any,
        err.status,
        { ...cors, 'x-request-id': requestId },
      );
    }

    console.error(`[ApiRouter][${requestId}] Unhandled error:`, err);
    recordEdgeAudit(env, ctx, 'SYSTEM_UNHANDLED_ERROR', null, clientIp, {
      requestId,
      error: String(err?.message || err),
    });

    return jsonResponse(
      {
        error: {
          message: 'An unexpected server pause occurred. Please try again shortly.',
          code: 'SYSTEM_INTERNAL_ERROR',
        },
        requestId,
      } as any,
      500,
      { ...cors, 'x-request-id': requestId },
    );
  }
}

// ---------------------------------------------------------------------- Worker Entrypoint

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          ...SECURITY_HEADERS,
        },
      });
    }

    // 1. API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx, url, cors);
    }

    // 2. Uploaded image retrieval from R2 or Edge KV Cache
    if (url.pathname.startsWith('/uploads/')) {
      const key = url.pathname.replace(/^\/uploads\//, '');
      const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
      if (bucket) {
        try {
          const object = await bucket.get(key);
          if (object) {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            headers.set('X-Media-Source', 'cloudflare-r2');
            return new Response(object.body, { headers });
          }
        } catch (err) {
          console.warn('[R2] Object retrieval error:', err);
        }
      }

      // KV Fallback Cache
      if (env.EXCHANGE_KV) {
        try {
          const { value, metadata } = await env.EXCHANGE_KV.getWithMetadata<{ mimeType?: string }>(
            `r2_cache:${key}`,
            { type: 'arrayBuffer' },
          );
          if (value) {
            const headers = new Headers();
            headers.set('Content-Type', metadata?.mimeType || 'image/jpeg');
            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            headers.set('X-Media-Source', 'cloudflare-kv-fallback');
            return new Response(value, { headers });
          }
        } catch (err) {
          console.warn('[KV] Media retrieval error:', err);
        }
      }

      // If media object is not found, return 404 directly rather than falling through to SPA HTML
      return new Response(
        JSON.stringify({ error: { message: `Media object "${key}" not found`, code: 'NOT_FOUND' } }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...cors,
          },
        },
      );
    }

    // 3. Cloudflare Workers Static Assets (React 19 SPA)
    try {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        return asset;
      }
    } catch (err) {
      console.warn('[Assets] Asset fallback:', err);
    }

    return env.ASSETS.fetch(request);
  },

  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        const event = message.body;
        console.log(`[QueueConsumer] Processing event: ${event.type}`, event);

        // 1. Record event in D1 edge_audit_logs asynchronously
        if (env.EXCHANGE_D1 && event.type) {
          await env.EXCHANGE_D1.prepare(
            'INSERT INTO edge_audit_logs (id, event_type, user_id, ip_address, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
            .bind(
              crypto.randomUUID(),
              `QUEUE_${event.type}`,
              event.payload?.userId || null,
              'queue-consumer',
              JSON.stringify(event.payload || {}),
              Date.now(),
            )
            .run();
        }

        // 2. Perform background dispatch / notification side-effects
        if (event.type === 'RENTAL_BOOKING_CREATED') {
          console.log(`[QueueConsumer:Logistics] Prepared courier dispatch notification for booking ${event.payload?.bookingId}`);
        } else if (event.type === 'ORDER_PLACED') {
          console.log(`[QueueConsumer:Fulfillment] Prepared packaging notification for order ${event.payload?.orderId}`);
        } else if (event.type === 'RENTAL_DISPATCH_REQUESTED') {
          console.log(`[QueueConsumer:Logistics] Courier pickup requested for booking ${event.payload?.bookingId}`);
        } else if (event.type === 'RENTAL_RETURN_REMINDER') {
          // ponytail: no SMS/email provider wired yet; audit row above is the record. Plug the sender in here.
          console.log(`[QueueConsumer:Notify] Return reminder for booking ${event.payload?.bookingId} (due ${event.payload?.returnDate})`);
        } else if (event.type === 'RENTAL_INSPECTION_OVERDUE') {
          console.warn(`[QueueConsumer:Ops] Inspection overdue for booking ${event.payload?.bookingId}; deposit still held`);
        } else if (event.type === 'DEPOSIT_SETTLED') {
          console.log(
            `[QueueConsumer:Finance] Booking ${event.payload?.bookingId} deposit ${event.payload?.depositStatus}: ` +
              `refund ${event.payload?.refundPaise} paise, deduction ${event.payload?.deductionPaise} paise`,
          );
        }

        message.ack();
      } catch (err) {
        console.error('[QueueConsumer] Error processing message:', err);
        message.retry({ delaySeconds: 15 });
      }
    }
  },
} satisfies ExportedHandler<Env>;
