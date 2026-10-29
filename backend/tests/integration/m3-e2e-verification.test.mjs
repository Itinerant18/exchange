import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import express from 'express';
import { pool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/jwt.js';

import { categoriesRouter, categoryAdminRouter } from '../../src/modules/categories/categories.routes.js';
import { listingsRouter, listingOwnerRouter } from '../../src/modules/listings/listings.routes.js';
import { inventoryRouter } from '../../src/modules/inventory/inventory.routes.js';
import { rentalsRouter, rentalActionRouter } from '../../src/modules/rentals/rentals.routes.js';

const app = express();
app.use(express.json());
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/categories', categoryAdminRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/listings', listingOwnerRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/rentals', rentalActionRouter);

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
    req.body = body;
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

describe('Milestone 3 Full E2E & Backup Size Verification Suite', () => {
  const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
  const SELLER_ID = '20000000-0000-4000-8000-000000000002';
  const RENTER1_ID = '30000000-0000-4000-8000-000000000003';
  const RENTER2_ID = '40000000-0000-4000-8000-000000000004';

  const adminToken = signAccessToken({ sub: ADMIN_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const sellerToken = signAccessToken({ sub: SELLER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const renter1Token = signAccessToken({ sub: RENTER1_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const renter2Token = signAccessToken({ sub: RENTER2_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });

  // In-memory data store for E2E lifecycle
  const users = new Map([
    [ADMIN_ID, { id: ADMIN_ID, email: 'admin@exchange.test', status: 'active', roles: ['customer', 'admin'] }],
    [SELLER_ID, { id: SELLER_ID, email: 'seller@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [RENTER1_ID, { id: RENTER1_ID, email: 'renter1@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [RENTER2_ID, { id: RENTER2_ID, email: 'renter2@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
  ]);

  const categories = new Map();
  // Pre-seed a category
  categories.set('c0000000-0000-4000-8000-000000000001', {
    id: 'c0000000-0000-4000-8000-000000000001',
    name: 'Sarees',
    slug: 'sarees',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
  });
  const listings = new Map();
  const inventory = new Map();
  const bookings = new Map();
  const bookingItems = new Map();

  pool.connect = async () => ({
    query: pool.query,
    release: () => {},
  });

  pool.query = async (sql, params = []) => {
    // Transaction statements
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rowCount: 1, rows: [] };
    }

    // Users lookup
    if (sql.includes('FROM public.users u') && sql.includes('WHERE u.id = $1')) {
      const u = users.get(params[0]);
      return { rows: u ? [u] : [] };
    }

    // Settings lookups
    if (sql.includes('FROM public.platform_settings') || sql.includes('backup_sizes_enabled')) {
      const key = params[0];
      const settingsMap = {
        backup_sizes_enabled: true,
        max_rental_days: 30,
        min_rental_days: 1,
        damage_waiver_fee_paise: 25000,
        delivery_rate_paise_per_km: 1000,
        late_fee_approved: true,
        late_fee_paise_per_day: 5000,
        late_fee_grace_days: 1,
        commission_bps: 1000,
      };
      if (key && key in settingsMap) {
        return { rows: [{ key, value: settingsMap[key], is_approved: true }] };
      }
      return {
        rows: Object.entries(settingsMap).map(([k, v]) => ({ key: k, value: v, is_approved: true })),
      };
    }

    // Categories queries
    if (sql.includes('INSERT INTO public.categories')) {
      const id = 'c0000000-0000-4000-8000-' + String(categories.size + 1).padStart(12, '0');
      const row = { id, name: params[0], slug: params[1] || 'couture-gowns', is_active: true, display_order: 1, created_at: new Date().toISOString() };
      categories.set(id, row);
      return { rows: [row] };
    }
    if (sql.includes('FROM public.categories') && sql.includes('WHERE id = $1')) {
      const c = categories.get(params[0]);
      return { rows: c ? [c] : [] };
    }
    if (sql.includes('FROM public.categories WHERE slug = $1') || (sql.includes('FROM public.categories') && sql.includes('WHERE slug = $1'))) {
      const c = [...categories.values()].find((cat) => cat.slug === params[0]);
      return { rows: c ? [c] : [] };
    }

    // Listings queries
    if (sql.includes('INSERT INTO public.listings')) {
      const id = 'a0000000-0000-4000-8000-' + String(listings.size + 1).padStart(12, '0');
      const row = {
        id,
        owner_type: params[0] || 'SELLER',
        owner_user_id: params[1],
        category_id: params[2],
        title: params[3],
        description: params[4] || null,
        condition: params[5],
        size: params[6] || null,
        colour: params[7] || null,
        brand: params[8] || null,
        rental_price_paise: params[9] || 50000,
        sale_price_paise: params[10] || 250000,
        deposit_paise: params[11] || 100000,
        replacement_value_paise: params[12] || null,
        is_rental: params[13] !== false,
        is_sale: params[14] === true,
        city: params[15] || null,
        delivery_available: params[16] || false,
        status: 'active',
        listing_status: 'active',
        created_at: new Date().toISOString(),
      };
      listings.set(id, row);
      return { rows: [row] };
    }
    if (sql.includes('FROM public.listings l') && sql.includes('WHERE l.id = $1')) {
      const l = listings.get(params[0]);
      return { rows: l ? [{ ...l, category_name: 'Couture', category_slug: 'couture', category_active: true }] : [] };
    }

    // Inventory items queries
    if (sql.includes('INSERT INTO public.inventory_items')) {
      const id = 'b0000000-0000-4000-8000-' + String(inventory.size + 1).padStart(12, '0');
      const row = {
        id,
        listing_id: params[0],
        owner_type: params[1] || 'SELLER',
        owner_user_id: params[2] || SELLER_ID,
        serial_or_sku: params[3] || null,
        condition: params[4] || 'like_new',
        operational_status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      };
      inventory.set(id, row);
      return { rows: [row] };
    }
    if (sql.includes('FROM public.inventory_items ii WHERE ii.id = $1') || (sql.includes('FROM public.inventory_items') && sql.includes('WHERE id = $1'))) {
      const it = inventory.get(params[0]);
      return { rows: it ? [it] : [] };
    }
    if (sql.includes('FROM public.inventory_items ii WHERE ii.listing_id = $1')) {
      const list = [...inventory.values()].filter((item) => item.listing_id === params[0] && item.operational_status === 'AVAILABLE');
      return { rows: list };
    }

    // Available units calculation query (findAvailableUnitsForPeriod)
    if (sql.includes('operational_status = \'AVAILABLE\'') && sql.includes('NOT EXISTS')) {
      const listingId = params[0];
      const startReq = params[1];
      const endReq = params[2];

      const freeUnits = [...inventory.values()].filter((item) => {
        if (item.listing_id !== listingId || item.operational_status !== 'AVAILABLE') return false;

        // Check active bookings reserving this item
        for (const [bId, b] of bookings.entries()) {
          if (['pending', 'confirmed', 'active'].includes(b.status)) {
            // Check date overlap
            const overlap = !(b.end_date <= startReq || b.start_date >= endReq);
            if (overlap) {
              const itemsForBooking = [...bookingItems.values()].filter((bi) => bi.rental_booking_id === bId);
              if (itemsForBooking.some((bi) => bi.inventory_item_id === item.id)) {
                return false; // Reserved!
              }
            }
          }
        }
        return true;
      });

      return { rows: freeUnits.map((u) => ({ id: u.id })) };
    }

    // Rental Bookings queries
    if (sql.includes('INSERT INTO public.rental_bookings')) {
      const id = 'd0000000-0000-4000-8000-' + String(bookings.size + 1).padStart(12, '0');
      const row = {
        id,
        renter_user_id: params[0],
        rental_listing_id: params[1],
        status: params[2] || 'pending',
        start_date: params[3],
        end_date: params[4],
        subtotal_amount_paise: params[5],
        deposit_amount_paise: params[6],
        total_amount_paise: params[7],
        deposit_paid: params[8] || false,
        damage_waiver_selected: params[9] || false,
        damage_waiver_fee_paise: params[10] || 0,
        backup_size: params[11] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      bookings.set(id, row);
      return { rows: [row] };
    }

    if (sql.includes('INSERT INTO public.rental_booking_items')) {
      const id = 'e0000000-0000-4000-8000-' + String(bookingItems.size + 1).padStart(12, '0');
      const row = {
        id,
        rental_booking_id: params[0],
        inventory_item_id: params[1],
        item_status: params[2],
        start_date: params[3],
        end_date: params[4],
        daily_rate_paise: params[5],
        line_total_paise: params[6],
        is_backup_size: params[7] === true,
      };
      bookingItems.set(id, row);
      return { rows: [row] };
    }

    if (sql.includes('FROM public.rental_bookings rb') && sql.includes('WHERE rb.id = $1')) {
      const b = bookings.get(params[0]);
      if (!b) return { rows: [] };
      const l = listings.get(b.rental_listing_id);
      return {
        rows: [{
          ...b,
          depositPaise: b.deposit_amount_paise,
          depositAmountPaise: b.deposit_amount_paise,
          listing_title: l?.title,
          listing_owner_id: l?.owner_user_id,
          listing_owner_type: l?.owner_type,
        }],
      };
    }

    if (sql.includes('FROM public.rental_booking_items') && sql.includes('rental_booking_id = $1')) {
      const items = [...bookingItems.values()].filter((bi) => bi.rental_booking_id === params[0]);
      return { rows: items };
    }

    if (sql.includes('UPDATE public.rental_bookings')) {
      const b = bookings.get(params[0]);
      if (b) {
        b.status = params[2] || params[1] || 'cancelled';
        b.updated_at = new Date().toISOString();
        return { rows: [b], rowCount: 1 };
      }
    }

    if (sql.includes('UPDATE public.rental_booking_items')) {
      const bId = params[0];
      for (const bi of bookingItems.values()) {
        if (bi.rental_booking_id === bId) {
          bi.item_status = params[2] || 'cancelled';
        }
      }
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes('UPDATE public.inventory_items')) {
      const itemIds = Array.isArray(params[0]) ? params[0] : [params[0]];
      let newStatus = params[2] || 'RESERVED';
      if (sql.includes("SET operational_status = 'AVAILABLE'") || sql.includes("operational_status = 'AVAILABLE'")) {
        newStatus = 'AVAILABLE';
      }
      for (const id of itemIds) {
        const it = inventory.get(id);
        if (it) it.operational_status = newStatus;
      }
      return { rowCount: itemIds.length, rows: [] };
    }

    if (sql.includes('INSERT INTO public.audit_logs')) {
      return { rowCount: 1, rows: [{ id: 'audit-1' }] };
    }

    if (sql.includes('INSERT INTO public.rental_booking_status_history')) {
      return { rowCount: 1, rows: [{ id: 'hist-1' }] };
    }

    // Default fallback
    return { rows: [], rowCount: 0 };
  };

  test('Backup Size & Overlap Logic: 2 units, 1 booked with backupSize reserves both units, rejects overlap with 409', async () => {
    // 1. Create Category
    const catRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: 'Couture Column Gowns' },
    });
    assert.equal(catRes.status, 201);
    const categoryId = catRes.body.data.id;

    // 2. Create Listing (no media, no initialInventory -> 0 units created)
    const listingRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/listings',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: {
        title: 'Silk Velvet Column Gown',
        condition: 'like_new',
        categoryId,
        rentalPricePaise: 50000,
        depositPaise: 100000,
        isRental: true,
        isSale: false,
      },
    });
    assert.equal(listingRes.status, 201);
    const listingId = listingRes.body.data.id;

    // 3. Add TWO inventory units
    const unit1Res = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/inventory/items',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: { listingId, condition: 'like_new', barcode: 'BC-TEST-1' },
    });
    assert.equal(unit1Res.status, 201);

    const unit2Res = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/inventory/items',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: { listingId, condition: 'like_new', barcode: 'BC-TEST-2' },
    });
    assert.equal(unit2Res.status, 201);

    // 4. Initial availability: 2 units available
    const availRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/rentals/availability?listingId=${listingId}&startDate=2026-11-20&endDate=2026-11-23`,
    });
    assert.equal(availRes.status, 200);
    assert.equal(availRes.body.data.availableUnits, 2, 'Must report exactly 2 available units');

    // 5. Renter 1 books with backupSize = 'US 6'
    const bookingRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${renter1Token}` },
      body: {
        listingId,
        startDate: '2026-11-20',
        endDate: '2026-11-23',
        backupSize: 'US 6',
      },
    });
    if (bookingRes.status !== 201) console.log('bookingRes failed:', bookingRes.body);
    assert.equal(bookingRes.status, 201);
    const booking = bookingRes.body.data;
    assert.equal(booking.backupSize, 'US 6');
    assert.equal(booking.backupReserved, true, 'Backup reservation flag must be true');

    // Verify booking items detail
    const detailRes = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/rentals/bookings/${booking.id}`,
      headers: { authorization: `Bearer ${renter1Token}` },
    });
    assert.equal(detailRes.status, 200);
    const detail = detailRes.body.data;
    assert.equal(detail.items.length, 2, 'Booking must contain both primary and backup items');
    const primaryItem = detail.items.find((i) => !i.isBackupSize);
    const backupItem = detail.items.find((i) => i.isBackupSize);
    assert.ok(primaryItem, 'Primary item must exist');
    assert.ok(backupItem, 'Backup item must exist');
    assert.equal(primaryItem.lineTotalPaise, 150000);
    assert.equal(backupItem.lineTotalPaise, 0, 'Backup size item must be zero-rated');
    assert.equal(backupItem.dailyRatePaise, 0, 'Backup size item daily rate must be 0');

    // 6. Overlap check: all units are now reserved -> Renter 2 cannot book overlapping dates
    const overlapRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${renter2Token}` },
      body: {
        listingId,
        startDate: '2026-11-21',
        endDate: '2026-11-24',
      },
    });
    assert.equal(overlapRes.status, 409, 'Overlapping booking must return HTTP 409');
    assert.equal(overlapRes.body.error.code, 'DATES_NOT_AVAILABLE', 'Code must be DATES_NOT_AVAILABLE');

    // 7. Cancellation: Renter 1 cancels pending booking
    const cancelRes = await dispatch(app, {
      method: 'POST',
      url: `/api/v1/rentals/bookings/${booking.id}/cancel`,
      headers: { authorization: `Bearer ${renter1Token}` },
      body: { reason: 'Event rescheduled' },
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.data.status, 'cancelled');

    // 8. Availability restored: both units available again
    const availAfterCancel = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/rentals/availability?listingId=${listingId}&startDate=2026-11-20&endDate=2026-11-23`,
    });
    assert.equal(availAfterCancel.status, 200);
    assert.equal(availAfterCancel.body.data.availableUnits, 2, 'Both units must be restored after cancellation');

    // 9. Renter 2 can now successfully book
    const renter2Booking = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${renter2Token}` },
      body: {
        listingId,
        startDate: '2026-11-20',
        endDate: '2026-11-23',
      },
    });
    assert.equal(renter2Booking.status, 201);
    assert.equal(renter2Booking.body.data.status, 'pending');
  });

  test('Single Unit & Overlap Logic (from e2e-smoke): availability sees 1 unit, overlap receives 409', async () => {
    // 1. Create Listing for Single Unit
    const listingRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/listings',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: {
        title: 'Single Unit Banarasi Saree',
        condition: 'like_new',
        categoryId: 'c0000000-0000-4000-8000-000000000001',
        rentalPricePaise: 50000,
        depositPaise: 100000,
        salePricePaise: 250000,
        isRental: true,
        isSale: true,
      },
    });
    assert.equal(listingRes.status, 201);
    const listingId = listingRes.body.data.id;

    // Self booking rejected
    const selfBook = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: { listingId, startDate: '2026-11-10', endDate: '2026-11-12' },
    });
    if (selfBook.status !== 409) console.log('selfBook failed:', selfBook.body);
    assert.equal(selfBook.status, 409);

    // Add exactly 1 inventory unit
    const unitRes = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/inventory/items',
      headers: { authorization: `Bearer ${sellerToken}` },
      body: { listingId, condition: 'good' },
    });
    assert.equal(unitRes.status, 201);
    assert.equal(unitRes.body.data.operationalStatus, 'AVAILABLE');

    // Availability sees 1 unit
    const avail = await dispatch(app, {
      method: 'GET',
      url: `/api/v1/rentals/availability?listingId=${listingId}&startDate=2026-11-10&endDate=2026-11-12`,
    });
    assert.equal(avail.status, 200);
    assert.equal(avail.body.data.availableUnits, 1, 'Availability must report exactly 1 unit');

    // Renter 1 books the 1 unit
    const booking = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${renter1Token}` },
      body: { listingId, startDate: '2026-11-10', endDate: '2026-11-12' },
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.body.data.subtotalAmountPaise, 100000);
    assert.equal(booking.body.data.totalAmountPaise, 200000);

    // Overlapping booking rejected with 409
    const overlap = await dispatch(app, {
      method: 'POST',
      url: '/api/v1/rentals/bookings',
      headers: { authorization: `Bearer ${renter2Token}` },
      body: { listingId, startDate: '2026-11-11', endDate: '2026-11-13' },
    });
    assert.equal(overlap.status, 409, 'Overlapping booking must be rejected with 409');
    assert.ok(
      ['RENTAL_OVERLAP', 'DATES_NOT_AVAILABLE'].includes(overlap.body?.error?.code),
      `Expected error code to be RENTAL_OVERLAP or DATES_NOT_AVAILABLE, got ${overlap.body?.error?.code}`
    );
  });
});
