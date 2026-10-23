import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { closeDatabasePool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';

let server;
let serverOrigin;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  serverOrigin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDatabasePool();
});

test('GET /api/v1/health reports API and database readiness', async () => {
  const response = await fetch(`${serverOrigin}${env.apiPrefix}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.database, 'connected');
  assert.ok(body.data.timestamp);
});

test('an allowed browser origin receives a CORS response header', async () => {
  const allowedOrigin = env.frontendOrigins[0];
  assert.ok(allowedOrigin, 'FRONTEND_URL must contain at least one origin for this test');

  const response = await fetch(`${serverOrigin}${env.apiPrefix}/health`, {
    headers: { Origin: allowedOrigin },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
});

test('an unknown route returns the consistent 404 error envelope', async () => {
  const response = await fetch(`${serverOrigin}${env.apiPrefix}/does-not-exist`);
  const body = await response.json();
  const requestId = response.headers.get('x-request-id');

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.requestId, requestId);
  assert.ok(requestId);
});
