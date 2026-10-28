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
let renter1;
let renter2;

before(async () => {
  const started = await startTestServer();
  client = makeClient(started.origin);
  close = started.close;
  admin = await registerAdminUser(client, 'bsize-admin');
  seller = await registerUser(client, 'bsize-seller');
  renter1 = await registerUser(client, 'bsize-renter1');
  renter2 = await registerUser(client, 'bsize-renter2');
});

after(async () => {
  await close();
  await closeDatabasePool();
});

test('free backup size pairing, inventory exclusion, and release on cancellation', async () => {
  const stamp = Date.now();

  // 1. Create Category
  const catRes = await client.post('/categories', { name: `Couture Gowns ${stamp}` }, admin.token);
  assert.equal(catRes.status, 201);
  const categoryId = catRes.body.data.id;

  // 2. Create Listing
  const listingRes = await client.post('/listings', {
    title: `Silk Velvet Column Gown ${stamp}`,
    condition: 'like_new',
    categoryId,
    rentalPricePaise: 50000,
    depositPaise: 100000,
    isRental: true,
    isSale: false,
  }, seller.token);
  assert.equal(listingRes.status, 201);
  const listingId = listingRes.body.data.id;

  // 3. Add TWO inventory units for the listing
  const unit1Res = await client.post('/inventory/items', {
    listingId,
    condition: 'like_new',
    barcode: `BC-${stamp}-1`,
  }, seller.token);
  assert.equal(unit1Res.status, 201);
  const unit1Id = unit1Res.body.data.id;

  const unit2Res = await client.post('/inventory/items', {
    listingId,
    condition: 'like_new',
    barcode: `BC-${stamp}-2`,
  }, seller.token);
  assert.equal(unit2Res.status, 201);
  const unit2Id = unit2Res.body.data.id;

  // 4. Check initial availability: 2 units available
  const availRes = await client.get(`/rentals/availability?listingId=${listingId}&startDate=2026-11-20&endDate=2026-11-23`);
  assert.equal(availRes.status, 200);
  assert.equal(availRes.body.data.availableUnits, 2);

  // 5. Renter 1 books with backupSize = 'US 6'
  const bookingRes = await client.post('/rentals/bookings', {
    listingId,
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    backupSize: 'US 6',
  }, renter1.token);
  assert.equal(bookingRes.status, 201);
  const booking = bookingRes.body.data;
  assert.equal(booking.backupSize, 'US 6');
  assert.equal(booking.backupReserved, true);

  // Verify items by fetching booking details
  const detailRes = await client.get(`/rentals/bookings/${booking.id}`, renter1.token);
  assert.equal(detailRes.status, 200);
  const detail = detailRes.body.data;
  assert.equal(detail.items.length, 2);
  const primaryItem = detail.items.find((i) => !i.isBackupSize);
  const backupItem = detail.items.find((i) => i.isBackupSize);
  assert.ok(primaryItem);
  assert.ok(backupItem);
  assert.equal(primaryItem.lineTotalPaise, 150000);
  assert.equal(backupItem.lineTotalPaise, 0);
  assert.equal(backupItem.dailyRatePaise, 0);

  // 6. Overlap check: all units are now reserved, so Renter 2 cannot book overlapping dates
  const overlapRes = await client.post('/rentals/bookings', {
    listingId,
    startDate: '2026-11-21',
    endDate: '2026-11-24',
  }, renter2.token);
  assert.equal(overlapRes.status, 409);
  assert.equal(overlapRes.body.error.code, 'DATES_NOT_AVAILABLE');

  // 7. Cancellation: Renter 1 cancels pending booking
  const cancelRes = await client.post(`/rentals/bookings/${booking.id}/cancel`, {
    reason: 'Event rescheduled',
  }, renter1.token);
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.data.status, 'cancelled');

  // 8. Availability restored: both units are AVAILABLE again
  const availAfterCancel = await client.get(`/rentals/availability?listingId=${listingId}&startDate=2026-11-20&endDate=2026-11-23`);
  assert.equal(availAfterCancel.status, 200);
  assert.equal(availAfterCancel.body.data.availableUnits, 2);

  // 9. Renter 2 can now successfully book
  const renter2Booking = await client.post('/rentals/bookings', {
    listingId,
    startDate: '2026-11-20',
    endDate: '2026-11-23',
  }, renter2.token);
  assert.equal(renter2Booking.status, 201);
  assert.equal(renter2Booking.body.data.status, 'pending');
});
