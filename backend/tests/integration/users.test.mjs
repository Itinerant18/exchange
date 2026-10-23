import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeDatabasePool,
  makeClient,
  registerUser,
  setupTestDatabase,
  startTestServer,
} from '../helpers/test-db.js';

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

const sampleAddress = (overrides = {}) => ({
  fullName: 'Test Person',
  phoneNumber: '+91 98765 43210',
  line1: '12/3 Ledger Lane',
  city: 'Bengaluru',
  postalCode: '560001',
  country: 'India',
  addressType: 'shipping',
  ...overrides,
});

test('profile is created at registration and is patchable', async () => {
  const user = await registerUser(client, 'profile');

  const profile = await client.get('/users/me/profile', user.token);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.displayName, 'Test profile');

  const updated = await client.patch('/users/me/profile', {
    displayName: 'Renamed Profiler',
    phoneNumber: '+91 90000 11111',
    bio: 'Careful buyer.',
  }, user.token);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.displayName, 'Renamed Profiler');
  assert.equal(updated.body.data.phoneNumber, '+91 90000 11111');

  const badPhone = await client.patch('/users/me/profile', { phoneNumber: 'banana' }, user.token);
  assert.equal(badPhone.status, 400);
  assert.equal(badPhone.body.error.code, 'INVALID_FIELD');
});

test('addresses: default demotion happens in one transaction', async () => {
  const user = await registerUser(client, 'addr');
  const auth = user.token;

  const first = await client.post('/users/me/addresses', sampleAddress({ isDefault: true }), auth);
  assert.equal(first.status, 201);
  assert.equal(first.body.data.isDefault, true);

  const second = await client.post('/users/me/addresses', sampleAddress({ isDefault: true, line1: '9 B Plan', city: 'Mysuru' }), auth);
  assert.equal(second.status, 201);
  assert.equal(second.body.data.isDefault, true);

  const list = await client.get('/users/me/addresses', auth);
  const defaults = list.body.data.filter((address) => address.isDefault);
  assert.equal(defaults.length, 1, 'exactly one address may be default');
  assert.equal(defaults[0].id, second.body.data.id, 'the newest default won');
});

test('addresses reject incomplete payloads and malformed ids', async () => {
  const user = await registerUser(client, 'addr-bad');
  const incomplete = await client.post('/users/me/addresses', { fullName: 'Partial' }, user.token);
  assert.equal(incomplete.status, 400);

  const badId = await client.get('/users/me/addresses/not-a-uuid', user.token);
  assert.equal(badId.status, 400);
  assert.equal(badId.body.error.code, 'INVALID_ID');
});

test('addresses are strictly owned: no cross-user access', async () => {
  const owner = await registerUser(client, 'addr-owner');
  const outsider = await registerUser(client, 'addr-outsider');
  const auth = owner.token;

  const created = await client.post('/users/me/addresses', sampleAddress(), auth);
  const addressId = created.body.data.id;

  const foreign = await client.get(`/users/me/addresses/${addressId}`, outsider.token);
  assert.equal(foreign.status, 404, 'another user must not see foreign addresses through /me endpoints');

  const deleted = await client.delete(`/users/me/addresses/${addressId}`, auth);
  assert.equal(deleted.status, 204);

  const afterDelete = await client.get(`/users/me/addresses/${addressId}`, auth);
  assert.equal(afterDelete.status, 404);
});
