// Exchange24 end-to-end HTTP smoke against a running dev API (default
// http://127.0.0.1:5000). Exercises the whole lifecycle: registration, admin
// grant, category, listing, inventory, rental booking + payment settlement,
// deposit, return, deposit release + refund, sale order, review.
//
// Usage: node scripts/e2e-smoke.mjs    (server must be running)
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5000/api/v1';
let failures = 0;

const pass = (name) => console.log(`PASS: ${name}`);
const fail = (name, detail) => { failures += 1; console.log(`FAIL: ${name} -- ${detail}`); };
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass(name); else fail(name, `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};

async function request(method, path, { token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await response.json(); } catch { /* 204 */ }
  return { status: response.status, body: json };
}

const expect = (response, status, name) => {
  if (response.status !== status) {
    fail(name, `status ${response.status}: ${JSON.stringify(response.body)?.slice(0, 300)}`);
    return false;
  }
  pass(name);
  return true;
};

const stamp = Date.now().toString(36);
const password = 'Sup3r-Secret-Passphrase!';
const register = async (role) => {
  const response = await request('POST', '/auth/register', {
    body: { email: `e2e-${role}-${stamp}@exchnage.test`, password, displayName: `E2E ${role}` },
  });
  return response.body?.data;
};

const seller = await register('seller');
const renter = await register('renter');
const adminU = await register('admin');
if (!seller?.user?.id) { console.log('FATAL: seller registration failed', seller); process.exit(1); }
check('registration returns both roles', seller.user.roles.sort(), ['customer', 'seller']);

// Admin grant via CLI
const grant = spawnSync(process.execPath, [join(backendDir, 'database', 'factories', 'grant-admin.js'), `e2e-admin-${stamp}@exchnage.test`], { cwd: backendDir, encoding: 'utf8' });
if (grant.status !== 0) fail('grant-admin CLI', grant.stderr); else pass('grant-admin CLI');
const adminLogin = await request('POST', '/auth/login', { body: { email: `e2e-admin-${stamp}@exchnage.test`, password } });
check('admin login after grant', adminLogin.status, 200);
const adminToken = adminLogin.body?.data?.accessToken;
const me = await request('GET', '/auth/me', { token: adminToken });
check('admin /auth/me has admin role', me.body?.data?.roles?.includes('admin'), true);

// Category creation (admin only)
const category = await request('POST', '/categories', { token: adminToken, body: { name: `E2E Sarees ${stamp}` } });
if (expect(category, 201, 'admin creates category (201)')) {
  const denial = await request('POST', '/categories', { token: seller.accessToken, body: { name: `E2E X ${stamp}` } });
  check('seller cannot create category (403)', denial.status, 403);
}
const categoryId = category.body?.data?.id;

// Listing
const listing = await request('POST', '/listings', {
  token: seller.accessToken,
  body: {
    title: `E2E Banarasi silk ${stamp}`, condition: 'like_new', categoryId,
    rentalPricePaise: 50000, depositPaise: 100000, isRental: true,
    salePricePaise: 250000, isSale: true,
  },
});
if (!expect(listing, 201, 'seller creates listing (201)')) process.exit(1);
const listingId = listing.body.data.id;

const selfBook = await request('POST', '/rentals/bookings', {
  token: seller.accessToken, body: { listingId, startDate: '2026-11-10', endDate: '2026-11-12' },
});
check('self booking rejected (409)', selfBook.status, 409);

// Inventory
const item = await request('POST', '/inventory/items', { token: seller.accessToken, body: { listingId, condition: 'good' } });
if (!expect(item, 201, 'seller adds inventory unit (201)')) process.exit(1);
const itemId = item.body.data.id;
check('new unit is AVAILABLE', item.body.data.operationalStatus, 'AVAILABLE');

// Availability (public)
const avail = await request('GET', `/rentals/availability?listingId=${listingId}&startDate=2026-11-10&endDate=2026-11-12`);
check('availability sees 1 unit', avail.body?.data?.availableUnits, 1);

// Booking (renter)
const booking = await request('POST', '/rentals/bookings', {
  token: renter.accessToken, body: { listingId, startDate: '2026-11-10', endDate: '2026-11-12' },
});
if (!expect(booking, 201, 'renter books 2 days (201)')) process.exit(1);
const bookingId = booking.body.data.id;
check('booking subtotal = rate x days', booking.body.data.subtotalAmountPaise, 100000);
check('booking total includes deposit', booking.body.data.totalAmountPaise, 200000);

const overlap = await request('POST', '/rentals/bookings', {
  token: renter.accessToken, body: { listingId, startDate: '2026-11-11', endDate: '2026-11-13' },
});
check('overlapping booking rejected (409)', overlap.status, 409);
check('overlap error code', ['RENTAL_OVERLAP', 'DATES_NOT_AVAILABLE'].includes(overlap.body?.error?.code), true);

// Rental payment + settlement
const payment = await request('POST', '/payments', {
  token: renter.accessToken, body: { paymentType: 'rental', rentalBookingId: bookingId, idempotencyKey: `e2e-rental-${stamp}` },
});
if (!expect(payment, 201, 'renter creates payment intent (201)')) process.exit(1);
const paymentId = payment.body.data.id;
check('intent pending', payment.body.data.status, 'pending');
check('intent amount', payment.body.data.amountPaise, 100000);

const replay = await request('POST', '/payments', {
  token: renter.accessToken, body: { paymentType: 'rental', rentalBookingId: bookingId, idempotencyKey: `e2e-rental-${stamp}` },
});
check('idempotent replay 200 same payment', replay.status === 200 && replay.body.data.id === paymentId, true);

const settle = await request('POST', `/admin/payments/${paymentId}/settle`, {
  token: adminToken, body: { providerTransactionId: `E2E-TXN-${stamp}` },
});
check('admin settles rental (200)', settle.status, 200);
check('settlement succeeded', settle.body?.data?.status, 'succeeded');

const bookingAfterSettle = await request('GET', `/rentals/bookings/${bookingId}`, { token: renter.accessToken });
check('booking confirmed after settlement', bookingAfterSettle.body?.data?.status, 'confirmed');
check('history includes settled transition', JSON.stringify(bookingAfterSettle.body?.data?.history).includes('"Payment settled"'), true);

const reSettle = await request('POST', `/admin/payments/${paymentId}/settle`, { token: adminToken, body: { providerTransactionId: 'OTHER-TXN' } });
check('re-settlement refused (409)', reSettle.status, 409);

// Renters cannot settle
const renterSettle = await request('POST', `/admin/payments/${paymentId}/settle`, { token: renter.accessToken, body: {} });
check('renter cannot settle (403)', renterSettle.status, 403);

// Deposit
const depPayment = await request('POST', '/payments', {
  token: renter.accessToken, body: { paymentType: 'deposit', rentalBookingId: bookingId, idempotencyKey: `e2e-deposit-${stamp}` },
});
if (!expect(depPayment, 201, 'deposit intent (201)')) process.exit(1);
const depositAmount = depPayment.body.data.amountPaise;
check('deposit amount', depositAmount, 100000);
const depotSettled = await request('POST', `/admin/payments/${depPayment.body.data.id}/settle`, {
  token: adminToken, body: { providerTransactionId: `E2E-DEP-${stamp}` },
});
check('deposit settles', depotSettled.status, 200);
const bookingDep = await request('GET', `/rentals/bookings/${bookingId}`, { token: renter.accessToken });
check('deposit_paid flag set', bookingDep.body?.data?.depositPaid, true);

// duplicate deposit intent refused
const depDup = await request('POST', '/payments', {
  token: renter.accessToken, body: { paymentType: 'deposit', rentalBookingId: bookingId, idempotencyKey: `e2e-deposit-2-${stamp}` },
});
check('second deposit intent refused (409)', depDup.status, 409);

// Start + return (provider)
const start = await request('POST', `/rentals/bookings/${bookingId}/start`, { token: seller.accessToken, body: {} });
check('provider starts rental', start.body?.data?.status, 'active');
const renterStart = await request('POST', `/rentals/bookings/${bookingId}/return`, { token: renter.accessToken, body: {} });
check('renter cannot record return (403)', renterStart.status, 403);
const complete = await request('POST', `/rentals/bookings/${bookingId}/return`, { token: seller.accessToken, body: {} });
check('provider records return', complete.body?.data?.status, 'completed');

const itemAfterReturn = await request('GET', `/inventory/items/${itemId}`, { token: seller.accessToken });
check('unit free of blocking rentals after return', itemAfterReturn.body?.data?.upcomingRentals?.length, 0);

// Deposit now releasing
const deposits = await request('GET', '/deposits', { token: renter.accessToken });
const myDeposit = deposits.body?.data?.find((deposit) => deposit.rentalBookingId === bookingId);
check('deposit exists for booking', Boolean(myDeposit), true);
check('deposit releasing after return', myDeposit?.status, 'releasing');

// Deposit release + auto refund
const release = await request('POST', `/admin/deposits/${myDeposit.id}/release`, { token: adminToken, body: {} });
check('admin releases deposit', release.body?.data?.status, 'released');
const refundsAfterRelease = await request('GET', '/admin/refunds', { token: adminToken });
const autoRefund = refundsAfterRelease.body?.data?.find((refund) => refund.amountPaise === depositAmount && refund.reason === 'item_returned');
check('auto refund created (item_returned)', Boolean(autoRefund), true);

const settleRefund = await request('POST', `/admin/refunds/${autoRefund.id}/settle`, { token: adminToken, body: { outcome: 'succeeded' } });
check('admin settles refund (204)', settleRefund.status, 204);

// Sale order
const order = await request('POST', '/orders', { token: renter.accessToken, body: { items: [itemId] } });
if (!expect(order, 201, 'renter orders the unit (201)')) process.exit(1);
const orderId = order.body.data.id;
check('order total = sale price', order.body.data.totalAmountPaise, 250000);
const salePayment = await request('POST', '/payments', {
  token: renter.accessToken, body: { paymentType: 'sale', orderId, idempotencyKey: `e2e-sale-${stamp}` },
});
if (!expect(salePayment, 201, 'sale intent (201)')) process.exit(1);
const saleSettle = await request('POST', `/admin/payments/${salePayment.body.data.id}/settle`, {
  token: adminToken, body: { providerTransactionId: `E2E-SALE-${stamp}` },
});
check('admin settles sale', saleSettle.status, 200);
const orderAfterSale = await request('GET', `/orders/${orderId}`, { token: renter.accessToken });
check('order paid', orderAfterSale.body?.data?.status, 'paid');
const itemSold = await request('GET', `/inventory/items/${itemId}`, { token: seller.accessToken });
check('unit SOLD', itemSold.body?.data?.operationalStatus, 'SOLD');
const doubleBuy = await request('POST', '/orders', { token: renter.accessToken, body: { items: [itemId] } });
check('double purchase rejected (409)', doubleBuy.status, 409);

// Review
const review = await request('POST', '/reviews', {
  token: renter.accessToken,
  body: { side: 'as_renter', qualifyingRentalBookingId: bookingId, rating: 5, comment: 'Great saree, punctual handover.' },
});
if (!expect(review, 201, 'renter reviews provider (201)')) process.exit(1);
const dupReview = await request('POST', '/reviews', {
  token: renter.accessToken, body: { side: 'as_renter', qualifyingRentalBookingId: bookingId, rating: 4 },
});
check('duplicate review rejected (409)', dupReview.status, 409);
const sellerReviews = await request('GET', `/reviews?revieweeId=${seller.user.id}`);
check('provider review count 1', sellerReviews.body?.meta?.reputation?.reviewCount, 1);
check('provider average 5', sellerReviews.body?.meta?.reputation?.averageRating, 5);

console.log(`==== e2e-smoke complete: ${failures} failure(s) ====`);
process.exit(failures > 0 ? 1 : 0);
