import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeDatabasePool,
  makeClient,
  registerUser,
  setupTestDatabase,
  startTestServer,
} from '../helpers/test-db.js';

// DB name must be fixed before any backend/src import (dynamic below).
await setupTestDatabase(import.meta.url);

let client;
let close;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('unknown routes keep the stable error envelope', async () => {
  const response = await client.get('/api/v1/does-not-exist');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.ok(response.body.requestId);
});

test('protected endpoints require a bearer token', async () => {
  for (const path of ['/orders', '/payments', '/deposits', '/inventory/items']) {
    const response = await client.get(path);
    assert.equal(response.status, 401, `${path} should reject anonymous access`);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  }
});

test('malformed identifiers return INVALID_ID, not 404s', async () => {
  const user = await registerUser(client, 'errors');
  const response = await client.get('/orders/not-a-uuid', { token: user.token });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_ID');
});

test('requesting a non-existent detail yields the typed 404 code', async () => {
  const missing = '00000000-0000-4000-8000-000000000000';
  const listingResponse = await client.get(`/listings/${missing}`);
  assert.equal(listingResponse.status, 404);
  assert.equal(listingResponse.body.error.code, 'LISTING_NOT_FOUND');
});

test('pagination params are validated with typed errors', async () => {
  const response = await client.get('/listings?page=0');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_PAGINATION');

  const tooBig = await client.get('/listings?limit=1000');
  assert.equal(tooBig.status, 400);
  assert.equal(tooBig.body.error.code, 'INVALID_PAGINATION');
});
