import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import express from 'express';
import { pool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/jwt.js';

import { listingsRouter, listingOwnerRouter } from '../../src/modules/listings/listings.routes.js';
import { reviewsRouter } from '../../src/modules/reviews/reviews.routes.js';
import { rentalsRouter, rentalActionRouter } from '../../src/modules/rentals/rentals.routes.js';

const app = express();
app.use(express.json());
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/listings', listingOwnerRouter);
app.use('/api/v1/reviews', reviewsRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/rentals', rentalActionRouter);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    },
  });
});

function dispatch(targetApp, { method = 'GET', url = '/', headers = {}, body = undefined }) {
  return new Promise((resolve) => {
    const req = new Readable({
      read() {
        if (body !== undefined) {
          this.push(typeof body === 'string' ? body : JSON.stringify(body));
        }
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.body = body;
    req.headers = { ...headers };
    if (body !== undefined && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
    }
    req.get = (name) => req.headers[name.toLowerCase()];
    req.header = req.get;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';

    let resBody = '';
    const resHeaders = {};
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (data) => {
      resBody = data;
      res.end();
      return res;
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      resBody = JSON.stringify(data);
      res.end();
      return res;
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk;
      let json = null;
      try { json = JSON.parse(resBody); } catch {}
      resolve({ status: res.statusCode, body: json, rawBody: resBody, headers: resHeaders });
    };

    targetApp.handle(req, res);
  });
}

describe('Milestone 3 Challenger 2: Empirical Routing, Reviews & Provider Authorization', () => {
  const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
  const SELLER_ID = '20000000-0000-4000-8000-000000000002';
  const RENTER_ID = '30000000-0000-4000-8000-000000000003';
  const STRANGER_ID = '50000000-0000-4000-8000-000000000005';

  const adminToken = signAccessToken({ sub: ADMIN_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const sellerToken = signAccessToken({ sub: SELLER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const renterToken = signAccessToken({ sub: RENTER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const strangerToken = signAccessToken({ sub: STRANGER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });

  // In-memory entities
  const users = new Map([
    [ADMIN_ID, { id: ADMIN_ID, email: 'admin@exchange.test', status: 'active', roles: ['customer', 'admin'] }],
    [SELLER_ID, { id: SELLER_ID, email: 'seller@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [RENTER_ID, { id: RENTER_ID, email: 'renter@exchange.test', status: 'active', roles: ['customer'] }],
    [STRANGER_ID, { id: STRANGER_ID, email: 'stranger@exchange.test', status: 'active', roles: ['customer'] }],
  ]);

  const listings = new Map([
    ['list-001', {
      id: 'list-001',
      owner_user_id: SELLER_ID,
      owner_type: 'SELLER',
      title: 'Silk Ball Gown',
      is_rental: true,
      rental_price_paise: 60000,
      deposit_paise: 120000,
    }],
  ]);

  const inventoryUnits = new Map([
    ['unit-001', {
      id: 'unit-001',
      listing_id: 'list-001',
      operational_status: 'AVAILABLE',
    }],
  ]);

  const bookings = new Map();
  const reviews = new Map([
    ['44444444-4444-4444-8444-444444444444', {
      id: '44444444-4444-4444-8444-444444444444',
      reviewer_user_id: RENTER_ID,
      reviewee_user_id: SELLER_ID,
      rating: 5,
      comment: 'Absolutely stunning dress!',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
    ['55555555-5555-4555-8555-555555555555', {
      id: '55555555-5555-4555-8555-555555555555',
      reviewer_user_id: RENTER_ID,
      reviewee_user_id: SELLER_ID,
      rating: 2,
      comment: 'Pending moderation comment.',
      status: 'hidden',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
  ]);

  pool.connect = async () => ({
    query: pool.query,
    release: () => {},
  });

  // Wire database pool
  pool.query = async (sql, params = []) => {
    // Transaction controls
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rowCount: 1, rows: [] };
    }

    // Users query
    if (sql.includes('FROM public.users u')) {
      const u = users.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // Reviews query by id
    if (sql.includes('FROM public.reviews r') && sql.includes('WHERE r.id = $1 LIMIT 1')) {
      const r = reviews.get(params[0]);
      return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
    }

    // Reviews by author (for /mine)
    if (sql.includes('FROM public.reviews') && sql.includes('reviewer_user_id = $1')) {
      const rList = [...reviews.values()].filter((r) => r.reviewer_user_id === params[0]);
      return { rows: rList, rowCount: rList.length };
    }

    // Reviews total count
    if (sql.includes('count(*)::int') && sql.includes('reviews')) {
      return { rows: [{ total: 1 }], rowCount: 1 };
    }

    // Listings mine
    if (sql.includes('FROM public.listings') && sql.includes('owner_user_id = $1')) {
      const lList = [...listings.values()].filter((l) => l.owner_user_id === params[0]);
      return { rows: lList, rowCount: lList.length };
    }

    // Listings total count
    if (sql.includes('count(*)::int') && sql.includes('listings')) {
      return { rows: [{ total: 1 }], rowCount: 1 };
    }

    // Booking by ID
    if (sql.includes('FROM public.rental_bookings')) {
      const b = bookings.get(params[0]);
      if (!b) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: b.id,
          renter_user_id: b.renter_user_id,
          status: b.status,
          rental_listing_id: b.listing_id,
          listing_id: b.listing_id,
          listing_owner_id: b.listing_owner_id,
          listing_owner_type: 'SELLER',
          deposit_amount_paise: b.deposit_amount_paise,
          deposit_paise: b.deposit_paise,
        }],
        rowCount: 1,
      };
    }

    // Booking items
    if (sql.includes('FROM public.rental_booking_items') && sql.includes('WHERE rental_booking_id = $1')) {
      const b = bookings.get(params[0]);
      if (!b) return { rows: [], rowCount: 0 };
      return {
        rows: [{ inventory_item_id: b.unit_id, item_status: b.status }],
        rowCount: 1,
      };
    }

    // Transition booking status
    if (sql.includes('UPDATE public.rental_bookings')) {
      const bookingId = params[0];
      const targetStatus = params[2] || params[1] || 'cancelled';
      const b = bookings.get(bookingId);
      if (b) {
        b.status = targetStatus;
        return { rows: [{ id: b.id, status: b.status }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Update rental_booking_items status
    if (sql.includes('UPDATE public.rental_booking_items')) {
      return { rows: [], rowCount: 1 };
    }

    // Update inventory unit status
    if (sql.includes('UPDATE public.inventory_items')) {
      const newStatus = params[2] || (sql.includes("'AVAILABLE'") ? 'AVAILABLE' : sql.includes("'RENTED'") ? 'RENTED' : 'RESERVED');
      const itemIds = params[0];
      for (const id of Array.isArray(itemIds) ? itemIds : [itemIds]) {
        const u = inventoryUnits.get(id);
        if (u) u.operational_status = newStatus;
      }
      return { rows: [], rowCount: Array.isArray(itemIds) ? itemIds.length : 1 };
    }

    // Status history insert
    if (sql.includes('INSERT INTO public.rental_booking_status_history')) {
      return { rows: [], rowCount: 1 };
    }

    // Audit log insert
    if (sql.includes('INSERT INTO public.audit_logs')) {
      return { rows: [], rowCount: 1 };
    }

    // Payments / refunds checks on cancellation
    if (sql.includes('FROM public.payments')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  };

  test('Route Ordering 1: GET /listings/mine matches before /:id (returns 401 unauthenticated, NOT 400 INVALID_ID)', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/v1/listings/mine' });
    assert.equal(res.status, 401, 'Unauthenticated /listings/mine must return 401 UNAUTHENTICATED, not 400 INVALID_ID');
    assert.equal(res.body?.error?.code, 'UNAUTHENTICATED');

    // Authenticated request matches /listings/mine handler
    const authRes = await dispatch(app, {
      method: 'GET',
      url: '/api/v1/listings/mine',
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(authRes.status, 200);
    assert.ok(Array.isArray(authRes.body?.data));

    // Invalid non-UUID parameter to /:id returns 400 INVALID_ID
    const invalidRes = await dispatch(app, { method: 'GET', url: '/api/v1/listings/non-uuid-string' });
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body?.error?.code, 'INVALID_ID');
  });

  test('Route Ordering 2: GET /reviews/mine matches before /:id (returns 401 unauthenticated, NOT 400 INVALID_ID)', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/v1/reviews/mine' });
    assert.equal(res.status, 401, 'Unauthenticated /reviews/mine must return 401 UNAUTHENTICATED, not 400 INVALID_ID');
    assert.equal(res.body?.error?.code, 'UNAUTHENTICATED');

    // Authenticated request matches /reviews/mine handler
    const authRes = await dispatch(app, {
      method: 'GET',
      url: '/api/v1/reviews/mine',
      headers: { authorization: `Bearer ${renterToken}` },
    });
    assert.equal(authRes.status, 200);
    assert.ok(Array.isArray(authRes.body?.data));

    // Invalid non-UUID parameter to /:id returns 400 INVALID_ID
    const invalidRes = await dispatch(app, { method: 'GET', url: '/api/v1/reviews/non-uuid-string' });
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body?.error?.code, 'INVALID_ID');
  });

  test('Public Review Read 3: GET /reviews/:id anonymous read of published review succeeds with 200 OK', async () => {
    const publishedId = '44444444-4444-4444-8444-444444444444';

    // 3a. Anonymous read without any auth header
    const anonRes = await dispatch(app, { method: 'GET', url: `/api/v1/reviews/${publishedId}` });
    assert.equal(anonRes.status, 200, `Expected 200 for anonymous read, got ${anonRes.status}`);
    assert.equal(anonRes.body?.data?.id, publishedId);
    assert.equal(anonRes.body?.data?.rating, 5);

    // 3b. Degraded read with corrupted Authorization header must return 200, not 401 or 500
    const corruptRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/reviews/${publishedId}`,
      headers: { authorization: 'Bearer totally.corrupted.token' },
    });
    assert.equal(corruptRes.status, 200, 'Malformed token must degrade to anonymous read without failing');
    assert.equal(corruptRes.body?.data?.id, publishedId);

    // 3c. Anonymous read of non-existent review returns 404, NOT 401
    const nonExistent = await dispatch(app, {
      method: 'GET',
      url: '/api/v1/reviews/99999999-9999-4999-8999-999999999999',
    });
    assert.equal(nonExistent.status, 404);
    assert.equal(nonExistent.body?.error?.code, 'REVIEW_NOT_FOUND');
  });

  test('Public Review Read 4: Hidden review gates visibility (anonymous 404, owner/admin 200)', async () => {
    const hiddenId = '55555555-5555-4555-8555-555555555555';

    // Anonymous read of hidden review returns 404 (does not leak unpublished review)
    const anonRes = await dispatch(app, { method: 'GET', url: `/api/v1/reviews/${hiddenId}` });
    assert.equal(anonRes.status, 404, 'Anonymous caller must not see hidden review');

    // Stranger caller also receives 404
    const strangerRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/reviews/${hiddenId}`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    assert.equal(strangerRes.status, 404, 'Stranger must not see hidden review');

    // Author (renter) can view their own hidden review -> 200 OK
    const authorRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/reviews/${hiddenId}`,
      headers: { authorization: `Bearer ${renterToken}` },
    });
    assert.equal(authorRes.status, 200, 'Author must be able to view their own hidden review');
    assert.equal(authorRes.body?.data?.id, hiddenId);

    // Admin can view hidden review -> 200 OK
    const adminRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/reviews/${hiddenId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200, 'Admin must be able to view hidden review');
    assert.equal(adminRes.body?.data?.id, hiddenId);
  });

  test('Provider Actions 5: Provider reject pending booking returns 200 and restores inventory to AVAILABLE', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000001';
    inventoryUnits.get('unit-001').operational_status = 'RESERVED';
    bookings.set(bookingId, {
      id: bookingId,
      renter_user_id: RENTER_ID,
      listing_owner_id: SELLER_ID,
      status: 'pending',
      unit_id: 'unit-001',
      deposit_amount_paise: 120000,
      deposit_paise: 120000,
    });

    // 5a. Renter attempts to reject -> 403 FORBIDDEN
    const renterReject = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/reject`,
      headers: { authorization: `Bearer ${renterToken}` },
    });
    assert.equal(renterReject.status, 403, 'Renter cannot reject booking');
    assert.equal(renterReject.body?.error?.code, 'FORBIDDEN');
    assert.equal(bookings.get(bookingId).status, 'pending');

    // 5b. Direct provider cancellation via /cancel -> 409 BOOKING_CANCEL_NOT_ALLOWED
    const providerCancel = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(providerCancel.status, 409, 'Provider calling /cancel directly must receive 409 BOOKING_CANCEL_NOT_ALLOWED');
    assert.equal(providerCancel.body?.error?.code, 'BOOKING_CANCEL_NOT_ALLOWED');
    assert.equal(bookings.get(bookingId).status, 'pending');

    // 5c. Provider calls /reject -> 200 OK, transitions to cancelled
    const providerReject = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/reject`,
      headers: { authorization: `Bearer ${sellerToken}` },
      body: { reason: 'Item currently at dry cleaners' },
    });
    assert.equal(providerReject.status, 200, 'Provider reject must return HTTP 200');
    assert.equal(providerReject.body?.data?.status, 'cancelled');
    assert.equal(bookings.get(bookingId).status, 'cancelled');
    assert.equal(inventoryUnits.get('unit-001').operational_status, 'AVAILABLE', 'Unit must be restored to AVAILABLE');

    // 5d. Double reject on already cancelled booking -> 409 BOOKING_REJECT_NOT_ALLOWED
    const doubleReject = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/reject`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(doubleReject.status, 409);
    assert.equal(doubleReject.body?.error?.code, 'BOOKING_REJECT_NOT_ALLOWED');
  });

  test('Provider Actions 6: Provider start on confirmed booking (renter 403, stranger 403, provider 200)', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000002';
    inventoryUnits.get('unit-001').operational_status = 'RESERVED';
    bookings.set(bookingId, {
      id: bookingId,
      renter_user_id: RENTER_ID,
      listing_owner_id: SELLER_ID,
      status: 'confirmed',
      unit_id: 'unit-001',
      deposit_amount_paise: 120000,
      deposit_paise: 120000,
    });

    // 6a. Stranger attempts to start rental -> 403 FORBIDDEN
    const strangerStart = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/start`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    assert.equal(strangerStart.status, 403, 'Stranger cannot start rental');
    assert.equal(strangerStart.body?.error?.code, 'FORBIDDEN');

    // 6b. RENTER attempts to start rental -> 403 FORBIDDEN
    const renterStart = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/start`,
      headers: { authorization: `Bearer ${renterToken}` },
    });
    assert.equal(renterStart.status, 403, 'Renter must be forbidden from starting rental');
    assert.equal(renterStart.body?.error?.code, 'FORBIDDEN');
    assert.equal(bookings.get(bookingId).status, 'confirmed');
    assert.equal(inventoryUnits.get('unit-001').operational_status, 'RESERVED');

    // 6c. PROVIDER starts rental -> 200 OK, status moves to active, unit moves to RENTED
    const providerStart = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/start`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(providerStart.status, 200, 'Provider start must succeed with HTTP 200');
    assert.equal(providerStart.body?.data?.status, 'active');
    assert.equal(bookings.get(bookingId).status, 'active');
    assert.equal(inventoryUnits.get('unit-001').operational_status, 'RENTED', 'Unit operational status moves to RENTED');

    // 6d. Double start on already active booking -> 409 BOOKING_START_NOT_ALLOWED
    const doubleStart = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${bookingId}/start`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(doubleStart.status, 409);
    assert.equal(doubleStart.body?.error?.code, 'BOOKING_START_NOT_ALLOWED');
  });
});
