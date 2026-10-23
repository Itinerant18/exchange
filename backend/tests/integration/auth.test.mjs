import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeDatabasePool,
  makeClient,
  setupTestDatabase,
  startTestServer,
  TEST_PASSWORD,
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

const cookiesFrom = (response) => (response.headers.getSetCookie?.() ?? []);

async function refreshCookieValue(response) {
  const raw = cookiesFrom(response).find((cookie) => cookie.startsWith('exch_refresh='));
  if (!raw) return null;
  return raw.split('=')[1].split(';')[0];
}

test('registration grants customer and seller roles and rejects duplicates', async () => {
  const email = `auth-first-${Date.now().toString(36)}@exchnage.test`;
  const first = await client.post('/auth/register', { email, password: TEST_PASSWORD });
  assert.equal(first.status, 201);
  assert.deepEqual(first.body.data.user.roles.sort(), ['customer', 'seller']);
  assert.ok(first.body.data.accessToken);
  assert.ok(refreshCookieValue(first), 'refresh cookie must be set at register time');

  const duplicate = await client.post('/auth/register', { email, password: TEST_PASSWORD });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_REGISTERED');
});

test('emails are stored lower-cased and logins are case-insensitive on email', async () => {
  const email = `auth-case-${Date.now().toString(36)}@exchnage.test`;
  const registered = await client.post('/auth/register', { email: email.toUpperCase(), password: TEST_PASSWORD });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.user.email, email.toLowerCase());

  const login = await client.post('/auth/login', { email: email.toUpperCase(), password: TEST_PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.email, email.toLowerCase());
});

test('bad credentials never disclose account existence', async () => {
  const response = await client.post('/auth/login', { email: `ghost-${Date.now().toString(36)}@exchnage.test`, password: TEST_PASSWORD });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');

  const wrongPassword = await client.post('/auth/login', { email: `auth-first-${Date.now().toString(36)}@exchnage.test`, password: 'not-the-password' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');
});

test('/auth/me reflects the authenticated identity only with a token', async () => {
  const email = `auth-me-${Date.now().toString(36)}@exchnage.test`;
  const register = await client.post('/auth/register', { email, password: TEST_PASSWORD });
  const token = register.body.data.accessToken;

  const anonymous = await client.get('/auth/me');
  assert.equal(anonymous.status, 401);

  const me = await client.get('/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, email);
  assert.deepEqual(me.body.data.roles.sort(), ['customer', 'seller']);
});

test('refresh rotates the session token and logout invalidates it', async () => {
  const email = `auth-refresh-${Date.now().toString(36)}@exchnage.test`;
  const register = await client.post('/auth/register', { email, password: TEST_PASSWORD });
  const firstCookie = await refreshCookieValue(register);
  assert.ok(firstCookie, 'register must set the refresh cookie');

  // Rotation: the old token stays valid until it is used once.
  const rotated = await client.post('/auth/refresh', {}, {
    headers: { Cookie: `exch_refresh=${firstCookie}` },
  });
  assert.equal(rotated.status, 200);
  const secondCookie = await refreshCookieValue(rotated);
  assert.ok(secondCookie && secondCookie !== firstCookie, 'a new refresh token must be issued');

  // Reuse of the old token trips revoke-all-sessions.
  const reuse = await client.post('/auth/refresh', {}, {
    headers: { Cookie: `exch_refresh=${firstCookie}` },
  });
  assert.equal(reuse.status, 401);

  const reuseOfRotated = await client.post('/auth/refresh', {}, {
    headers: { Cookie: `exch_refresh=${secondCookie}` },
  });
  assert.equal(reuseOfRotated.status, 401, 'revocation must include the rotated session');
});

test('logout revokes the presented refresh session', async () => {
  const email = `auth-logout-${Date.now().toString(36)}@exchnage.test`;
  const register = await client.post('/auth/register', { email, password: TEST_PASSWORD });
  const cookie = await refreshCookieValue(register);

  const login = await client.post('/auth/login', { email, password: TEST_PASSWORD });
  const loginCookie = await refreshCookieValue(login);

  const logout = await client.post('/auth/logout', {}, {
    headers: { Cookie: `exch_refresh=${cookie}` },
  });
  assert.equal(logout.status, 204);

  const refreshed = await client.post('/auth/refresh', {}, {
    headers: { Cookie: `exch_refresh=${cookie}` },
  });
  assert.equal(refreshed.status, 401);
  assert.notEqual(loginCookie, cookie, 'login must not reuse an existing session token');
});

test('garbage refresh cookies are refused with a typed error', async () => {
  const response = await client.post('/auth/refresh', {}, {
    headers: { Cookie: 'exch_refresh=not-a-real-token' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_REFRESH_TOKEN');
});
