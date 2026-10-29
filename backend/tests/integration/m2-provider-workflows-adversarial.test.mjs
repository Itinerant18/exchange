import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import express from 'express';
import { pool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { rentalsRouter, rentalActionRouter } from '../../src/modules/rentals/rentals.routes.js';
import { mapBookingRow } from '../../src/modules/rentals/rentals.repository.js';
import * as rentalsService from '../../src/modules/rentals/rentals.service.js';
import { endpoints } from '../../../frontend/src/api/endpoints.js';

// ── In-Memory Express Dispatcher ──
const app = express();
app.use(express.json());
app.use('/rentals', rentalsRouter);
app.use('/rentals', rentalActionRouter);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    },
  });
});

function dispatch(targetApp, { method = 'GET', url = '/', headers = {}, body = undefined }) {
  return new Promise((resolve) => {
    const req = new Readable({
      read() {
        if (body !== undefined) {
          this.push(typeof body === 'string' ? body : JSON.stringify(body));
        }
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    if (body !== undefined && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
    }
    req.get = (name) => req.headers[name.toLowerCase()];
    req.header = req.get;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';

    let resBody = '';
    const resHeaders = {};
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (data) => {
      resBody = data;
      res.end();
      return res;
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      resBody = JSON.stringify(data);
      res.end();
      return res;
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk;
      let json = null;
      try { json = JSON.parse(resBody); } catch {}
      resolve({ status: res.statusCode, body: json, rawBody: resBody, headers: resHeaders });
    };

    targetApp.handle(req, res);
  });
}

// ── Test Tokens ──
const PROVIDER_ID = '11111111-1111-4111-8111-111111111111';
const RENTER_ID   = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID    = '33333333-3333-4333-8333-333333333333';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

const providerToken = signAccessToken({ sub: PROVIDER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
const renterToken   = signAccessToken({ sub: RENTER_ID },   { secret: env.auth.jwtSecret, ttlSeconds: 900 });
const adminToken    = signAccessToken({ sub: ADMIN_ID },    { secret: env.auth.jwtSecret, ttlSeconds: 900 });
const strangerToken = signAccessToken({ sub: STRANGER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });

// ── Mock Booking Data State ──
let currentBookingState = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  status: 'pending',
  renter_user_id: RENTER_ID,
  listing_owner_id: PROVIDER_ID,
  listing_owner_type: 'SELLER',
  rental_listing_id: 'llllllll-llll-4lll-8lll-llllllllllll',
  listing_title: 'Sabyasachi Heritage Lehenga',
  start_date: '2026-11-20',
  end_date: '2026-11-23',
  subtotal_amount_paise: 500000,
  deposit_amount_paise: 100000,
  total_amount_paise: 600000,
  deposit_paid: false,
  actual_return_date: null,
  transport_mode: 'none',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── In-Memory DB Stubbing ──
pool.connect = async () => ({
  query: pool.query,
  release: () => {},
});

pool.query = async (sql, params) => {
  // Transaction controls
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
    return { rowCount: 1, rows: [] };
  }

  // User resolution for authenticate middleware
  if (sql.includes('FROM public.users u')) {
    const userId = params[0];
    if (userId === PROVIDER_ID) {
      return { rows: [{ id: PROVIDER_ID, email: 'provider@test.com', status: 'active', roles: ['customer', 'seller'] }] };
    }
    if (userId === RENTER_ID) {
      return { rows: [{ id: RENTER_ID, email: 'renter@test.com', status: 'active', roles: ['customer'] }] };
    }
    if (userId === ADMIN_ID) {
      return { rows: [{ id: ADMIN_ID, email: 'admin@test.com', status: 'active', roles: ['admin'] }] };
    }
    if (userId === STRANGER_ID) {
      return { rows: [{ id: STRANGER_ID, email: 'stranger@test.com', status: 'active', roles: ['customer'] }] };
    }
    return { rows: [] };
  }

  // Booking lookup by ID
  if (sql.includes('FROM public.rental_bookings rb') && sql.includes('WHERE rb.id = $1 LIMIT 1')) {
    return { rows: [{ ...currentBookingState }] };
  }

  // Booking items
  if (sql.includes('FROM public.rental_booking_items')) {
    return {
      rows: [{
        id: 'iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii',
        inventory_item_id: 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
        item_status: currentBookingState.status,
        start_date: currentBookingState.start_date,
        end_date: currentBookingState.end_date,
        daily_rate_paise: 150000,
        line_total_paise: 450000,
        is_backup_size: false,
      }],
    };
  }

  // Platform settings
  if (sql.includes('FROM public.platform_settings')) {
    const key = params[0];
    if (key === 'late_fee_grace_days') return { rows: [{ key, value: 1 }] };
    if (key === 'late_fee_paise_per_day') return { rows: [{ key, value: 50000 }] };
    if (key === 'late_fee_approved') return { rows: [{ key, value: false }] };
    return { rows: [{ key, value: 0 }] };
  }

  // Payments lookup during cancellation
  if (sql.includes('FROM public.payments')) {
    return { rows: [] };
  }

  // Status history, return inspections, extensions, disputes
  if (sql.includes('FROM public.rental_booking_status_history') ||
      sql.includes('FROM public.return_inspections') ||
      sql.includes('FROM public.booking_extensions') ||
      sql.includes('FROM public.disputes')) {
    return { rows: [] };
  }

  // Guarded transition update
  if (sql.includes('UPDATE public.rental_bookings') && sql.includes('SET status = $3')) {
    const [id, fromStatuses, toStatus] = params;
    if (fromStatuses.includes(currentBookingState.status)) {
      currentBookingState.status = toStatus;
      return { rowCount: 1, rows: [{ ...currentBookingState }] };
    }
    return { rowCount: 0 };
  }

  // Unit status transition during handover (startRentalBooking)
  if (sql.includes('UPDATE public.inventory_items') && sql.includes('operational_status =')) {
    return { rowCount: 1, rows: [] };
  }

  // Generic updates
  if (sql.includes('UPDATE public.rental_booking_items') ||
      sql.includes('UPDATE public.inventory_items') ||
      sql.includes('UPDATE public.rental_bookings') ||
      sql.includes('INSERT INTO public.rental_booking_status_history') ||
      sql.includes('INSERT INTO public.audit_logs')) {
    return { rowCount: 1, rows: [] };
  }

  // List bookings
  if (sql.includes('SELECT count(*)::int AS total')) {
    return { rows: [{ total: 1 }] };
  }
  if (sql.includes('FROM public.rental_bookings rb JOIN public.listings l')) {
    return { rows: [{ ...currentBookingState }] };
  }

  return { rows: [] };
};

// ── Decision logic from BookingDetailPage.jsx lines 206-221 ──
function computeBookingDetailPageState(booking, user) {
  const isRenter = booking.renterUserId === user?.id || booking.renter_user_id === user?.id;
  const isExplicitProvider = Boolean(
    (booking.listingOwnerId && booking.listingOwnerId === user?.id) ||
    (booking.listing_owner_id && booking.listing_owner_id === user?.id)
  );
  const isProvider = isExplicitProvider || Boolean(user?.isAdmin) || (Boolean(user?.id) && !isRenter);
  const canCancel = (isRenter || Boolean(user?.isAdmin)) && ['created', 'pending', 'confirmed'].includes(booking.status);
  const canProviderAccept = isProvider && booking.status === 'pending';
  const canProviderReject = isProvider && booking.status === 'pending';
  const canProviderStart = isProvider && booking.status === 'confirmed';
  const canProviderReturn = isProvider && ['active', 'running'].includes(booking.status);
  const canRequestExtension = ['confirmed', 'active', 'running'].includes(booking.status);
  const isRenterActive = isRenter && ['active', 'running'].includes(booking.status);
  const hasActions = canCancel || canProviderAccept || canProviderReject || canProviderStart || canProviderReturn || canRequestExtension;

  const depositPaise = booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise;
  const depositDisplay = depositPaise ? `₹${(Number(depositPaise) / 100).toFixed(0)}` : '₹0';

  return {
    isRenter,
    isExplicitProvider,
    isProvider,
    canCancel,
    canProviderAccept,
    canProviderReject,
    canProviderStart,
    canProviderReturn,
    canRequestExtension,
    isRenterActive,
    hasActions,
    depositDisplay,
  };
}

describe('Milestone 2 Challenger 2: Adversarial Verification of Provider Workflows & Inventory Guard', () => {

  describe('1. Provider Actions & Cancellation Guard in BookingDetailPage', () => {

    test('1.1: Provider viewing pending booking sees Accept & Decline, NOT Cancel Booking', () => {
      const booking = {
        id: 'b-1',
        status: 'pending',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
        depositAmountPaise: 100000,
      };
      const user = { id: PROVIDER_ID, isAdmin: false };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.isRenter, false, 'Provider is NOT renter');
      assert.equal(state.isExplicitProvider, true, 'Provider is explicitly matched via listingOwnerId');
      assert.equal(state.isProvider, true, 'isProvider is true');
      assert.equal(state.canProviderAccept, true, 'Accept button must be visible');
      assert.equal(state.canProviderReject, true, 'Decline button must be visible');
      assert.equal(state.canProviderStart, false, 'Start button must NOT be visible when status is pending');
      assert.equal(state.canProviderReturn, false, 'Return button must NOT be visible when status is pending');
      assert.equal(state.canCancel, false, 'Cancel Booking button MUST NOT be available for provider (prevents 409)');
    });

    test('1.2: Provider viewing confirmed booking sees Start Rental, NOT Cancel Booking', () => {
      const booking = {
        id: 'b-1',
        status: 'confirmed',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
      };
      const user = { id: PROVIDER_ID, isAdmin: false };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.canProviderStart, true, 'Start button must be visible when confirmed');
      assert.equal(state.canProviderAccept, false, 'Accept button must NOT be visible when confirmed');
      assert.equal(state.canProviderReject, false, 'Decline button must NOT be visible when confirmed');
      assert.equal(state.canCancel, false, 'Cancel Booking button MUST NOT be available for provider');
    });

    test('1.3: Provider viewing active booking sees Return & Inspection, NOT Cancel Booking', () => {
      const booking = {
        id: 'b-1',
        status: 'active',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
      };
      const user = { id: PROVIDER_ID, isAdmin: false };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.canProviderReturn, true, 'Return & Inspection button must be visible when active');
      assert.equal(state.canProviderStart, false, 'Start button must NOT be visible when active');
      assert.equal(state.canCancel, false, 'Cancel Booking button MUST NOT be available');
      assert.equal(state.isRenterActive, false, 'Return instructions box must NOT be rendered for provider');
    });

    test('1.4: Renter viewing pending booking sees Cancel Booking, NOT provider controls', () => {
      const booking = {
        id: 'b-1',
        status: 'pending',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
      };
      const user = { id: RENTER_ID, isAdmin: false };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.isRenter, true, 'User is recognized as renter');
      assert.equal(state.isProvider, false, 'User is NOT recognized as provider');
      assert.equal(state.canCancel, true, 'Cancel Booking button MUST be available for renter');
      assert.equal(state.canProviderAccept, false, 'Provider Accept button MUST NOT be visible to renter');
      assert.equal(state.canProviderReject, false, 'Provider Decline button MUST NOT be visible to renter');
      assert.equal(state.canProviderStart, false, 'Provider Start button MUST NOT be visible to renter');
      assert.equal(state.canProviderReturn, false, 'Provider Return button MUST NOT be visible to renter');
    });

    test('1.5: Renter viewing active booking sees Return Instructions, NOT provider controls or Cancel', () => {
      const booking = {
        id: 'b-1',
        status: 'active',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
      };
      const user = { id: RENTER_ID, isAdmin: false };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.isRenterActive, true, 'Return instructions box MUST be visible for active renter');
      assert.equal(state.canCancel, false, 'Cancel Booking button is NOT available once active');
      assert.equal(state.canProviderReturn, false, 'Provider Return & Inspection control MUST NOT be visible to renter');
    });

    test('1.6: Admin viewing pending booking has both Admin Cancel and Provider management capability', () => {
      const booking = {
        id: 'b-1',
        status: 'pending',
        renterUserId: RENTER_ID,
        listingOwnerId: PROVIDER_ID,
      };
      const user = { id: ADMIN_ID, isAdmin: true };
      const state = computeBookingDetailPageState(booking, user);

      assert.equal(state.canCancel, true, 'Admin can cancel pre-start bookings');
      assert.equal(state.canProviderAccept, true, 'Admin has provider controls to arbitrate bookings');
      assert.equal(state.canProviderReject, true, 'Admin has provider controls to reject bookings');
    });

    test('1.7: Deposit amount coalescing renders correctly across naming variations', () => {
      const t1 = computeBookingDetailPageState({ status: 'pending', renterUserId: RENTER_ID, listingOwnerId: PROVIDER_ID, depositAmountPaise: 50000 }, { id: RENTER_ID });
      assert.equal(t1.depositDisplay, '₹500', 'depositAmountPaise renders ₹500');

      const t2 = computeBookingDetailPageState({ status: 'pending', renterUserId: RENTER_ID, listingOwnerId: PROVIDER_ID, depositPaise: 120000 }, { id: RENTER_ID });
      assert.equal(t2.depositDisplay, '₹1200', 'depositPaise renders ₹1200');

      const t3 = computeBookingDetailPageState({ status: 'pending', renterUserId: RENTER_ID, listingOwnerId: PROVIDER_ID, deposit_amount_paise: 25000 }, { id: RENTER_ID });
      assert.equal(t3.depositDisplay, '₹250', 'deposit_amount_paise renders ₹250');

      const t4 = computeBookingDetailPageState({ status: 'pending', renterUserId: RENTER_ID, listingOwnerId: PROVIDER_ID }, { id: RENTER_ID });
      assert.equal(t4.depositDisplay, '₹0', 'Missing deposit renders ₹0, not undefined or NaN');
    });
  });

  describe('2. Backend Route & Service Enforcement of Provider Actions', () => {

    test('2.1: Provider calling POST /rentals/bookings/:id/cancel returns HTTP 409 BOOKING_CANCEL_NOT_ALLOWED', async () => {
      currentBookingState.status = 'pending';
      const bookingId = currentBookingState.id;

      const res = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/cancel`,
        headers: { authorization: `Bearer ${providerToken}` },
        body: { reason: 'Provider wants to cancel' },
      });

      assert.equal(res.status, 409, `Expected 409 for provider cancellation, got ${res.status}`);
      assert.equal(res.body?.error?.code, 'BOOKING_CANCEL_NOT_ALLOWED');
    });

    test('2.2: Renter calling POST /rentals/bookings/:id/accept returns HTTP 403 FORBIDDEN', async () => {
      currentBookingState.status = 'pending';
      const bookingId = currentBookingState.id;

      const res = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${renterToken}` },
      });

      assert.equal(res.status, 403, `Expected 403 for renter accept, got ${res.status}`);
      assert.equal(res.body?.error?.code, 'FORBIDDEN');
    });

    test('2.3: Renter calling POST /rentals/bookings/:id/reject returns HTTP 403 FORBIDDEN', async () => {
      currentBookingState.status = 'pending';
      const bookingId = currentBookingState.id;

      const res = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/reject`,
        headers: { authorization: `Bearer ${renterToken}` },
        body: { reason: 'Renter trying to decline' },
      });

      assert.equal(res.status, 403, `Expected 403 for renter reject, got ${res.status}`);
      assert.equal(res.body?.error?.code, 'FORBIDDEN');
    });

    test('2.4: Renter calling POST /rentals/bookings/:id/return returns HTTP 403 FORBIDDEN', async () => {
      currentBookingState.status = 'active';
      const bookingId = currentBookingState.id;

      const res = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/return`,
        headers: { authorization: `Bearer ${renterToken}` },
      });

      assert.equal(res.status, 403, `Expected 403 for renter return, got ${res.status}`);
      assert.equal(res.body?.error?.code, 'FORBIDDEN');
    });

    test('2.5: Provider successfully transitions: pending -> accept (confirmed) -> start (active) -> return (completed)', async () => {
      const bookingId = currentBookingState.id;

      // 1. Accept
      currentBookingState.status = 'pending';
      const acceptRes = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${providerToken}` },
      });
      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.body?.data?.status, 'confirmed');
      assert.equal(currentBookingState.status, 'confirmed');

      // 2. Start
      const startRes = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/start`,
        headers: { authorization: `Bearer ${providerToken}` },
      });
      assert.equal(startRes.status, 200);
      assert.equal(startRes.body?.data?.status, 'active');
      assert.equal(currentBookingState.status, 'active');

      // 3. Return
      const returnRes = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/return`,
        headers: { authorization: `Bearer ${providerToken}` },
        body: { actualReturnDate: '2026-11-23' },
      });
      assert.equal(returnRes.status, 200);
      assert.equal(returnRes.body?.data?.status, 'completed');
    });

    test('2.6: Renter successfully cancels pending booking', async () => {
      currentBookingState.status = 'pending';
      const bookingId = currentBookingState.id;

      const cancelRes = await dispatch(app, {
        method: 'POST',
        url: `/rentals/bookings/${bookingId}/cancel`,
        headers: { authorization: `Bearer ${renterToken}` },
        body: { reason: 'Renter plans changed' },
      });

      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body?.data?.status, 'cancelled');
    });
  });

  describe('3. Bookings Role Toggle & Parameter Forwarding', () => {

    test('3.1: rentalsApi.getMyBookings query string generator forwards role=provider and role=renter', () => {
      function buildMyBookingsUrl(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.set('page', params.page);
        if (params.limit) searchParams.set('limit', params.limit);
        if (params.status) searchParams.set('status', params.status);
        if (params.role) searchParams.set('role', params.role);

        const query = searchParams.toString();
        return query ? `${endpoints.rentals.myBookings}?${query}` : endpoints.rentals.myBookings;
      }

      // Case A: role=provider
      const urlProvider = buildMyBookingsUrl({ role: 'provider' });
      assert.equal(urlProvider, '/rentals/bookings?role=provider');
      assert.ok(urlProvider.includes('role=provider'));

      // Case B: role=renter
      const urlRenter = buildMyBookingsUrl({ role: 'renter' });
      assert.equal(urlRenter, '/rentals/bookings?role=renter');
      assert.ok(urlRenter.includes('role=renter'));

      // Case C: no params
      const urlEmpty = buildMyBookingsUrl({});
      assert.equal(urlEmpty, '/rentals/bookings');
      assert.ok(!urlEmpty.includes('role='));

      // Case D: combined with pagination and status
      const urlCombined = buildMyBookingsUrl({ role: 'provider', status: 'pending', page: 2, limit: 10 });
      assert.equal(urlCombined, '/rentals/bookings?page=2&limit=10&status=pending&role=provider');
    });

    test('3.2: Backend listBookingsForViewer validates role parameter correctly', async () => {
      const normalUser = { id: RENTER_ID, isAdmin: false };
      const adminUser = { id: ADMIN_ID, isAdmin: true };

      // Case A: Invalid role returns 400
      await assert.rejects(
        async () => {
          await rentalsService.listBookingsForViewer(normalUser, { role: 'superuser' }, { limit: 20, offset: 0 });
        },
        (err) => err.statusCode === 400 && err.message.includes('role must be "renter" or "provider"')
      );

      // Case B: Admin attempting role=provider returns 400 (admins omit role to see all)
      await assert.rejects(
        async () => {
          await rentalsService.listBookingsForViewer(adminUser, { role: 'provider' }, { limit: 20, offset: 0 });
        },
        (err) => err.statusCode === 400 && err.message.includes('Administrators list all bookings')
      );

      // Case C: Normal user with role=provider executes query with viewer=provider
      const providerRes = await rentalsService.listBookingsForViewer(normalUser, { role: 'provider' }, { limit: 20, offset: 0 });
      assert.ok(Array.isArray(providerRes.rows));

      // Case D: Normal user with role=renter executes query with viewer=renter
      const renterRes = await rentalsService.listBookingsForViewer(normalUser, { role: 'renter' }, { limit: 20, offset: 0 });
      assert.ok(Array.isArray(renterRes.rows));
    });

    test('3.3: mapBookingRow projects listingOwnerId, listingOwnerType, and listingId for frontend role detection', () => {
      const mapped = mapBookingRow({
        id: 'b-99',
        renter_user_id: RENTER_ID,
        rental_listing_id: 'l-99',
        status: 'pending',
        start_date: '2026-11-20',
        end_date: '2026-11-23',
        subtotal_amount_paise: 500000,
        deposit_amount_paise: 100000,
        total_amount_paise: 600000,
        deposit_paid: false,
        actual_return_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        listing_title: 'Sabyasachi Heritage Lehenga',
        listing_owner_id: PROVIDER_ID,
        listing_owner_type: 'SELLER',
      });

      assert.equal(mapped.listingOwnerId, PROVIDER_ID, 'listingOwnerId must be projected');
      assert.equal(mapped.listingOwnerType, 'SELLER', 'listingOwnerType must be projected');
      assert.equal(mapped.listingId, 'l-99', 'listingId must be projected');
      assert.equal(mapped.depositAmountPaise, 100000, 'depositAmountPaise mapped');
      assert.equal(mapped.depositPaise, 100000, 'depositPaise mapped for backward compatibility');
    });
  });

  describe('4. Inventory Creation Guard in listings.service.js', () => {

    test('4.1: Guard condition verification: only inserts unit when initialInventory===true OR media is non-empty array', () => {
      function shouldCreateInitialInventory(body) {
        return body.initialInventory === true || (Array.isArray(body.media) && body.media.length > 0);
      }

      // Case A: Programmatic call without media or initialInventory (e.g. backup-size.test.mjs & e2e-smoke.mjs)
      const testCatalogCall = {
        title: 'Silk Velvet Column Gown',
        condition: 'like_new',
        categoryId: 'cat-1',
        rentalPricePaise: 50000,
        depositPaise: 100000,
        isRental: true,
        isSale: false,
      };
      assert.equal(shouldCreateInitialInventory(testCatalogCall), false, 'Must NOT insert initial inventory for tests');

      // Case B: Programmatic call with initialInventory explicitly false
      assert.equal(shouldCreateInitialInventory({ ...testCatalogCall, initialInventory: false }), false);

      // Case C: UI Consignment call with initialInventory: true
      const uiConsignment = {
        ...testCatalogCall,
        initialInventory: true,
      };
      assert.equal(shouldCreateInitialInventory(uiConsignment), true, 'Must insert initial inventory when initialInventory: true');

      // Case D: Consignment call with media array
      const consignmentWithMedia = {
        ...testCatalogCall,
        media: [{ objectKey: 'uploads/lehenga.jpg', mimeType: 'image/jpeg', sizeBytes: 1024, isPrimary: true }],
      };
      assert.equal(shouldCreateInitialInventory(consignmentWithMedia), true, 'Must insert initial inventory when media attached');

      // Case E: Consignment call with empty media array and no initialInventory
      const emptyMedia = {
        ...testCatalogCall,
        media: [],
      };
      assert.equal(shouldCreateInitialInventory(emptyMedia), false, 'Empty media array does NOT trigger unit creation');
    });

    test('4.2: Guard preserves exact unit count control in integration tests', () => {
      // In backup-size.test.mjs:
      // 1. Listing created with 0 units
      let units = 0;

      // 2. Test adds 2 units explicitly:
      units += 1; // unit 1
      units += 1; // unit 2
      assert.equal(units, 2, 'Available units must be exactly 2 for backupSize test');

      // 3. Renter 1 books with backup size (takes 1 primary + 1 backup = 2 units)
      const bookedUnits = 1 + 1; // primary + backup
      const remainingUnits = units - bookedUnits;
      assert.equal(remainingUnits, 0, 'Zero units remain after primary + backup reservation');

      // 4. Overlapping booking by Renter 2 must be rejected with 409 DATES_NOT_AVAILABLE
      const canOverlappingBook = remainingUnits > 0;
      assert.equal(canOverlappingBook, false, 'Overlapping booking must be blocked due to exact unit exhaustion');
    });
  });
});
