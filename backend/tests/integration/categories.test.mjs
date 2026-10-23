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

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'cats-admin');
  seller = await registerUser(client, 'cats-seller');
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('public tree shows only active categories; admin sees the full list', async () => {
  const root = (await client.post('/categories', { name: `Root Alpha ${Date.now().toString(36)}` }, admin.token)).body.data;
  const child = (await client.post('/categories', { name: 'Child Beta', parentId: root.id }, admin.token)).body.data;
  assert.ok(child.parentId, root.id);

  const publicTree = await client.get('/categories');
  assert.equal(publicTree.status, 200);
  assert.ok(publicTree.body.data.some((entry) => entry.id === root.id), 'active root visible publicly');
  assert.ok(publicTree.body.data.some((entry) => entry.id === child.id), 'active child visible publicly');

  const adminList = await client.get('/admin/categories', admin.token);
  assert.equal(adminList.status, 200);

  // Deactivate the child: it leaves the public tree but stays for admins.
  const deactivated = await client.patch(`/categories/${child.id}`, { isActive: false }, admin.token);
  assert.equal(deactivated.status, 200);
  const afterTree = await client.get('/categories');
  assert.ok(!afterTree.body.data.some((entry) => entry.id === child.id), 'inactive child hidden publicly');
  assert.ok(adminList.body.data.some((entry) => entry.id === child.id), 'admin list still contains it');
  const detail = await client.get(`/categories/${child.id}`);
  assert.equal(detail.status, 404, 'inactive category detail is unlisted for the public');
  const adminDetail = await client.get(`/admin/categories/${child.id}`, admin.token);
  assert.equal(adminDetail.status, 200, 'admins can read inactive categories through the admin router');
  const outsiderDetail = await client.get(`/admin/categories/${child.id}`, seller.token);
  assert.equal(outsiderDetail.status, 403);
});

test('mutations are admin-only with typed rejections', async () => {
  const denial = await client.post('/categories', { name: 'Seller Made' }, seller.token);
  assert.equal(denial.status, 403);
  assert.equal(denial.body.error.code, 'FORBIDDEN');

  const anonymous = await client.post('/categories', { name: 'Ghost' });
  assert.equal(anonymous.status, 401);
});

test('uniqueness and cycle rules keep the taxonomy sane', async () => {
  const parent = (await client.post('/categories', { name: `Unique Parent ${Date.now().toString(36)}` }, admin.token)).body.data;

  // Same name under the same parent
  await client.post('/categories', { name: 'Twin', parentId: parent.id }, admin.token);
  const twin = await client.post('/categories', { name: 'twin ', parentId: parent.id }, admin.token);
  assert.equal(twin.status, 409);
  assert.equal(twin.body.error.code, 'CATEGORY_NAME_TAKEN');

  // Slug collisions across the whole catalog
  const slugA = (await client.post('/categories', { slug: 'shared-slug', name: 'Slug A' }, admin.token)).body.data;
  const slugB = await client.post('/categories', { slug: 'shared-slug', name: 'Slug B' }, admin.token);
  assert.equal(slugB.status, 409);
  assert.equal(slugB.body.error.code, 'CATEGORY_SLUG_TAKEN');

  // Cycle: root cannot become its own descendant's child
  const child = (await client.post('/categories', { name: 'Cycle Child', parentId: slugA.id }, admin.token)).body.data;
  const grandchild = (await client.post('/categories', { name: 'Cycle Grand', parentId: child.id }, admin.token)).body.data;
  const cycle = await client.patch(`/categories/${slugA.id}`, { parentId: grandchild.id }, admin.token);
  assert.equal(cycle.status, 409);
  assert.equal(cycle.body.error.code, 'CATEGORY_CYCLE');

  const selfParent = await client.patch(`/categories/${slugA.id}`, { parentId: slugA.id }, admin.token);
  assert.equal(selfParent.status, 409);
});

test('deactivation is blocked while active children exist', async () => {
  const parent = (await client.post('/categories', { name: `Shield Parent ${Date.now().toString(36)}` }, admin.token)).body.data;
  const child = (await client.post('/categories', { name: 'Shield Child', parentId: parent.id }, admin.token)).body.data;

  const blocked = await client.patch(`/categories/${parent.id}`, { isActive: false }, admin.token);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'CATEGORY_HAS_ACTIVE_CHILDREN');

  await client.patch(`/categories/${child.id}`, { isActive: false }, admin.token);
  const nowAllowed = await client.patch(`/categories/${parent.id}`, { isActive: false }, admin.token);
  assert.equal(nowAllowed.status, 200);
  assert.equal(nowAllowed.body.data.isActive, false);

  const relist = (await client.patch(`/categories/${parent.id}`, { isActive: true }, admin.token)).body.data;
  assert.equal(relist.isActive, true);
});
