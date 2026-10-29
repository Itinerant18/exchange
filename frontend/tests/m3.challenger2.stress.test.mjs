import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, apiRequest, ApiError } from '../src/api/apiClient.js';
import { endpoints } from '../src/api/endpoints.js';

const STORAGE_TOKEN_KEY = 'exchnage.accessToken';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

describe('Milestone 3 Challenger 2: apiClient Stress & Concurrency Suite', () => {
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

  test('Stress Test 1: 100 concurrent 401 requests throttle to exactly ONE /auth/refresh call', async () => {
    const expiredToken = 'expired-stress-token-100';
    const freshToken = 'refreshed-stress-token-100';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let refreshExecutions = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      mockFetchCalls.push({ url: urlStr, options });

      if (urlStr.endsWith('/auth/refresh')) {
        refreshExecutions++;
        // Simulate real-world network latency on the refresh endpoint
        await new Promise((r) => setTimeout(r, 45));
        return new Response(JSON.stringify({ data: { accessToken: freshToken } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${expiredToken}`) {
        // Small jitter
        await new Promise((r) => setTimeout(r, 5));
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (auth === `Bearer ${freshToken}`) {
        return new Response(JSON.stringify({ data: { item: urlStr, ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, { status: 400 });
    };

    const requests = Array.from({ length: 100 }, (_, i) => api.get(`/inventory/items/stress-${i}`));
    const results = await Promise.all(requests);

    assert.equal(results.length, 100, 'All 100 requests must resolve');
    for (let i = 0; i < 100; i++) {
      assert.equal(results[i].ok, true);
      assert.ok(results[i].item.endsWith(`/inventory/items/stress-${i}`));
    }
    assert.equal(refreshExecutions, 1, 'CRITICAL: Exactly 1 /auth/refresh call across 100 concurrent 401s');
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), freshToken);
  });

  test('Stress Test 2: Staggered waves (in-flight + post-refresh) deduplicate without redundant refresh', async () => {
    const expiredToken = 'expired-staggered-token';
    const freshToken = 'refreshed-staggered-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let refreshExecutions = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/auth/refresh')) {
        refreshExecutions++;
        await new Promise((r) => setTimeout(r, 60));
        return new Response(JSON.stringify({ data: { accessToken: freshToken } }), { status: 200 });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${expiredToken}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (auth === `Bearer ${freshToken}`) {
        return new Response(JSON.stringify({ data: { success: true } }), { status: 200 });
      }
      return new Response(null, { status: 400 });
    };

    // Wave 1: 20 requests dispatched at t=0
    const wave1 = Array.from({ length: 20 }, (_, i) => api.get(`/listings/mine?wave=1&req=${i}`));

    // Wave 2: 20 requests dispatched at t=20ms (while refresh is in flight)
    await new Promise((r) => setTimeout(r, 20));
    const wave2 = Array.from({ length: 20 }, (_, i) => api.get(`/reviews/mine?wave=2&req=${i}`));

    // Wait for wave 1 & 2 to settle
    const [w1Results, w2Results] = await Promise.all([Promise.all(wave1), Promise.all(wave2)]);

    assert.equal(w1Results.length, 20);
    assert.equal(w2Results.length, 20);
    assert.equal(refreshExecutions, 1, 'Waves 1 and 2 must share the single refresh execution');

    // Wave 3: 20 requests dispatched at t=80ms (after refresh is complete, caller still holding expired token)
    const wave3 = Array.from({ length: 20 }, (_, i) =>
      api.get(`/users/me/profile?wave=3&req=${i}`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      })
    );
    const w3Results = await Promise.all(wave3);
    assert.equal(w3Results.length, 20);
    assert.equal(refreshExecutions, 1, 'Wave 3 must leverage localStorage updated token without new refresh call');
  });

  test('Stress Test 3: Concurrency under refresh failure cascades error and resets mutex cleanly', async () => {
    const expiredToken = 'expired-fatal-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let refreshExecutions = 0;

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/auth/refresh')) {
        refreshExecutions++;
        await new Promise((r) => setTimeout(r, 30));
        // Simulate refresh token rejection from backend
        return new Response(JSON.stringify({
          error: { code: 'SESSION_REVOKED', message: 'Refresh token expired or revoked' },
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
    };

    const requests = Array.from({ length: 50 }, (_, i) => api.get(`/listings/item-${i}`));
    const results = await Promise.allSettled(requests);

    assert.equal(results.length, 50);
    assert.equal(refreshExecutions, 1, 'Only 1 refresh call attempted despite 50 concurrent 401s');
    for (const r of results) {
      assert.equal(r.status, 'rejected');
      assert.ok(r.reason instanceof ApiError);
      assert.equal(r.reason.status, 401);
    }
    // Storage must be purged
    assert.equal(localStorage.getItem(STORAGE_TOKEN_KEY), null, 'localStorage token must be purged on refresh failure');

    // Verify system recovers for next attempt: subsequent request is NOT stuck in permanent mutex lock
    let secondRefreshCalled = false;
    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        secondRefreshCalled = true;
        return new Response(JSON.stringify({ data: { accessToken: 'new-valid-token' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
    };

    localStorage.setItem(STORAGE_TOKEN_KEY, 'stale-token-2');
    const retryPromise = api.get('/listings/mine');
    // It should trigger a second refresh call
    await assert.rejects(async () => {
      // Since our mock always returns 401 on retry, it should reject after attempting refresh
      await retryPromise;
    });
    assert.equal(secondRefreshCalled, true, 'isRefreshing mutex must be unlocked after failure to allow future refresh attempts');
  });

  test('Stress Test 4: Header case variations (AuThOrIzAtIoN, AUTHORIZATION) and explicit token parameter', async () => {
    const staleToken = 'stale-case-token';
    const refreshedToken = 'fresh-case-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, staleToken);

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: refreshedToken } }), { status: 200 });
      }

      const headers = options.headers || {};
      const authHeader = headers.Authorization || headers.authorization || headers.AUTHORIZATION;

      if (authHeader === `Bearer ${staleToken}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (authHeader === `Bearer ${refreshedToken}`) {
        return new Response(JSON.stringify({ data: { authUsed: authHeader } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: `Unexpected auth: ${authHeader}` } }), { status: 400 });
    };

    // Test with mixed case "AuThOrIzAtIoN"
    const resMixed = await api.get('/listings/mine', {
      headers: { AuThOrIzAtIoN: `Bearer ${staleToken}` },
    });
    assert.deepEqual(resMixed, { authUsed: `Bearer ${refreshedToken}` });

    // Test with all uppercase "AUTHORIZATION"
    localStorage.setItem(STORAGE_TOKEN_KEY, staleToken);
    const resUpper = await api.get('/listings/mine', {
      headers: { AUTHORIZATION: `Bearer ${staleToken}` },
    });
    assert.deepEqual(resUpper, { authUsed: `Bearer ${refreshedToken}` });

    // Test with explicit token option parameter
    localStorage.setItem(STORAGE_TOKEN_KEY, staleToken);
    const resExplicit = await apiRequest('/listings/mine', {
      method: 'GET',
      token: staleToken,
    });
    assert.deepEqual(resExplicit, { authUsed: `Bearer ${refreshedToken}` });
  });

  test('Stress Test 5: Replay preserves HTTP POST/PUT JSON payload and query parameters exactly', async () => {
    const expiredToken = 'expired-body-token';
    const freshToken = 'fresh-body-token';
    localStorage.setItem(STORAGE_TOKEN_KEY, expiredToken);

    let recordedReplays = [];

    globalThis.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { accessToken: freshToken } }), { status: 200 });
      }

      const auth = options.headers?.Authorization;
      if (auth === `Bearer ${expiredToken}`) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
      }
      if (auth === `Bearer ${freshToken}`) {
        recordedReplays.push({ url: urlStr, method: options.method, body: options.body, headers: options.headers });
        return new Response(JSON.stringify({ data: { success: true } }), { status: 200 });
      }
      return new Response(null, { status: 400 });
    };

    // Complex nested JSON POST with query params
    const postPayload = {
      listingId: 'd0000000-0000-4000-8000-000000000001',
      options: { insurance: true, fastShipping: false, tags: ['luxury', 'formal'] },
      depositPaise: 50000,
    };
    await api.post('/rentals/bookings?draft=false&channel=web', postPayload);

    assert.equal(recordedReplays.length, 1);
    const replay = recordedReplays[0];
    assert.equal(replay.method, 'POST');
    assert.ok(replay.url.includes('/rentals/bookings?draft=false&channel=web'));
    assert.deepEqual(JSON.parse(replay.body), postPayload);
    assert.equal(replay.headers.Authorization, `Bearer ${freshToken}`);
    assert.equal(replay.headers['Content-Type'], 'application/json');
  });
});
