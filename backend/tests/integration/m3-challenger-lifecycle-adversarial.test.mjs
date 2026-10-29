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
import { disputesRouter, disputesAdminRouter } from '../../src/modules/disputes/disputes.routes.js';
import { kycRouter, kycAdminRouter } from '../../src/modules/kyc/kyc.routes.js';
import { adminRouter } from '../../src/modules/admin/admin.routes.js';

const app = express();
app.use(express.json());
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/categories', categoryAdminRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/listings', listingOwnerRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/rentals', rentalActionRouter);
app.use('/api/v1/disputes', disputesRouter);
app.use('/api/v1/admin/disputes', disputesAdminRouter);
app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/admin/kyc', kycAdminRouter);
app.use('/api/v1/admin', adminRouter);

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

describe('Milestone 3 Challenger 1: Adversarial Lifecycle & Stress Suite', () => {
  const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
  const SELLER_ID = '20000000-0000-4000-8000-000000000002';
  const RENTER1_ID = '30000000-0000-4000-8000-000000000003';
  const RENTER2_ID = '40000000-0000-4000-8000-000000000004';
  const STRANGER_ID = '50000000-0000-4000-8000-000000000005';

  const adminToken = signAccessToken({ sub: ADMIN_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const sellerToken = signAccessToken({ sub: SELLER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const renter1Token = signAccessToken({ sub: RENTER1_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const renter2Token = signAccessToken({ sub: RENTER2_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });
  const strangerToken = signAccessToken({ sub: STRANGER_ID }, { secret: env.auth.jwtSecret, ttlSeconds: 900 });

  const users = new Map([
    [ADMIN_ID, { id: ADMIN_ID, email: 'admin@exchange.test', status: 'active', roles: ['customer', 'admin'] }],
    [SELLER_ID, { id: SELLER_ID, email: 'seller@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [RENTER1_ID, { id: RENTER1_ID, email: 'renter1@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [RENTER2_ID, { id: RENTER2_ID, email: 'renter2@exchange.test', status: 'active', roles: ['customer', 'seller'] }],
    [STRANGER_ID, { id: STRANGER_ID, email: 'stranger@exchange.test', status: 'active', roles: ['customer'] }],
  ]);

  const categories = new Map();
  const listings = new Map();
  const inventory = new Map();
  const bookings = new Map();
  const bookingItems = new Map();
  const disputes = new Map();
  const kycAttempts = new Map();
  const auditLogs = [];

  // Seed initial Category
  const CAT_ID = 'c0000000-0000-4000-8000-000000000001';
  categories.set(CAT_ID, {
    id: CAT_ID,
    name: 'Sarees',
    slug: 'sarees',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
  });

  pool.connect = async () => ({
    query: pool.query,
    release: () => {},
  });

  pool.query = async (sql, params = []) => {
    // Transaction controls
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rowCount: 1, rows: [] };
    }

    // Users
    if (sql.includes('FROM public.users u') && sql.includes('WHERE u.id = $1')) {
      const u = users.get(params[0]);
      return { rows: u ? [u] : [] };
    }

    // Settings
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

    // Categories
    if (sql.includes('INSERT INTO public.categories')) {
      const id = 'c0000000-0000-4000-8000-' + String(categories.size + 1).padStart(12, '0');
      const row = { id, name: params[0], slug: params[1] || 'sarees', is_active: true, display_order: 1, created_at: new Date().toISOString() };
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

    // Listings
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
      return { rows: l ? [{ ...l, category_name: 'Sarees', category_slug: 'sarees', category_active: true }] : [] };
    }
    if (sql.includes('INSERT INTO public.listing_images')) {
      return { rowCount: 1, rows: [{ id: 'img-1' }] };
    }

    // Inventory items
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

    // Available units query (findAvailableUnitsForPeriod)
    if (sql.includes('operational_status = \'AVAILABLE\'') && sql.includes('NOT EXISTS')) {
      const listingId = params[0];
      const startReq = params[1];
      const endReq = params[2];

      const freeUnits = [...inventory.values()].filter((item) => {
        if (item.listing_id !== listingId || item.operational_status !== 'AVAILABLE') return false;

        for (const [bId, b] of bookings.entries()) {
          if (['pending', 'confirmed', 'active'].includes(b.status)) {
            // Overlap condition: rbi.start_date < endReq AND rbi.end_date > startReq
            const overlap = b.start_date < endReq && b.end_date > startReq;
            if (overlap) {
              const itemsForBooking = [...bookingItems.values()].filter((bi) => bi.rental_booking_id === bId);
              if (itemsForBooking.some((bi) => bi.inventory_item_id === item.id)) {
                return false;
              }
            }
          }
        }
        return true;
      });

      return { rows: freeUnits.map((u) => ({ id: u.id })) };
    }

    // Bookings
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
      const bId = params[0];
      const b = bookings.get(bId);
      if (b) {
        const targetStatus = params[2] || params[1] || 'cancelled';
        b.status = targetStatus;
        b.updated_at = new Date().toISOString();
        return { rows: [b], rowCount: 1 };
      }
    }

    if (sql.includes('UPDATE public.rental_booking_items')) {
      const bId = params[0];
      const targetStatus = params[2] || params[1] || 'cancelled';
      for (const bi of bookingItems.values()) {
        if (bi.rental_booking_id === bId) {
          bi.item_status = targetStatus;
        }
      }
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes('UPDATE public.inventory_items')) {
      const itemIds = Array.isArray(params[0]) ? params[0] : [params[0]];
      let newStatus = params[2] || 'RESERVED';
      if (sql.includes("SET operational_status = 'AVAILABLE'") || sql.includes("operational_status = 'AVAILABLE'")) {
        newStatus = 'AVAILABLE';
      } else if (sql.includes("SET operational_status = 'RENTED'") || sql.includes("operational_status = 'RENTED'")) {
        newStatus = 'RENTED';
      }
      for (const id of itemIds) {
        const it = inventory.get(id);
        if (it) it.operational_status = newStatus;
      }
      return { rowCount: itemIds.length, rows: [] };
    }

    if (sql.includes('INSERT INTO public.rental_booking_status_history')) {
      return { rowCount: 1, rows: [{ id: 'hist-1' }] };
    }

    if (sql.includes('INSERT INTO public.rental_return_inspections')) {
      return { rowCount: 1, rows: [{ id: 'insp-1' }] };
    }

    // Disputes
    if (sql.includes('INSERT INTO public.disputes')) {
      const id = 'f0000000-0000-4000-8000-' + String(disputes.size + 1).padStart(12, '0');
      const row = {
        id,
        opened_by_user_id: params[0],
        against_user_id: params[1],
        rental_booking_id: params[2] || null,
        order_id: params[3] || null,
        dispute_type: params[4],
        status: 'open',
        description: params[5],
        evidence_urls: params[6] || [],
        resolution: null,
        resolved_by_user_id: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
      };
      disputes.set(id, row);
      return { rows: [row] };
    }
    if (sql.includes('FROM public.disputes d') && sql.includes('WHERE d.id = $1')) {
      const d = disputes.get(params[0]);
      return { rows: d ? [d] : [] };
    }
    if (sql.includes('UPDATE public.disputes')) {
      const d = disputes.get(params[0]);
      if (d) {
        if (d.status !== 'open') return { rows: [], rowCount: 0 };
        d.status = params[1];
        d.resolution = params[2];
        d.resolved_by_user_id = params[3];
        d.resolved_at = new Date().toISOString();
        return { rows: [d], rowCount: 1 };
      }
    }
    if (sql.includes('FROM public.disputes d') && sql.includes('ORDER BY d.created_at DESC')) {
      return { rows: [...disputes.values()] };
    }
    if (sql.includes('SELECT count(*)::int AS total FROM public.disputes')) {
      return { rows: [{ total: disputes.size }] };
    }

    // KYC
    if (sql.includes('SELECT COALESCE(max(attempt_number), 0)::int AS latest')) {
      return { rows: [{ latest: 0 }] };
    }
    if (sql.includes('INSERT INTO public.kyc_verifications')) {
      const id = '90000000-0000-4000-8000-' + String(kycAttempts.size + 1).padStart(12, '0');
      const row = {
        id,
        user_id: params[0],
        attempt_number: 1,
        verification_type: params[1],
        provider: params[2] || null,
        provider_reference: params[3] || null,
        document_url: params[4] || null,
        status: 'pending',
        rejection_reason: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      };
      kycAttempts.set(id, row);
      return { rows: [row] };
    }
    if (sql.includes('FROM public.kyc_verifications') && (sql.includes('WHERE k.id = $1') || sql.includes('WHERE kv.id = $1') || sql.includes('WHERE id = $1'))) {
      const k = kycAttempts.get(params[0]);
      return { rows: k ? [k] : [] };
    }
    if (sql.includes('UPDATE public.kyc_verifications')) {
      const k = kycAttempts.get(params[0]);
      if (k) {
        if (k.status !== 'pending') return { rows: [], rowCount: 0 };
        k.status = params[2] || params[1];
        k.reviewed_by_user_id = params[3] || params[2];
        k.rejection_reason = params[4] || null;
        k.reviewed_at = new Date().toISOString();
        return { rows: [k], rowCount: 1 };
      }
    }
    if (sql.includes('FROM public.kyc_verifications') && sql.includes('ORDER BY')) {
      return { rows: [...kycAttempts.values()] };
    }
    if (sql.includes('SELECT count(*)::int AS total FROM public.kyc_verifications')) {
      return { rows: [{ total: kycAttempts.size }] };
    }

    // Audit logs
    if (sql.includes('INSERT INTO public.audit_logs')) {
      const auditEntry = {
        id: 'aud-' + String(auditLogs.length + 1),
        user_id: params[0] || null,
        action: params[1],
        entity_type: params[2],
        entity_id: params[3] || null,
        previous_value: params[4] || null,
        new_value: params[5] || null,
        ip_address: params[6] || null,
        created_at: new Date().toISOString(),
      };
      auditLogs.push(auditEntry);
      return { rowCount: 1, rows: [auditEntry] };
    }
    if (sql.includes('FROM public.audit_logs a') && sql.includes('ORDER BY a.created_at DESC')) {
      let filtered = [...auditLogs];
      if (sql.includes('entity_type = $1')) {
        filtered = filtered.filter((a) => a.entity_type === params[0]);
      }
      return { rows: filtered };
    }
    if (sql.includes('SELECT count(*)::int AS total FROM public.audit_logs a')) {
      let filtered = [...auditLogs];
      if (sql.includes('entity_type = $1')) {
        filtered = filtered.filter((a) => a.entity_type === params[0]);
      }
      return { rows: [{ total: filtered.length }] };
    }

    // Payments / Refunds stubs
    if (sql.includes('FROM public.payments')) {
      return { rows: [] };
    }
    if (sql.includes('FROM public.refunds')) {
      return { rows: [] };
    }

    // Default fallback
    return { rows: [], rowCount: 0 };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. RENTAL LIFECYCLE & OVERLAP STRESS TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Rental Lifecycle & Overlap Stress Testing', () => {
    test('1.1: Listing creation inventory guard: 0 units without media, 1 unit with media, 1 unit with initialInventory', async () => {
      // A: Create listing without media and without initialInventory -> exactly 0 inventory units
      const resA = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Guard Test A - No Media',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 40000,
          depositPaise: 80000,
          isRental: true,
          isSale: false,
        },
      });
      assert.equal(resA.status, 201);
      const listingAId = resA.body.data.id;
      const unitsA = [...inventory.values()].filter((i) => i.listing_id === listingAId);
      assert.equal(unitsA.length, 0, 'Must create 0 units when media and initialInventory are omitted');

      // B: Create listing WITH media -> creates 1 unit
      const resB = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Guard Test B - With Media',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 40000,
          depositPaise: 80000,
          isRental: true,
          isSale: false,
          media: [{ url: 'https://cdn.exchange.test/garment.png' }],
        },
      });
      assert.equal(resB.status, 201);
      const listingBId = resB.body.data.id;
      const unitsB = [...inventory.values()].filter((i) => i.listing_id === listingBId);
      assert.equal(unitsB.length, 1, 'Must create 1 unit when media array is populated');

      // C: Create listing with initialInventory: true -> creates 1 unit
      const resC = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Guard Test C - Explicit initialInventory',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 40000,
          depositPaise: 80000,
          isRental: true,
          isSale: false,
          initialInventory: true,
        },
      });
      assert.equal(resC.status, 201);
      const listingCId = resC.body.data.id;
      const unitsC = [...inventory.values()].filter((i) => i.listing_id === listingCId);
      assert.equal(unitsC.length, 1, 'Must create 1 unit when initialInventory is true');
    });

    test('1.2: Backup size pairing with 1 available unit does NOT fail booking but reports backupReserved: false', async () => {
      // Create listing with 0 units
      const listingRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Single Unit Backup Size Test',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
        },
      });
      assert.equal(listingRes.status, 201);
      const listingId = listingRes.body.data.id;

      // Add only 1 unit
      const unitRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/inventory/items',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: { listingId, condition: 'like_new' },
      });
      assert.equal(unitRes.status, 201);

      // Book with backup size when only 1 unit exists
      const bookRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: {
          listingId,
          startDate: '2026-11-20',
          endDate: '2026-11-23',
          backupSize: 'US 8',
        },
      });
      assert.equal(bookRes.status, 201, 'Booking should succeed even if backup unit is unavailable');
      assert.equal(bookRes.body.data.backupSize, 'US 8');
      assert.equal(bookRes.body.data.backupReserved, false, 'backupReserved must be false when spare unit is unavailable');
    });

    test('1.3: Overlap rejection stress across interval boundary conditions (exact, partial, enclosing, and post-cancellation restoration)', async () => {
      // Setup a fresh listing with 1 unit
      const listingRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Overlap Matrix Testing',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
        },
      });
      const listingId = listingRes.body.data.id;

      await dispatch(app, {
        method: 'POST',
        url: '/api/v1/inventory/items',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: { listingId, condition: 'like_new' },
      });

      // Primary booking: 2026-11-10 to 2026-11-15 (5 days)
      const primaryRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { listingId, startDate: '2026-11-10', endDate: '2026-11-15' },
      });
      assert.equal(primaryRes.status, 201);
      const primaryBookingId = primaryRes.body.data.id;

      // Scenario A: Exact overlap (10 to 15) -> 409
      const exactOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-10', endDate: '2026-11-15' },
      });
      assert.equal(exactOverlap.status, 409, 'Exact overlap must return 409');
      assert.equal(exactOverlap.body.error.code, 'DATES_NOT_AVAILABLE');

      // Scenario B: Partial start overlap (08 to 12) -> 409
      const startOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-08', endDate: '2026-11-12' },
      });
      assert.equal(startOverlap.status, 409, 'Partial start overlap must return 409');

      // Scenario C: Partial end overlap (13 to 18) -> 409
      const endOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-13', endDate: '2026-11-18' },
      });
      assert.equal(endOverlap.status, 409, 'Partial end overlap must return 409');

      // Scenario D: Enclosed inside (11 to 14) -> 409
      const enclosedOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-11', endDate: '2026-11-14' },
      });
      assert.equal(enclosedOverlap.status, 409, 'Enclosed overlap must return 409');

      // Scenario E: Encompassing outer (08 to 18) -> 409
      const encompassingOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-08', endDate: '2026-11-18' },
      });
      assert.equal(encompassingOverlap.status, 409, 'Encompassing overlap must return 409');

      // Cancellation restores availability: Renter 1 cancels primary booking
      const cancelRes = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${primaryBookingId}/cancel`,
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { reason: 'Schedule changed' },
      });
      assert.equal(cancelRes.status, 200);

      // Now the previously rejected exact dates (10 to 15) must succeed
      const retryOverlap = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter2Token}` },
        body: { listingId, startDate: '2026-11-10', endDate: '2026-11-15' },
      });
      assert.equal(retryOverlap.status, 201, 'Exact dates succeed immediately after cancellation');
    });

    test('1.4: Self-booking rejection returns HTTP 409 SELF_BOOKING_NOT_ALLOWED', async () => {
      const listingRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Owner Self Booking Test',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
          initialInventory: true,
        },
      });
      const listingId = listingRes.body.data.id;

      const selfBook = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: { listingId, startDate: '2026-11-10', endDate: '2026-11-12' },
      });
      assert.equal(selfBook.status, 409);
      assert.equal(selfBook.body.error.code, 'SELF_BOOKING_NOT_ALLOWED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PROVIDER & ADMIN LIFECYCLE STRESS TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Provider & Admin Lifecycle Stress Testing', () => {
    test('2.1: Provider accept authorization and state transitions', async () => {
      // Create fresh listing and unit
      const lRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Provider Accept Gown',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
          initialInventory: true,
        },
      });
      const listingId = lRes.body.data.id;

      // Create pending booking
      const bRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { listingId, startDate: '2026-12-01', endDate: '2026-12-04' },
      });
      assert.equal(bRes.status, 201);
      const bookingId = bRes.body.data.id;

      // Renter cannot accept -> 403
      const renterAccept = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${renter1Token}` },
      });
      assert.equal(renterAccept.status, 403, 'Renter must be forbidden from accepting booking');

      // Stranger cannot accept -> 403
      const strangerAccept = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${strangerToken}` },
      });
      assert.equal(strangerAccept.status, 403, 'Stranger must be forbidden from accepting booking');

      // Provider accepts -> 200, status confirmed
      const providerAccept = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(providerAccept.status, 200);
      assert.equal(providerAccept.body.data.status, 'confirmed');

      // Double accept -> 409
      const doubleAccept = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(doubleAccept.status, 409, 'Accepting an already confirmed booking must return 409');
    });

    test('2.2: Provider reject pending booking returns HTTP 200 and cancels booking', async () => {
      // Create fresh listing and unit
      const lRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Provider Reject Bug Gown',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
          initialInventory: true,
        },
      });
      const listingId = lRes.body.data.id;

      // Create pending booking
      const bRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { listingId, startDate: '2026-12-10', endDate: '2026-12-12' },
      });
      assert.equal(bRes.status, 201);
      const bookingId = bRes.body.data.id;
      const unit = [...inventory.values()].find((i) => i.listing_id === listingId);
      assert.equal(unit.operational_status, 'RESERVED', 'Unit operational status moves to RESERVED on booking');

      // Renter cannot reject booking -> 403 FORBIDDEN
      const renterReject = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/reject`,
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { reason: 'Renter cannot decline' },
      });
      assert.equal(renterReject.status, 403, 'Renter must be forbidden from rejecting booking');
      assert.equal(renterReject.body.error.code, 'FORBIDDEN');

      // Provider rejects pending booking -> 200 OK
      const rejectRes = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/reject`,
        headers: { authorization: `Bearer ${sellerToken}` },
        body: { reason: 'Garment undergoing maintenance' },
      });

      assert.equal(rejectRes.status, 200, 'Provider reject must succeed with HTTP 200');
      assert.equal(rejectRes.body.data.status, 'cancelled');

      // Verify booking status transitioned in store
      const b = bookings.get(bookingId);
      assert.equal(b.status, 'cancelled');
      assert.equal(unit.operational_status, 'AVAILABLE', 'Unit operational status restored to AVAILABLE after cancellation');

      // Double reject -> 409 BOOKING_REJECT_NOT_ALLOWED
      const doubleReject = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/reject`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(doubleReject.status, 409, 'Rejecting an already cancelled booking returns 409');
      assert.equal(doubleReject.body.error.code, 'BOOKING_REJECT_NOT_ALLOWED');
    });

    test('2.3: Provider start authorization: renter receives 403, provider starts rental to active', async () => {
      // Create fresh listing and unit
      const lRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          title: 'Provider Start Bug Gown',
          condition: 'like_new',
          categoryId: CAT_ID,
          rentalPricePaise: 50000,
          depositPaise: 100000,
          isRental: true,
          isSale: false,
          initialInventory: true,
        },
      });
      const listingId = lRes.body.data.id;
      const unit = [...inventory.values()].find((i) => i.listing_id === listingId);

      // Create booking
      const bRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/rentals/bookings',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { listingId, startDate: '2026-12-20', endDate: '2026-12-25' },
      });
      assert.equal(bRes.status, 201);
      const bookingId = bRes.body.data.id;

      // Provider accepts booking
      await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/accept`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });

      // Stranger attempts to start rental -> 403 FORBIDDEN
      const strangerStart = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/start`,
        headers: { authorization: `Bearer ${strangerToken}` },
      });
      assert.equal(strangerStart.status, 403, 'Stranger cannot start rental');
      assert.equal(strangerStart.body.error.code, 'FORBIDDEN');

      // RENTER attempts to start rental -> 403 FORBIDDEN
      const renterStart = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/start`,
        headers: { authorization: `Bearer ${renter1Token}` },
      });
      assert.equal(renterStart.status, 403, 'Renter must be forbidden from starting rental');
      assert.equal(renterStart.body.error.code, 'FORBIDDEN');
      assert.equal(bookings.get(bookingId).status, 'confirmed', 'Booking must remain in confirmed state');
      assert.notEqual(unit.operational_status, 'RENTED', 'Unit operational status must not be moved to RENTED by renter');

      // PROVIDER starts rental -> 200 OK
      const providerStart = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/start`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(providerStart.status, 200, 'Provider start succeeds with 200');
      assert.equal(providerStart.body.data.status, 'active');
      assert.equal(unit.operational_status, 'RENTED');

      // Provider completes return with inspection
      const completeRes = await dispatch(app, {
        method: 'POST',
        url: `/api/v1/rentals/bookings/${bookingId}/return`,
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          inspection: {
            result: 'pass',
            notes: 'Returned in pristine condition',
          },
        },
      });
      assert.equal(completeRes.status, 200);
      assert.equal(completeRes.body.data.status, 'completed');
      assert.equal(unit.operational_status, 'AVAILABLE');
    });

    test('2.4: Dispute arbitration with { outcome, resolution } and role enforcement', async () => {
      // 1. Participant opens a dispute for rental booking
      const dispRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: {
          rentalBookingId: 'd0000000-0000-4000-8000-000000000001',
          disputeType: 'quality_issue',
          description: 'Hem stitching was frayed upon delivery.',
        },
      });
      assert.equal(dispRes.status, 201);
      const disputeId = dispRes.body.data.id;
      assert.equal(dispRes.body.data.status, 'open');

      // 2. Mutual exclusivity check: supplying both rentalBookingId and orderId -> 400
      const dualRef = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${renter1Token}` },
        body: {
          rentalBookingId: 'd0000000-0000-4000-8000-000000000001',
          orderId: '00000000-0000-4000-8000-000000000099',
          disputeType: 'quality_issue',
          description: 'Dual reference dispute error test.',
        },
      });
      assert.equal(dualRef.status, 400);

      // 3. Non-admin cannot resolve dispute -> 403
      const unauthorizedResolve = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${sellerToken}` },
        body: { outcome: 'resolve', resolution: 'Unauthorized resolution attempt' },
      });
      assert.equal(unauthorizedResolve.status, 403);

      // 4. Admin resolves with invalid outcome -> 400
      const invalidOutcome = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { outcome: 'arbitrated', resolution: 'Invalid outcome verb' },
      });
      assert.equal(invalidOutcome.status, 400);

      // 5. Admin resolves with short resolution (<5 chars) -> 400
      const shortResolution = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { outcome: 'resolve', resolution: 'Fine' },
      });
      assert.equal(shortResolution.status, 400);

      // 6. Admin resolves successfully with outcome: 'resolve'
      const resolveRes = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          outcome: 'resolve',
          resolution: 'Dry cleaning fee refunded to renter.',
        },
      });
      assert.equal(resolveRes.status, 200);
      assert.equal(resolveRes.body.data.status, 'resolved');
      assert.equal(resolveRes.body.data.resolution, 'Dry cleaning fee refunded to renter.');

      // 7. Double resolution attempt -> 409
      const doubleResolve = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { outcome: 'reject', resolution: 'Re-evaluating dispute' },
      });
      assert.equal(doubleResolve.status, 409);
      assert.equal(doubleResolve.body.error.code, 'DISPUTE_STATE_CONFLICT');
    });

    test('2.5: KYC approval workflow enforcing "verified" status and rejecting "approved"', async () => {
      // 1. Seller creates KYC verification attempt (type in: aadhaar, pan, passport, driver_license)
      const kycRes = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/kyc',
        headers: { authorization: `Bearer ${sellerToken}` },
        body: {
          verificationType: 'passport',
          provider: 'UIDAI',
          providerReference: 'PASS-REF-12345',
          documentUrl: 'https://docs.exchange.test/kyc/doc.pdf',
        },
      });
      assert.equal(kycRes.status, 201);
      const kycId = kycRes.body.data.id;

      // 2. Non-admin cannot review KYC -> 403
      const unauthorizedKyc = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/kyc/${kycId}`,
        headers: { authorization: `Bearer ${renter1Token}` },
        body: { status: 'verified' },
      });
      assert.equal(unauthorizedKyc.status, 403);

      // 3. Admin review with status "approved" is rejected with 400 (strict enum: verified | rejected)
      const invalidStatus = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/kyc/${kycId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { status: 'approved' },
      });
      assert.equal(invalidStatus.status, 400, 'Must reject "approved" and mandate "verified"');

      // 4. Admin review with status "rejected" without rejectionReason -> 400
      const missingReason = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/kyc/${kycId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { status: 'rejected' },
      });
      assert.equal(missingReason.status, 400, 'Rejection requires reason');

      // 5. Admin approves with status "verified" -> 200
      const approveRes = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/kyc/${kycId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { status: 'verified' },
      });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'verified');

      // 6. Double review attempt -> 409
      const doubleKyc = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/admin/kyc/${kycId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { status: 'verified' },
      });
      assert.equal(doubleKyc.status, 409);
      assert.equal(doubleKyc.body.error.code, 'KYC_ALREADY_REVIEWED');
    });

    test('2.6: Admin audit logs retrieval and lifecycle traceability', async () => {
      // 1. Non-admin calling GET /admin/audit-logs -> 403
      const nonAdminAudit = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(nonAdminAudit.status, 403);

      // 2. Admin calling GET /admin/audit-logs -> 200 with meta pagination
      const adminAudit = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminAudit.status, 200);
      assert.ok(Array.isArray(adminAudit.body.data));
      assert.ok(adminAudit.body.meta?.page !== undefined);

      // 3. Verify audit actions captured throughout the test suite
      const actions = auditLogs.map((a) => a.action);
      assert.ok(actions.includes('LISTING_CREATED'), 'Audit log must record LISTING_CREATED');
      assert.ok(actions.includes('RENTAL_BOOKING_CREATED'), 'Audit log must record RENTAL_BOOKING_CREATED');
      assert.ok(actions.includes('RENTAL_BOOKING_CANCELLED'), 'Audit log must record RENTAL_BOOKING_CANCELLED');
      assert.ok(actions.includes('RENTAL_BOOKING_ACCEPTED'), 'Audit log must record RENTAL_BOOKING_ACCEPTED');
      assert.ok(actions.includes('DISPUTE_RESOLVED'), 'Audit log must record DISPUTE_RESOLVED');
      assert.ok(actions.includes('KYC_REVIEWED'), 'Audit log must record KYC_REVIEWED');
    });
  });
});
