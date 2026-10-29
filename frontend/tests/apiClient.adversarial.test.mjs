
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, apiRequest, ApiError } from '../src/api/apiClient.js';
import { endpoints } from '../src/api/endpoints.js';
import { listingsApi } from '../src/api/listingsApi.js';
import { appConfig } from '../src/config/appConfig.js';

const STORAGE_TOKEN_KEY = 'exchnage.accessToken';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

describe('Adversarial Verification of apiClient, Endpoints & Session Handling', () => {
  let originalFetch;
  let mockFetchCalls = [];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetchCalls = [];
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  test('Endpoints map correctly to backend mount points per specifications', () => {
    assert.equal(endpoints.payments.intent, '/payments', 'endpoints.payments.intent must map to /payments');
    assert.equal(endpoints.payments.create, '/payments', 'endpoints.payments.create must map to /payments');
    assert.equal(endpoints.inventory.items, '/inventory/items', 'endpoints.inventory.items must map to /inventory/items');
    assert.equal(endpoints.inventory.itemById('test-id'), '/inventory/items/test-id');
    assert.equal(endpoints.reviews.myReviews, '/reviews/mine', 'endpoints.reviews.myReviews must map to /reviews/mine');
    assert.equal(endpoints.listings.images('abc'), '/listings/abc/images');
    assert.equal(endpoints.categories.byId('cat-uuid'), '/categories/cat-uuid');
    assert.equal(endpoints.categories.bySlug('evening-gowns'), '/categories/evening-gowns');
    assert.equal(endpoints.admin.reconciliation, '/admin/reports/reconciliation');
  });

  test('Silent refresh on 401: intercepts 401, calls /auth/refresh, updates localStorage, and replays request', async () => {
    const initialToken = 'expired-jwt-token';
    const newToken = 'fresh-jwt-token-123';
    localStorage.setItem(STORAGE_TOKEN_KEY, initialToken);

    globalThis.fetch = async (url, options = {}) => {
      mockFetchCalls.push({ url: url.toString(), options });

      if (url.endsWith('/listings/mine')) {
        const authHeader = options.headers?.Authorization;
        if (authHeader === `Bearer ${initialToken}`) {
          return new Response(JSON.stringify({
            error: { code: 'UNAUTHENTICATED', message: 'Token expired' }
          }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        if (authHeader === `Bearer ${newToken}`) {
          return new Response(JSON.stringify({
            data: [{ id: 'listing-1', title: 'Designer Dress' }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: { message: 'Unexpected auth header' } }), { status: 400 });
      }

      if (url.endsWith('/auth/refresh')) {
        assert.equal(options.method, 'POST');
        assert.equal(options.credentials, 'include');
        return new Response(JSON.stringify({
          success: true,
          data: { accessToken: newToken }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(null, { status: 404 });
    };

    const result = await api.get('/listings/mine');

    assert.deepEqual(result, [{ id: 'listing-1', title: 'Designer Dress' }]);
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), newToken, 'localStorage must be updated with refreshed token');
    assert.equal(mockFetchCalls.length, 3, 'Expect exactly: 1) initial failed call, 2) refresh call, 3) replay call');
    assert.ok(mockFetchCalls[0].url.endsWith('/listings/mine'));
    assert.equal(mockFetchCalls[0].options.headers.Authorization, `Bearer ${initialToken}`);
    assert.ok(mockFetchCalls[1].url.endsWith('/auth/refresh'));
    assert.ok(mockFetchCalls[2].url.endsWith('/listings/mine'));
    assert.equal(mockFetchCalls[2].options.headers.Authorization, `Bearer ${newToken}`);
  });

  test('Header precedence: stale caller Authorization header does NOT override refreshed token on replay', async () => {
    const callerStaleToken = 'caller-stale-token-xyz';
    const newToken = 'refreshed-authoritative-token-999';
    localStorage.setItem(STORAGE_TOKEN_KEY, callerStaleToken);

    globalThis.fetch = async (url, options = {}) => {
      mockFetchCalls.push({ url: url.toString(), options });

      if (url.endsWith('/listings/mine')) {
        const authHeader = options.headers?.Authorization;
        if (authHeader === `Bearer ${callerStaleToken}`) {
          return new Response(JSON.stringify({
            error: { code: 'UNAUTHENTICATED', message: 'Token expired' }
          }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        if (authHeader === `Bearer ${newToken}`) {
          return new Response(JSON.stringify({
            data: { message: 'Success with refreshed token' }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: { message: 'Stale token received: ' + authHeader } }), { status: 403 });
      }

      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({
          data: { accessToken: newToken }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(null, { status: 404 });
    };

    // Caller explicitly passes stale Authorization header
    const result = await api.get('/listings/mine', {
      headers: {
        Authorization: `Bearer ${callerStaleToken}`,
        'X-Client-Trace': 'test-trace-123',
      },
    });

    assert.deepEqual(result, { message: 'Success with refreshed token' });
    assert.equal(mockFetchCalls.length, 3);
    const replayedCall = mockFetchCalls[2];
    assert.equal(replayedCall.options.headers.Authorization, `Bearer ${newToken}`);
    assert.equal(replayedCall.options.headers['X-Client-Trace'], 'test-trace-123', 'Custom headers must be preserved');
  });

  test('Header precedence with lowercase "authorization" and mixed-case caller headers', async () => {
    const staleLower = 'stale-lowercase-token';
    const refreshed = 'fresh-lowercase-test-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, staleLower);

    globalThis.fetch = async (url, options = {}) => {
      mockFetchCalls.push({ url: url.toString(), options });
      if (url.endsWith('/reviews/mine')) {
        const auth = options.headers?.Authorization || options.headers?.authorization;
        if (auth === `Bearer ${staleLower}`) {
          return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
        }
        if (auth === `Bearer ${refreshed}`) {
          return new Response(JSON.stringify({ data: ['review-1'] }), { status: 200 });
        }
        return new Response(null, { status: 400 });
      }
      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: refreshed } }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const res = await api.get('/reviews/mine', {
      headers: { authorization: `Bearer ${staleLower}` }
    });

    assert.deepEqual(res, ['review-1']);
    const replayed = mockFetchCalls[2];
    assert.equal(replayed.options.headers.Authorization, `Bearer ${refreshed}`);
    assert.equal(replayed.options.headers.authorization, undefined, 'Lowercase authorization header must be removed');
  });

  test('Concurrent 401 deduplication: multiple simultaneous 401s trigger exactly ONE /auth/refresh call', async () => {
    const expiredToken = 'expired-token-concurrent';
    const freshToken = 'fresh-shared-token-777';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let refreshCallCount = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      mockFetchCalls.push({ url: urlStr, options });

      if (urlStr.endsWith('/auth/refresh')) {
        refreshCallCount++;
        // Simulate network delay for refresh call to challenge race conditions
        await new Promise((r) => setTimeout(r, 40));
        return new Response(JSON.stringify({
          data: { accessToken: freshToken }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${expiredToken}`) {
        // Small delay to simulate realistic network jitter
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }

      if (auth === `Bearer ${freshToken}`) {
        if (urlStr.endsWith('/listings/mine')) return new Response(JSON.stringify({ data: { type: 'listings' } }), { status: 200 });
        if (urlStr.endsWith('/reviews/mine')) return new Response(JSON.stringify({ data: { type: 'reviews' } }), { status: 200 });
        if (urlStr.endsWith('/users/me/profile')) return new Response(JSON.stringify({ data: { type: 'profile' } }), { status: 200 });
        if (urlStr.endsWith('/rentals/bookings')) return new Response(JSON.stringify({ data: { type: 'bookings' } }), { status: 200 });
        if (urlStr.endsWith('/auth/me')) return new Response(JSON.stringify({ data: { type: 'me' } }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: { message: 'Unexpected' } }), { status: 500 });
    };

    // Dispatch 5 concurrent requests while token is expired
    const [resListings, resReviews, resProfile, resBookings, resMe] = await Promise.all([
      api.get('/listings/mine'),
      api.get('/reviews/mine'),
      api.get('/users/me/profile'),
      api.get('/rentals/bookings'),
      api.get('/auth/me'),
    ]);

    assert.equal(resListings.type, 'listings');
    assert.equal(resReviews.type, 'reviews');
    assert.equal(resProfile.type, 'profile');
    assert.equal(resBookings.type, 'bookings');
    assert.equal(resMe.type, 'me');

    assert.equal(refreshCallCount, 1, 'CRITICAL: Concurrent 401s must throttle to exactly ONE /auth/refresh call');
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), freshToken);
  });

  test('Staggered 401: subsequent request detects updated token in localStorage without second refresh', async () => {
    const tokenA = 'stale-token-A';
    const tokenB = 'refreshed-token-B';
    localStorage.setItem(STORAGE_TOKEN_KEY, tokenA);

    let refreshCount = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/auth/refresh')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({ data: { accessToken: tokenB } }), { status: 200 });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${tokenA}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (auth === `Bearer ${tokenB}`) {
        return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
      }
      return new Response(null, { status: 400 });
    };

    // First request initiates and finishes refresh
    await api.get('/listings/mine');
    assert.equal(refreshCount, 1);
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), tokenB);

    // Second request is made with caller passing the old tokenA explicitly
    const res2 = await api.get('/reviews/mine', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.deepEqual(res2, { ok: true });
    assert.equal(refreshCount, 1, 'Second request must detect tokenB in localStorage and avoid second refresh');
  });

  test('Infinite loop prevention: retry that returns 401 terminates and throws ApiError', async () => {
    localStorage.setItem(STORAGE_TOKEN_KEY, 'stale-token');

    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: 'still-unauthorized-token' } }), { status: 200 });
      }
      // Always return 401 even with refreshed token
      return new Response(JSON.stringify({
        error: { code: 'UNAUTHENTICATED', message: 'Account banned' }
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    };

    await assert.rejects(
      async () => {
        await api.get('/listings/mine');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHENTICATED');
        assert.equal(err.message, 'Account banned');
        return true;
      },
      'Must throw ApiError when retry fails with 401'
    );
  });

  test('Refresh failure: when /auth/refresh returns error, purges token and throws ApiError', async () => {
    localStorage.setItem(STORAGE_TOKEN_KEY, 'expired-token');

    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired' }
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        error: { code: 'UNAUTHENTICATED', message: 'Token expired' }
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    };

    await assert.rejects(
      async () => {
        await api.get('/listings/mine');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );

    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), null, 'localStorage token must be cleared when refresh fails');
  });

  test('Skip refresh on non-refreshable endpoints (/auth/login, /auth/register, /auth/refresh)', async () => {
    let refreshTriggered = false;

    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        refreshTriggered = true;
        return new Response(JSON.stringify({ data: { accessToken: 'new' } }), { status: 200 });
      }
      return new Response(JSON.stringify({
        error: { code: 'INVALID_CREDENTIALS', message: 'Bad password' }
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    };

    await assert.rejects(async () => {
      await api.post('/auth/login', { email: 'test@example.com', password: 'bad' });
    });

    assert.equal(refreshTriggered, false, '401 on /auth/login must NEVER trigger /auth/refresh');
  });

  test('FormData multipart handling in apiClient: preserves body, omits Content-Type, avoids JSON.stringify', async () => {
    const formData = new FormData();
    formData.append('title', 'Summer Dress');
    formData.append('photo', new Blob(['fake image content'], { type: 'image/jpeg' }), 'dress.jpg');

    let capturedHeaders = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options = {}) => {
      capturedHeaders = options.headers;
      capturedBody = options.body;
      return new Response(JSON.stringify({ data: { id: 'img-123' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = await api.post('/listings/item-1/images', formData);

    assert.deepEqual(res, { id: 'img-123' });
    assert.ok(capturedBody instanceof FormData, 'Body must remain a FormData instance, not stringified JSON');
    assert.equal(capturedHeaders['Content-Type'], undefined, 'Content-Type header must NOT be application/json for FormData');
    assert.equal(capturedHeaders['Accept'], 'application/json');
  });

  test('FormData retry on 401: preserves FormData body across silent refresh retry', async () => {
    const expiredToken = 'expired-form-token';
    const freshToken = 'fresh-form-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    const formData = new FormData();
    formData.append('caption', 'Front View');

    let bodiesReceived = [];

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: freshToken } }), { status: 200 });
      }

      bodiesReceived.push(options.body);

      if (options.headers?.Authorization === `Bearer ${expiredToken}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }

      if (options.headers?.Authorization === `Bearer ${freshToken}`) {
        return new Response(JSON.stringify({ data: { uploaded: true } }), { status: 200 });
      }

      return new Response(null, { status: 400 });
    };

    const res = await api.post('/listings/item-1/images', formData);
    assert.deepEqual(res, { uploaded: true });
    assert.equal(bodiesReceived.length, 2, 'Must attempt twice (initial + retry)');
    assert.ok(bodiesReceived[0] instanceof FormData, 'Initial body must be FormData');
    assert.ok(bodiesReceived[1] instanceof FormData, 'Replayed body must still be FormData');
  });

  test('listingsApi.uploadImage with FormData prepends appConfig.apiBaseUrl and preserves multipart boundaries', async () => {
    localStorage.setItem(STORAGE_TOKEN_KEY, 'listing-token-xyz');

    const formData = new FormData();
    formData.append('image', new Blob(['binary data'], { type: 'image/png' }), 'item.png');

    let requestedUrl = null;
    let requestedHeaders = null;
    let requestedBody = null;

    globalThis.fetch = async (url, options = {}) => {
      requestedUrl = url.toString();
      requestedHeaders = options.headers;
      requestedBody = options.body;
      return new Response(JSON.stringify({
        success: true,
        data: { url: '/uploads/item.png' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const res = await listingsApi.uploadImage('listing-456', formData);

    assert.ok(requestedUrl.startsWith(appConfig.apiBaseUrl), 'Must prepend appConfig.apiBaseUrl');
    assert.ok(requestedUrl.endsWith('/listings/listing-456/images'), 'Must target endpoints.listings.images');
    assert.equal(requestedHeaders.Authorization, 'Bearer listing-token-xyz');
    assert.equal(requestedHeaders['Content-Type'], undefined, 'Must NOT set Content-Type header on FormData upload');
    assert.ok(requestedBody instanceof FormData, 'Must pass FormData object directly to fetch');
    assert.deepEqual(res?.data ?? res, { url: '/uploads/item.png' });
  });

  test('High concurrency stress: 50 simultaneous 401 requests throttle to exactly ONE /auth/refresh', async () => {
    const expiredToken = 'expired-token-burst-50';
    const refreshedToken = 'refreshed-token-burst-50';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let refreshExecutions = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/auth/refresh')) {
        refreshExecutions++;
        // Simulate async delay
        await new Promise((r) => setTimeout(r, 30));
        return new Response(JSON.stringify({ data: { accessToken: refreshedToken } }), { status: 200 });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${expiredToken}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (auth === `Bearer ${refreshedToken}`) {
        return new Response(JSON.stringify({ data: { count: 1 } }), { status: 200 });
      }
      return new Response(null, { status: 400 });
    };

    const requests = Array.from({ length: 50 }, (_, i) => api.get(`/listings/item-${i}`));
    const results = await Promise.all(requests);

    assert.equal(results.length, 50);
    for (const r of results) {
      assert.deepEqual(r, { count: 1 });
    }
    assert.equal(refreshExecutions, 1, '50 concurrent requests must trigger exactly 1 refresh call');
  });

  test('Network error during refresh: resets isRefreshing and allows subsequent recovery', async () => {
    localStorage.setItem(STORAGE_TOKEN_KEY, 'stale-token-net-fail');

    let shouldNetworkFail = true;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/auth/refresh')) {
        if (shouldNetworkFail) {
          throw new TypeError('Failed to fetch (DNS / Network down)');
        }
        return new Response(JSON.stringify({ data: { accessToken: 'recovered-token' } }), { status: 200 });
      }

      if (options.headers?.Authorization === 'Bearer recovered-token') {
        return new Response(JSON.stringify({ data: { recovered: true } }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
    };

    // First request encounters network failure during refresh
    await assert.rejects(
      async () => {
        await api.get('/listings/mine');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );

    // Stale token must have been cleared from localStorage
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), null);

    // Network recovers, new session starts
    shouldNetworkFail = false;
    localStorage.setItem(STORAGE_TOKEN_KEY, 'stale-token-attempt-2');

    const recovered = await api.get('/listings/mine');
    assert.deepEqual(recovered, { recovered: true });
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), 'recovered-token');
  });

  test('Malformed refresh response: missing accessToken purges storage and throws ApiError', async () => {
    localStorage.setItem(STORAGE_TOKEN_KEY, 'token-to-purge');

    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        // Returns 200 but data is empty object (missing accessToken)
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
    };

    await assert.rejects(
      async () => {
        await api.get('/listings/mine');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );

    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), null, 'Token must be removed on malformed refresh response');
  });

  test('Method and payload preservation: POST, PUT, DELETE maintain HTTP method and body on replay', async () => {
    const expired = 'method-expired-token';
    const refreshed = 'method-refreshed-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expired);

    let recordedRequests = [];

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: refreshed } }), { status: 200 });
      }

      recordedRequests.push({
        method: options.method,
        url: urlStr,
        headers: options.headers,
        body: options.body,
      });

      if (options.headers?.Authorization === `Bearer ${expired}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (options.headers?.Authorization === `Bearer ${refreshed}`) {
        return new Response(JSON.stringify({ data: { status: 'acknowledged' } }), { status: 200 });
      }

      return new Response(null, { status: 400 });
    };

    // Test POST
    const postRes = await api.post('/rentals/bookings', { listingId: 'item-99', days: 4 });
    assert.deepEqual(postRes, { status: 'acknowledged' });
    const postReplay = recordedRequests[1];
    assert.equal(postReplay.method, 'POST');
    assert.equal(JSON.parse(postReplay.body).listingId, 'item-99');
    assert.equal(postReplay.headers.Authorization, `Bearer ${refreshed}`);

    // Reset token to expired for PUT
    localStorage.setItem(STORAGE_TOKEN_KEY, expired);
    recordedRequests = [];
    const putRes = await api.put('/listings/item-99', { pricePaise: 45000 });
    assert.deepEqual(putRes, { status: 'acknowledged' });
    const putReplay = recordedRequests[1];
    assert.equal(putReplay.method, 'PUT');
    assert.equal(JSON.parse(putReplay.body).pricePaise, 45000);
    assert.equal(putReplay.headers.Authorization, `Bearer ${refreshed}`);

    // Reset token to expired for DELETE
    localStorage.setItem(STORAGE_TOKEN_KEY, expired);
    recordedRequests = [];
    const delRes = await api.delete('/listings/item-99');
    assert.deepEqual(delRes, { status: 'acknowledged' });
    const delReplay = recordedRequests[1];
    assert.equal(delReplay.method, 'DELETE');
    assert.equal(delReplay.headers.Authorization, `Bearer ${refreshed}`);
  });

  test('Query parameters are preserved during silent refresh replay', async () => {
    const expired = 'query-expired-token';
    const refreshed = 'query-refreshed-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expired);

    let replayedUrl = null;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: refreshed } }), { status: 200 });
      }

      if (options.headers?.Authorization === `Bearer ${expired}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }

      if (options.headers?.Authorization === `Bearer ${refreshed}`) {
        replayedUrl = urlStr;
        return new Response(JSON.stringify({ data: { results: [] } }), { status: 200 });
      }

      return new Response(null, { status: 400 });
    };

    const queryPath = '/listings/mine?page=2&limit=10&sort=desc&category=dresses';
    const res = await api.get(queryPath);

    assert.deepEqual(res, { results: [] });
    assert.ok(replayedUrl.endsWith(queryPath), `Replayed URL must preserve all query parameters: ${replayedUrl}`);
  });

  test('listingsApi.uploadImage fallback for JSON metadata object uses api.post', async () => {
    let capturedMethod = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options = {}) => {
      capturedMethod = options.method;
      capturedBody = options.body;
      return new Response(JSON.stringify({ data: { id: 'meta-created' } }), { status: 200 });
    };

    const meta = { objectKey: 'garments/img-1.jpg', mimeType: 'image/jpeg', sizeBytes: 54321, isPrimary: true };
    const res = await listingsApi.uploadImage('listing-789', meta);

    assert.deepEqual(res, { id: 'meta-created' });
    assert.equal(capturedMethod, 'POST');
    assert.equal(JSON.parse(capturedBody).objectKey, 'garments/img-1.jpg');
    assert.equal(JSON.parse(capturedBody).isPrimary, true);
  });
});

