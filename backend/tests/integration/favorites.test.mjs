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
let user;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'fav-admin');
  seller = await registerUser(client, 'fav-seller');
  user = await registerUser(client, 'fav-renter');
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('favorites lifecycle and shortlists', async () => {
  const stamp = Date.now();

  // Unauthed check
  const unauth = await client.get('/favorites/ids');
  assert.equal(unauth.status, 401);

  // Category creation (admin)
  const category = await client.post('/categories', { name: `Gowns ${stamp}` }, admin.token);
  assert.equal(category.status, 201);
  const categoryId = category.body.data.id;

  // Listing creation (seller)
  const listing = await client.post('/listings', {
    title: `Designer Evening Gown ${stamp}`,
    condition: 'like_new',
    categoryId,
    rentalPricePaise: 6500,
    depositPaise: 15000,
    isRental: true,
    isSale: false,
    attributes: {
      occasion: ['BlackTie', 'Gala'],
      length: ['FloorLength'],
      neckline: ['Sweetheart'],
    },
  }, seller.token);
  assert.equal(listing.status, 201);
  const listingId = listing.body.data.id;

  // 1. Initial empty favorites
  const emptyIds = await client.get('/favorites/ids', user.token);
  assert.equal(emptyIds.status, 200);
  assert.deepEqual(emptyIds.body.data, []);

  // 2. Add to favorites
  const add = await client.post(`/favorites/${listingId}`, {}, user.token);
  assert.equal(add.status, 201);

  // 3. IDs include listingId
  const idsAfter = await client.get('/favorites/ids', user.token);
  assert.equal(idsAfter.status, 200);
  assert.deepEqual(idsAfter.body.data, [listingId]);

  // 4. Full list includes listing details
  const fullList = await client.get('/favorites', user.token);
  assert.equal(fullList.status, 200);
  assert.equal(fullList.body.data.length, 1);
  assert.equal(fullList.body.data[0].id, listingId);
  assert.equal(fullList.body.data[0].title, `Designer Evening Gown ${stamp}`);

  // 5. Shortlist creation & item addition
  const shortlist = await client.post('/favorites/shortlists', {
    title: 'Gala Looks 2026',
    description: 'Black tie inspiration',
  }, user.token);
  assert.equal(shortlist.status, 201);
  const shortlistId = shortlist.body.data.id;

  const addItem = await client.post(`/favorites/shortlists/${shortlistId}/items/${listingId}`, {}, user.token);
  assert.equal(addItem.status, 200);

  const shortlistsList = await client.get('/favorites/shortlists', user.token);
  assert.equal(shortlistsList.status, 200);
  assert.equal(shortlistsList.body.data[0].itemCount, 1);

  // 6. Remove item from shortlist
  const removeShortlistItem = await client.delete(`/favorites/shortlists/${shortlistId}/items/${listingId}`, user.token);
  assert.equal(removeShortlistItem.status, 204);

  // 7. Remove from favorites
  const removeFav = await client.delete(`/favorites/${listingId}`, user.token);
  assert.equal(removeFav.status, 204);

  const idsEmptyAgain = await client.get('/favorites/ids', user.token);
  assert.equal(idsEmptyAgain.status, 200);
  assert.deepEqual(idsEmptyAgain.body.data, []);
});
