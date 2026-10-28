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
let renter;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'dw-admin');
  seller = await registerUser(client, 'dw-seller');
  renter = await registerUser(client, 'dw-renter');
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('damage waiver micro-insurance flat fee wiring and total calculations', async () => {
  const stamp = Date.now();

  // 1. Create Category
  const catRes = await client.post('/categories', { name: `Cocktail Dresses ${stamp}` }, admin.token);
  assert.equal(catRes.status, 201);
  const categoryId = catRes.body.data.id;

  // 2. Create Listing
  const listingRes = await client.post('/listings', {
    title: `Designer Party Dress ${stamp}`,
    condition: 'like_new',
    categoryId,
    rentalPricePaise: 40000, // Rs 400 / day
    depositPaise: 80000,    // Rs 800 deposit
    isRental: true,
    isSale: false,
  }, seller.token);
  assert.equal(listingRes.status, 201);
  const listingId = listingRes.body.data.id;

  // 3. Add inventory items (unit 1 and unit 2)
  const itemRes1 = await client.post('/inventory/items', {
    listingId,
    condition: 'like_new',
    barcode: `DW-BC-${stamp}-1`,
  }, seller.token);
  assert.equal(itemRes1.status, 201);

  const itemRes2 = await client.post('/inventory/items', {
    listingId,
    condition: 'like_new',
    barcode: `DW-BC-${stamp}-2`,
  }, seller.token);
  assert.equal(itemRes2.status, 201);

  // 4. Booking WITHOUT Damage Waiver: 3 days (120000 paise) + deposit (80000 paise) = 200000 paise
  const bookingNoWaiver = await client.post('/rentals/bookings', {
    listingId,
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    damageWaiver: false,
  }, renter.token);
  assert.equal(bookingNoWaiver.status, 201);
  const b1 = bookingNoWaiver.body.data;
  assert.equal(b1.damageWaiver.selected, false);
  assert.equal(b1.damageWaiver.feePaise, 0);
  assert.equal(b1.subtotalAmountPaise, 120000);
  assert.equal(b1.depositAmountPaise, 80000);
  assert.equal(b1.totalAmountPaise, 200000);

  // 5. Booking WITH Damage Waiver: 3 days (120000) + deposit (80000) + waiver (1250) = 201250 paise
  const bookingWithWaiver = await client.post('/rentals/bookings', {
    listingId,
    startDate: '2026-11-10',
    endDate: '2026-11-13',
    damageWaiver: true,
  }, renter.token);
  if (bookingWithWaiver.status !== 201) {
    console.error('FAILED bookingWithWaiver:', bookingWithWaiver.status, bookingWithWaiver.body);
  }
  assert.equal(bookingWithWaiver.status, 201);
  const b2 = bookingWithWaiver.body.data;
  assert.equal(b2.damageWaiver.selected, true);
  assert.equal(b2.damageWaiver.feePaise, 1250);
  assert.equal(b2.subtotalAmountPaise, 120000);
  assert.equal(b2.depositAmountPaise, 80000);
  assert.equal(b2.totalAmountPaise, 201250);

  // 6. Persistence check on GET /rentals/bookings/:id
  const getB2 = await client.get(`/rentals/bookings/${b2.id}`, renter.token);
  assert.equal(getB2.status, 200);
  assert.equal(getB2.body.data.damageWaiver.feePaise, 1250);
  assert.equal(getB2.body.data.damageWaiver.selected, true);
  assert.equal(getB2.body.data.totalAmountPaise, 201250);
});
