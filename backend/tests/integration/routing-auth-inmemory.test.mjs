import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import express from 'express';
import { pool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { listingsRouter, listingOwnerRouter } from '../../src/modules/listings/listings.routes.js';
import { reviewsRouter } from '../../src/modules/reviews/reviews.routes.js';
import { categoriesRouter } from '../../src/modules/categories/categories.routes.js';

const app = express();
app.use(express.json());
app.use('/listings', listingsRouter);
app.use('/listings', listingOwnerRouter);
app.use('/reviews', reviewsRouter);
app.use('/categories', categoriesRouter);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    }
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
      }
    });
    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    if (body !== undefined && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
    }
    req.get = (name) => req.headers[name.toLowerCase()];
    req.header = req.get;

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

const testToken = signAccessToken(
  { sub: '11111111-1111-4111-8111-111111111111' },
  { secret: env.auth.jwtSecret, ttlSeconds: 900 },
);

// Stub database queries
pool.query = async (sql, params) => {
  if (sql.includes('FROM public.users u')) {
    return {
      rows: [{
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@test.com',
        status: 'active',
        roles: ['customer', 'seller'],
      }]
    };
  }
  if (sql.includes('FROM public.listings l WHERE l.id = $1 LIMIT 1')) {
    return { rows: [] };
  }
  if (sql.includes('AS facet')) {
    return { rows: [] };
  }
  if (sql.includes('count(*)::int AS total') || sql.includes('count(*)::int as total')) {
    return { rows: [{ total: 0 }] };
  }
  if (sql.includes('FROM public.listings')) {
    return { rows: [], total: 0 };
  }
  if (sql.includes('FROM public.reviews r') && sql.includes('WHERE r.id = $1 LIMIT 1')) {
    if (params && params[0] === '44444444-4444-4444-8444-444444444444') {
      return {
        rows: [{
          id: '44444444-4444-4444-8444-444444444444',
          reviewer_user_id: '11111111-1111-4111-8111-111111111111',
          reviewee_user_id: '22222222-2222-4222-8222-222222222222',
          status: 'published',
          rating: 5,
          comment: 'Great dress!',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      };
    }
    return { rows: [] };
  }
  if (sql.includes('FROM public.reviews')) {
    return { rows: [], total: 0 };
  }
  if (sql.includes('FROM public.categories')) {
    return { rows: [] };
  }
  return { rows: [] };
};

test('Adversarial 1: GET /listings/mine routing and auth disambiguation', async () => {
  // Case 1a: Unauthenticated request must return 401 UNAUTHENTICATED, NOT 400 INVALID_ID
  const unauth = await dispatch(app, { method: 'GET', url: '/listings/mine' });
  assert.equal(unauth.status, 401);
  assert.equal(unauth.body?.error?.code, 'UNAUTHENTICATED');

  // Case 1b: Authenticated request must return 200 OK
  const auth = await dispatch(app, {
    method: 'GET',
    url: '/listings/mine',
    headers: { authorization: `Bearer ${testToken}` },
  });
  assert.equal(auth.status, 200);
  assert.ok(Array.isArray(auth.body?.data), 'Expected data to be an array');
  assert.equal(auth.body?.meta?.total, 0);

  // Case 5: Invalid ID must return 400 INVALID_ID
  const invalidId = await dispatch(app, { method: 'GET', url: '/listings/not-a-uuid' });
  assert.equal(invalidId.status, 400);
  assert.equal(invalidId.body?.error?.code, 'INVALID_ID');

  // Non-existent listing UUID must return 404 LISTING_NOT_FOUND
  const nonExistent = await dispatch(app, { method: 'GET', url: '/listings/00000000-0000-4000-8000-000000000000' });
  assert.equal(nonExistent.status, 404);
  assert.equal(nonExistent.body?.error?.code, 'LISTING_NOT_FOUND');

  // Literal route /listings/facets must match before /:id
  const facets = await dispatch(app, { method: 'GET', url: '/listings/facets' });
  assert.equal(facets.status, 200);
});

test('Adversarial 2: GET /reviews/mine routing and auth disambiguation', async () => {
  // Case 2a: Unauthenticated request must return 401 UNAUTHENTICATED, NOT 400 INVALID_ID
  const unauth = await dispatch(app, { method: 'GET', url: '/reviews/mine' });
  assert.equal(unauth.status, 401);
  assert.equal(unauth.body?.error?.code, 'UNAUTHENTICATED');

  // Case 2b: Authenticated request must return 200 OK
  const auth = await dispatch(app, {
    method: 'GET',
    url: '/reviews/mine',
    headers: { authorization: `Bearer ${testToken}` },
  });
  assert.equal(auth.status, 200);
  assert.ok(Array.isArray(auth.body?.data), 'Expected data to be an array');
  assert.equal(auth.body?.meta?.total, 0);

  // Case 5: Invalid ID must return 400 INVALID_ID
  const invalidId = await dispatch(app, { method: 'GET', url: '/reviews/not-a-uuid' });
  assert.equal(invalidId.status, 400);
  assert.equal(invalidId.body?.error?.code, 'INVALID_ID');

  // Case 4: Non-existent review UUID must return 404 REVIEW_NOT_FOUND (NOT 401 UNAUTHENTICATED)
  const nonExistent = await dispatch(app, { method: 'GET', url: '/reviews/00000000-0000-4000-8000-000000000000' });
  assert.notEqual(nonExistent.status, 401, 'Public read MUST NOT return 401');
  assert.equal(nonExistent.status, 404);
  assert.equal(nonExistent.body?.error?.code, 'REVIEW_NOT_FOUND');
});

test('Adversarial 3: GET /reviews/:id anonymously for an EXISTING published review', async () => {
  const publishedId = '44444444-4444-4444-8444-444444444444';

  // Case 3a: Anonymous request without auth header
  const anonymous = await dispatch(app, { method: 'GET', url: `/reviews/${publishedId}` });
  if (anonymous.status === 500) {
    assert.fail(`CRITICAL DEFECT DETECTED: Anonymous GET /reviews/:id threw HTTP 500: "${anonymous.body?.error?.message}". Expected 200 OK.`);
  }
  assert.equal(anonymous.status, 200, `Expected 200 OK for anonymous review read, got ${anonymous.status}`);
  assert.equal(anonymous.body?.data?.id, publishedId);
  assert.equal(anonymous.body?.data?.rating, 5);

  // Case 3b: Present-but-invalid token must degrade to anonymous instead of failing public read
  const brokenToken = await dispatch(app, {
    method: 'GET',
    url: `/reviews/${publishedId}`,
    headers: { authorization: 'Bearer malformed.jwt.token' },
  });
  assert.equal(brokenToken.status, 200, `Expected 200 OK for broken-token review read, got ${brokenToken.status}`);
  assert.equal(brokenToken.body?.data?.id, publishedId);
});

test('Adversarial 4: Categories slug regex and routing disambiguation', async () => {
  const tree = await dispatch(app, { method: 'GET', url: '/categories/tree' });
  assert.equal(tree.status, 200);

  const oneChar = await dispatch(app, { method: 'GET', url: '/categories/a' });
  assert.equal(oneChar.status, 404);
  assert.equal(oneChar.body?.error?.code, 'CATEGORY_NOT_FOUND');

  const hyphenated = await dispatch(app, { method: 'GET', url: '/categories/cocktail-dresses' });
  assert.equal(hyphenated.status, 404);
  assert.equal(hyphenated.body?.error?.code, 'CATEGORY_NOT_FOUND');

  const len120 = await dispatch(app, { method: 'GET', url: `/categories/${'a'.repeat(120)}` });
  assert.equal(len120.status, 404);
  assert.equal(len120.body?.error?.code, 'CATEGORY_NOT_FOUND');

  const len121 = await dispatch(app, { method: 'GET', url: `/categories/${'a'.repeat(121)}` });
  assert.equal(len121.status, 400);
  assert.equal(len121.body?.error?.code, 'INVALID_ID');

  const invalidChar = await dispatch(app, { method: 'GET', url: '/categories/bad!slug' });
  assert.equal(invalidChar.status, 400);
  assert.equal(invalidChar.body?.error?.code, 'INVALID_ID');
});
