import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeDatabasePool,
  makeClient,
  registerAdminUser,
  registerUser,
  setupTestDatabase,
  startTestServer,
} from '../helpers/test-db.js';

await setupTestDatabase(import.meta.url);

let client;
let close;
let admin;
let seller;
let pool;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'dash-admin');
  seller = await registerUser(client, 'dash-seller');

  const { pool: dbPool } = await import('../../src/config/database.js');
  pool = dbPool;
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('Full Admin Dashboard endpoints verification', async () => {
  // 1. GET /api/v1/admin/users
  const usersRes = await client.get('/admin/users', admin.token);
  assert.equal(usersRes.status, 200);
  assert.ok(Array.isArray(usersRes.body.data));
  assert.ok(usersRes.body.data.length >= 2);

  // 2. GET /api/v1/admin/bookings
  const bookingsRes = await client.get('/admin/bookings', admin.token);
  assert.equal(bookingsRes.status, 200);
  assert.ok(Array.isArray(bookingsRes.body.data));

  // 3. GET /api/v1/admin/payments
  const paymentsRes = await client.get('/admin/payments', admin.token);
  assert.equal(paymentsRes.status, 200);
  assert.ok(Array.isArray(paymentsRes.body.data));

  // 4. GET /api/v1/admin/deposits
  const depositsRes = await client.get('/admin/deposits', admin.token);
  assert.equal(depositsRes.status, 200);
  assert.ok(Array.isArray(depositsRes.body.data));

  // 5. GET /api/v1/admin/extensions
  const extRes = await client.get('/admin/extensions', admin.token);
  assert.equal(extRes.status, 200);
  assert.ok(Array.isArray(extRes.body.data));

  // 6. Test PATCH /api/v1/admin/users/:id/roles
  const roleUpdateRes = await client.patch(
    `/admin/users/${seller.id}/roles`,
    { roles: ['customer', 'seller', 'admin'] },
    admin.token
  );
  assert.equal(roleUpdateRes.status, 200);
  assert.deepEqual(roleUpdateRes.body.data.roles, ['customer', 'seller', 'admin']);

  // 7. Test PATCH /api/v1/admin/users/:id/status
  const statusUpdateRes = await client.patch(
    `/admin/users/${seller.id}/status`,
    { status: 'suspended' },
    admin.token
  );
  assert.equal(statusUpdateRes.status, 200);
  assert.equal(statusUpdateRes.body.data.status, 'suspended');

  // Verify non-admin is blocked (403)
  const regularUserRes = await client.get('/admin/users', seller.token);
  assert.equal(regularUserRes.status, 403);
});
