// Per-test-file database isolation.
//
// Node's test runner executes every test file in its own process, so each
// file can own a dedicated scratch database. Call setupTestDatabase() at the
// TOP of a test file, before importing anything from backend/src — the DB name
// must be fixed before src/config/env.js (and thus the pg pool) is loaded.
//
// Databases are never destroyed by the running process (connections may still
// be open); each run recreates them with DROP ... WITH (FORCE), so repeated
// runs converge and leftovers never block a fresh run.
//
// Credentials come from the environment (--env-file=.env in npm test); only
// DB_NAME is overridden here, derived from the importing file's name.

import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url)); // tests/helpers
const TESTS_DIR = dirname(MODULE_DIR);                      // tests
const BACKEND_ROOT = dirname(TESTS_DIR);                    // backend
const MIGRATIONS_DIR = join(BACKEND_ROOT, 'database', 'migrations');

function deriveDatabaseName(testModuleUrl) {
  const file = basename(fileURLToPath(testModuleUrl));
  const stem = file.replace(/\.test\.(js|mjs|cjs)$/, '').replace(/\.mjs$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'unnamed';
  if (stem.length > 40) {
    throw new Error(`Test database name derivation: ${stem} is too long (${file})`);
  }
  return `exchnage_test_${stem.slice(0, 40)}`;
}

/**
 * Prepares an isolated database for the calling test file and sets
 * process.env.DB_NAME accordingly. Must run before any backend/src import.
 * Returns the database name for diagnostics.
 */
export async function setupTestDatabase(testModuleUrl) {
  const databaseName = deriveDatabaseName(testModuleUrl);
  process.env.DB_NAME = databaseName;
  await createDatabase(databaseName);
  await applyMigrationsTo(databaseName);
  return databaseName;
}

async function databaseCredentials() {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  assert.ok(host && port && user !== undefined, 'DB credentials must be present in the environment (see .env / npm test script)');
  return { host, port, user, password };
}

const ADMIN_DATABASE = 'postgres';

async function createDatabase(name) {
  assert.match(name, /^[a-z0-9_]+$/, 'derived test database names must be plain identifiers');
  const credentials = await databaseCredentials();
  const { Pool } = await import('pg');
  const admin = new Pool({ ...credentials, database: ADMIN_DATABASE, application_name: 'exchnage-tests-admin' });

  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name} OWNER ${credentials.user}`);
  } finally {
    await admin.end();
  }
}

async function applyMigrationsTo(name) {
  const credentials = await databaseCredentials();
  const [{ Pool }, migrateModule] = await Promise.all([
    import('pg'),
    import(pathToFileURL(join(BACKEND_ROOT, 'database', 'migrate.js')).href),
  ]);
  const scratch = new Pool({ ...credentials, database: name, application_name: 'exchnage-tests-migrate' });
  try {
    await migrateModule.runMigrations(scratch, { logger: null });
  } finally {
    await scratch.end();
  }
}

/** Sanity helper used by tests: the migration files are all discoverable. */
export async function migrationSqlFileCount() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((entry) => /^\d+_.+\.sql$/.test(entry)).length;
}

/**
 * Boots the real express app on an ephemeral port. Call AFTER
 * setupTestDatabase() and dynamic imports, so the pool binds to the test DB.
 * Returns { server, origin, close }.
 */
export async function startTestServer() {
  const appModule = await import(pathToFileURL(join(BACKEND_ROOT, 'src', 'app.js')).href);
  const server = appModule.createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return { server, origin, close };
}

/** Convenience HTTP helpers returning { status, body, headers }. */
export function makeClient(origin, prefix = '/api/v1') {
  const call = async (method, path, { token, body, headers } = {}) => {
    const response = await fetch(`${origin}${prefix}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await response.json(); } catch { /* 204 and friends */ }
    return { status: response.status, body: json, headers: response.headers };
  };
  // `third` accepts a token string or an options object ({ token, headers }).
  const normalize = (third) => (typeof third === 'string' ? { token: third } : (third ?? {}));
  return {
    get: (path, opts = {}) => call('GET', path, normalize(opts)),
    post: (path, body, third) => call('POST', path, { body, ...normalize(third) }),
    patch: (path, body, third) => call('PATCH', path, { body, ...normalize(third) }),
    put: (path, body, third) => call('PUT', path, { body, ...normalize(third) }),
    delete: (path, third) => call('DELETE', path, normalize(third)),
  };
}

export const TEST_PASSWORD = 'Sup3r-Secret-Passphrase!';

/** Registers a user and returns { id, email, token, roles }. */
export async function registerUser(client, label) {
  const email = `user-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@exchnage.test`;
  const response = await client.post('/auth/register', { email, password: TEST_PASSWORD, displayName: `Test ${label}` });
  assert.equal(response.status, 201, `registration for ${label} should succeed: ${JSON.stringify(response.body)}`);
  return {
    id: response.body.data.user.id,
    email,
    token: response.body.data.accessToken,
    roles: response.body.data.user.roles,
  };
}

/**
 * Registers a user, runs the admin-grant CLI against the CURRENT test
 * database (DB_NAME from the environment) and logs in again to obtain a
 * token that carries the admin role.
 */
export async function registerAdminUser(client, label) {
  const { spawnSync } = await import('node:child_process');
  const user = await registerUser(client, label);
  // The grant script opens its own pool; run it as a child process so the
  // caller's pool is untouched and the script's own pool.end() applies.
  const scriptPath = join('database', 'factories', 'grant-admin.js');
  const result = spawnSync(process.execPath, [scriptPath, user.email], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, `grant-admin CLI should succeed: ${result.stderr}`);
  const login = await client.post('/auth/login', { email: user.email, password: TEST_PASSWORD });
  assert.equal(login.status, 200);
  return { ...user, token: login.body.data.accessToken, roles: login.body.data.user.roles };
}

export async function closeDatabasePool() {
  const databaseModule = await import(pathToFileURL(join(BACKEND_ROOT, 'src', 'config', 'database.js')).href);
  await databaseModule.closeDatabasePool();
}
