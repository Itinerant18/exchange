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
let buyer;
let pool;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'adv-admin');
  seller = await registerUser(client, 'adv-seller');
  buyer = await registerUser(client, 'adv-buyer');

  const { pool: dbPool } = await import('../../src/config/database.js');
  pool = dbPool;
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('Adversarial 1: GET /listings/mine with and without auth, and param disambiguation', async () => {
  // 1. Unauthenticated request to /listings/mine must return 401 UNAUTHENTICATED, NOT 400 INVALID_ID
  const unauthMine = await client.get('/listings/mine');
  assert.equal(unauthMine.status, 401, `Expected 401 for unauthenticated /listings/mine, got ${unauthMine.status}`);
  assert.equal(unauthMine.body?.error?.code, 'UNAUTHENTICATED');

  // 2. Authenticated request to /listings/mine must return 200 OK
  const authMine = await client.get('/listings/mine', seller.token);
  assert.equal(authMine.status, 200, `Expected 200 for authenticated /listings/mine, got ${authMine.status}`);
  assert.ok(Array.isArray(authMine.body?.data), 'Expected array of listings');

  // 3. Invalid UUID on /listings/:id must return 400 INVALID_ID
  const invalidId = await client.get('/listings/not-a-uuid');
  assert.equal(invalidId.status, 400, `Expected 400 for /listings/not-a-uuid, got ${invalidId.status}`);
  assert.equal(invalidId.body?.error?.code, 'INVALID_ID');

  // 4. Random valid UUID on /listings/:id must return 404 LISTING_NOT_FOUND
  const nonExistentId = await client.get('/listings/00000000-0000-4000-8000-000000000000');
  assert.equal(nonExistentId.status, 404, `Expected 404 for non-existent listing, got ${nonExistentId.status}`);
  assert.equal(nonExistentId.body?.error?.code, 'LISTING_NOT_FOUND');

  // 5. Literal route /listings/facets must match facets handler and return 200
  const facets = await client.get('/listings/facets');
  assert.equal(facets.status, 200, `Expected 200 for /listings/facets, got ${facets.status}`);
});

test('Adversarial 2: GET /reviews/mine with and without auth, and param disambiguation', async () => {
  // 1. Unauthenticated request to /reviews/mine must return 401 UNAUTHENTICATED, NOT 400 INVALID_ID
  const unauthMine = await client.get('/reviews/mine');
  assert.equal(unauthMine.status, 401, `Expected 401 for unauthenticated /reviews/mine, got ${unauthMine.status}`);
  assert.equal(unauthMine.body?.error?.code, 'UNAUTHENTICATED');

  // 2. Authenticated request to /reviews/mine must return 200 OK
  const authMine = await client.get('/reviews/mine', seller.token);
  assert.equal(authMine.status, 200, `Expected 200 for authenticated /reviews/mine, got ${authMine.status}`);
  assert.ok(Array.isArray(authMine.body?.data), 'Expected array of reviews');

  // 3. Invalid UUID on /reviews/:id must return 400 INVALID_ID
  const invalidId = await client.get('/reviews/not-a-uuid');
  assert.equal(invalidId.status, 400, `Expected 400 for /reviews/not-a-uuid, got ${invalidId.status}`);
  assert.equal(invalidId.body?.error?.code, 'INVALID_ID');

  // 4. Random valid UUID on /reviews/:id anonymously must return 404 REVIEW_NOT_FOUND (NOT 401!)
  const nonExistentReview = await client.get('/reviews/00000000-0000-4000-8000-000000000000');
  assert.notEqual(nonExistentReview.status, 401, 'Anonymous GET /reviews/:id MUST NOT return 401');
  assert.equal(nonExistentReview.status, 404, `Expected 404 for non-existent review, got ${nonExistentReview.status}`);
  assert.equal(nonExistentReview.body?.error?.code, 'REVIEW_NOT_FOUND');
});

test('Adversarial 3: GET /reviews/:id for an EXISTING published review anonymously', async () => {
  // Create an order in DB to satisfy qualifying_order_id constraint
  const orderRes = await pool.query(
    `INSERT INTO public.orders (buyer_user_id, status, total_amount_paise)
     VALUES ($1, 'paid', 1000)
     RETURNING id`,
    [buyer.id],
  );
  const orderId = orderRes.rows[0].id;

  // Insert a published review directly
  const reviewRes = await pool.query(
    `INSERT INTO public.reviews (reviewer_user_id, reviewee_user_id, qualifying_order_id, rating, comment, status)
     VALUES ($1, $2, $3, 5, 'Great seller!', 'published')
     RETURNING id`,
    [buyer.id, seller.id, orderId],
  );
  const reviewId = reviewRes.rows[0].id;

  // Now, request this review ANONYMOUSLY (no auth token)
  const anonymousGet = await client.get(`/reviews/${reviewId}`);
  assert.notEqual(anonymousGet.status, 401, 'Anonymous request MUST NOT return 401 UNAUTHENTICATED');
  assert.notEqual(anonymousGet.status, 500, `Anonymous request MUST NOT throw 500 internal server error. Got: ${JSON.stringify(anonymousGet.body)}`);
  assert.equal(anonymousGet.status, 200, `Expected 200 for anonymous read of published review, got ${anonymousGet.status}`);
  assert.equal(anonymousGet.body?.data?.id, reviewId);
  assert.equal(anonymousGet.body?.data?.rating, 5);
});

test('Adversarial 4: Category slug and UUID parsing & route disambiguation', async () => {
  // 1. /categories/tree returns 200 and is not shadowed by /:id
  const tree = await client.get('/categories/tree');
  assert.equal(tree.status, 200);

  // 2. 1-character slug: valid syntax -> queries DB -> 404 if not found (not 400 INVALID_ID)
  const oneChar = await client.get('/categories/a');
  assert.equal(oneChar.status, 404, `Expected 404 for missing 1-char slug, got ${oneChar.status}: ${JSON.stringify(oneChar.body)}`);
  assert.equal(oneChar.body?.error?.code, 'CATEGORY_NOT_FOUND');

  // 3. Hyphenated slug: valid syntax -> queries DB -> 404 if not found
  const hyphenated = await client.get('/categories/designer-evening-wear');
  assert.equal(hyphenated.status, 404);
  assert.equal(hyphenated.body?.error?.code, 'CATEGORY_NOT_FOUND');

  // 4. 120-character slug: boundary length allowed -> queries DB -> 404
  const slug120 = 'a'.repeat(120);
  const boundary120 = await client.get(`/categories/${slug120}`);
  assert.equal(boundary120.status, 404, `Expected 404 for 120-char slug, got ${boundary120.status}: ${JSON.stringify(boundary120.body)}`);
  assert.equal(boundary120.body?.error?.code, 'CATEGORY_NOT_FOUND');

  // 5. 121-character slug: exceeds maximum length -> rejected with 400 INVALID_ID
  const slug121 = 'a'.repeat(121);
  const boundary121 = await client.get(`/categories/${slug121}`);
  assert.equal(boundary121.status, 400, `Expected 400 for 121-char slug, got ${boundary121.status}`);
  assert.equal(boundary121.body?.error?.code, 'INVALID_ID');

  // 6. Invalid characters in slug (e.g. $, @, space) -> 400 INVALID_ID
  const invalidCharSlug = await client.get('/categories/bad$slug');
  assert.equal(invalidCharSlug.status, 400, `Expected 400 for bad$slug, got ${invalidCharSlug.status}`);
  assert.equal(invalidCharSlug.body?.error?.code, 'INVALID_ID');

  // 7. Create real category and fetch by slug and by UUID
  const createdCat = (await client.post('/categories', { name: 'Traditional Lehengas', slug: 'traditional-lehengas' }, admin.token)).body.data;
  assert.ok(createdCat?.id);

  // Fetch by slug
  const bySlug = await client.get('/categories/traditional-lehengas');
  assert.equal(bySlug.status, 200, `Expected 200 fetching by slug, got ${bySlug.status}`);
  assert.equal(bySlug.body?.data?.id, createdCat.id);

  // Fetch by UUID
  const byUuid = await client.get(`/categories/${createdCat.id}`);
  assert.equal(byUuid.status, 200, `Expected 200 fetching by UUID, got ${byUuid.status}`);
  assert.equal(byUuid.body?.data?.slug, 'traditional-lehengas');
});
