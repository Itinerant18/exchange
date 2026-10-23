# Exchange24 — Complete Project History & Status Report

Generated: 2026-10-23
Branch: `feature/phase2-completion` (baseline commit `beeffa4`, phase-2 commit `35efe6f`)

This document consolidates everything accomplished across the original backend
build (prior agent) and the Phase 2 completion pass (this agent), including
schema, code locations, endpoints, tests, and remaining decisions.

---

## 1. Project Overview

- **Backend:** Node.js 24, Express 5, ES modules, raw SQL via `pg` (no ORM).
- **Database:** PostgreSQL 17. App role `exchnage_app` (CREATEDB). Dev DB
  `exchnage_dev`. Test DBs `exchnage_test_<slug>` (force-dropped + re-migrated).
- **Frontend:** React 19 + Vite 8 (foundation preserved; not rebuilt).
- **Auth:** JWT access tokens, rotating hashed refresh tokens (scrypt), RBAC.
- **API prefix:** `/api/v1`.
- **Money:** integer paise `BIGINT`. Timestamps `TIMESTAMPTZ` UTC. UUID PKs.
  Rental periods are half-open `[start, end)`.

## 2. Repository Layout

```
exchange/
├── backend/
│   ├── database/
│   │   ├── migrate.js
│   │   ├── migrations/          # 001..009 (immutable, checksum-guarded)
│   │   ├── factories/grant-admin.js
│   │   └── seeds/               # (dev seed, optional)
│   ├── scripts/e2e-smoke.mjs    # 51-check lifecycle smoke
│   ├── src/
│   │   ├── app.js               # middleware wiring
│   │   ├── server.js
│   │   ├── config/              # env, database (type parsers), cors, platform
│   │   ├── middleware/          # authenticate, errorHandler, notFound, requestId,
│   │   │                        # securityHeaders, rateLimit
│   │   ├── routes/index.js      # mount table
│   │   ├── modules/             # auth, users, categories, listings, inventory,
│   │   │                        # rentals, orders, payments, deposits, refunds,
│   │   │                        # reviews, kyc, admin, settings, delivery,
│   │   │                        # ledger, disputes
│   │   ├── services/            # auditLogService, ...
│   │   └── utils/               # http, validators, pgErrorMapper, passwordCrypto,
│   │                            # refreshTokens, cookies
│   └── tests/
│       ├── helpers/test-db.js
│       └── integration/         # errors, auth, users, categories, health
├── frontend/                    # React 19 + Vite 8
├── docs/
│   ├── project-status.md
│   ├── architecture.md
│   ├── api-conventions.md
│   └── database-design.md
└── README.md
```

## 3. Database Schema (migrations 001–009)

### 3.1 Core tables

- `users` (id UUID PK, email, password_hash, is_active, created_at, updated_at)
- `user_roles` (user_id, role_name) — PK (user_id, role_name)
- `user_profiles` (user_id PK FK, display_name, phone_number, …)
- `user_addresses` (id, user_id, …, is_default)
- `refresh_tokens` (id, user_id, token_hash, expires_at, revoked_at, …)
- `password_reset_tokens` (id, user_id, token_hash, expires_at, used_at) — 008
- `categories` (id, parent_id, name, slug, is_active, …)
- `listings` (id, owner_type, owner_user_id, title, description, condition,
  is_rental, is_sale, rental_price_paise, sale_price_paise, deposit_paise,
  listing_status, city, delivery_available, delivery_radius_km) — 008 adds location
- `listing_images` (id, listing_id, object_key, is_primary, …)
- `inventory_items` (id, listing_id, operational_status AVAILABLE/RESERVED/RENTED/SOLD/…)
- `rental_bookings` (id, renter_user_id, rental_listing_id, status, start_date,
  end_date, subtotal_amount_paise, deposit_amount_paise, total_amount_paise,
  deposit_paid, actual_return_date, transport_mode, outbound_distance_km,
  return_distance_km, transport_rate_paise_per_km, outbound_transport_amount_paise,
  return_transport_amount_paise, overdue_days, late_fee_amount_paise, …) — 008 adds
  transport + late-fee columns
- `rental_booking_items` (id, rental_booking_id, inventory_item_id, item_status,
  start_date, end_date, daily_rate_paise, line_total_paise)
- `rental_booking_status_history` (id, rental_booking_id, from_status, to_status,
  changed_by_user_id, reason, created_at)
- `booking_extensions` (id, rental_booking_id, requested_by_type, new_end_date,
  additional_days, additional_amount_paise, status, decided_by, decided_at,
  rejection_reason) — 008
- `return_inspections` (id, rental_booking_id UNIQUE, inspected_by_user_id,
  result pass/damage/missing, notes, evidence_urls, estimated_recovery_paise) — 008
- `security_deposits` (id, rental_booking_id UNIQUE, status held/releasing/
  released/withheld/disputed, collected_amount_paise, deduction_amount_paise,
  deduction_reason, …)
- `orders` (id, buyer_user_id, status, total_amount_paise, …)
- `order_items` (id, order_id, inventory_item_id, listing_id, unit_price_paise, status)
- `payments` (id, rental_booking_id, order_id, payment_type rental/sale/deposit/
  refund/transport/late_fee/damage_charge, direction in/out, amount_paise,
  status pending/succeeded/failed/cancelled, provider, provider_transaction_id,
  idempotency_key, created_by, …)
- `payment_events` (id, payment_id, event_type, provider_event_id, amount_paise,
  payload, occurred_at)
- `refunds` (id, payment_id, refund_amount_paise, reason, status, processed_at, …)
- `reviews` (id, reviewer_user_id, target_type, target_id, rating, body, status, …)
- `kyc_verifications` (id, user_id, status, document_type, …)
- `audit_logs` (id, user_id, action, entity_type, entity_id, previous_value,
  new_value, ip_address, user_agent, created_at) — append-only
- `platform_settings` (key PK, value JSONB, category, description, is_approved,
  updated_by, created_at, updated_at) — 008
- `disputes` (id, rental_booking_id XOR order_id, opened_by_user_id,
  against_user_id, dispute_type, description, evidence_urls, status, resolution,
  resolved_by, resolved_at) — 008
- `earnings_ledger` (id, user_id, entry_direction credit/debit, entry_type,
  rental_booking_id, order_id, source_type, source_id, amount_paise,
  idempotency_key, memo, created_at) — 008
- `metrics_events` (id, event_type, listing_id, owner_user_id, viewer_user_id,
  viewer_session_key, hour_bucket, occurred_at) — 008

### 3.2 Key constraints

- GiST exclusion on `rental_booking_items` prevents overlapping date ranges
  for the same inventory item.
- `payments_type_allowed` CHECK extended in 007 (commission/payout/refund may
  reference booking OR order) and in 008 (transport/late_fee/damage_charge).
- Partial unique indexes: idempotency keys, ledger source-type dedupe,
  metrics dedupe by (type, target, session, hour).
- Financial/audit FKs use `ON DELETE RESTRICT`.

## 4. Backend Modules & Code Locations

| Module | Path | Notes |
|---|---|---|
| Auth | `src/modules/auth/` | register, login, refresh (rotation + reuse detection), logout, me, forgot-password, reset-password |
| Users | `src/modules/users/` | profile, addresses (default demotion) |
| Categories | `src/modules/categories/` | public tree/detail + admin CRUD (public-first mount) |
| Listings | `src/modules/listings/` | CRUD, images (primary demotion), visibility, retire-with-claim-guard, location fields |
| Inventory | `src/modules/inventory/` | unit lifecycle, blocking-rental freeze |
| Rentals | `src/modules/rentals/` | booking state machine, transport, extensions, late-fee, inspection, accept/reject |
| Orders | `src/modules/orders/` | sale orders, unit claim |
| Payments | `src/modules/payments/` | intents, manual COD settlement, idempotency |
| Deposits | `src/modules/deposits/` | hold/release/deduct |
| Refunds | `src/modules/refunds/` | create + settle, ledger debit |
| Reviews | `src/modules/reviews/` | eligibility, moderation |
| KYC | `src/modules/kyc/` | attempts + admin review |
| Admin | `src/modules/admin/` | audit logs |
| Settings | `src/modules/settings/` | policy CRUD + approval |
| Delivery | `src/modules/delivery/` | transport quote calc |
| Ledger | `src/modules/ledger/` | idempotent entries, balances, history |
| Disputes | `src/modules/disputes/` | open/list/resolve |

## 5. API Endpoints (selected)

Auth: `POST /auth/register|login|refresh|logout|forgot-password|reset-password`,
`GET /auth/me`

Users: `GET/PATCH /users/me`, `GET/POST/PATCH/DELETE /users/me/addresses[/:id]`

Categories: `GET /categories`, `GET /categories/:id`,
`POST/PATCH/DELETE /categories` (admin), `GET /admin/categories`

Listings: `GET /listings`, `GET /listings/:id`, `GET /listings/:id/related`,
`POST/PATCH/DELETE /listings` (owner), images sub-routes

Inventory: `GET/POST/PATCH/DELETE /inventory/...`

Rentals: `GET /rentals/availability`, `POST /rentals/bookings`,
`GET /rentals/bookings[/:id]`, `POST .../accept|reject|cancel|start|return|expire`,
`GET .../late-fee`, `POST .../late-fee`, `POST/GET .../extensions`

Orders: `POST/GET /orders[/:id]`

Payments: `POST /payments`, `GET /payments[/:id]`, `POST /admin/payments/:id/settle`,
`POST /admin/payments/:id/fail`

Deposits: `GET /deposits`, `POST /admin/deposits/:id/release|deduct`

Refunds: `POST /refunds`, `POST /admin/refunds/:id/settle`, `GET /admin/refunds`

Reviews: `GET/POST /reviews`, `GET/PATCH /admin/reviews/:id`

KYC: `POST /kyc/...`, `GET/PATCH /admin/kyc/:id`

Disputes: `POST/GET /disputes`, `GET /disputes/:id`, `GET/PATCH /admin/disputes`

Settings: `GET/PATCH /admin/settings`

Delivery: `POST /delivery/quote`

Metrics: `POST /metrics/events`, `GET /metrics/users/:id/stats`, `GET /metrics/me`

Health: `GET /health`, `GET /health/ready`

## 6. Middleware & Security

- `requestId` — per-request correlation ID
- `securityHeaders` — nosniff, frame deny, referrer policy, permissions policy, HSTS (https)
- `cors` (configured origins)
- Global rate limit: 600 req / 5 min per IP
- Auth rate limit: 30 req / 15 min per IP on `/auth`
- Body limit 1 MB
- Cookie parsing for refresh token
- Error handler with structured errors; 404 handler

## 7. Business Rules Implemented

- **COD only.** Payments are manual/offline records; settlement is admin-recorded.
  Payment types: rental, deposit, sale, transport, late_fee, damage_charge.
- **Transport:** ₹15/km default (1500 paise), per-direction (outbound + return),
  quoted before booking, never double-charged, distance supplied by client (never
  invented).
- **Late fees:** configurable, unapproved by default ⇒ never auto-charged;
  preview always available.
- **Damage/missing:** manual-quote policy default; inspection requires evidence
  for damage/missing results; charge intent requires recorded inspection.
- **Extensions:** renter/provider request, admin approve/reject; GiST re-arbitrates.
- **Earnings ledger:** credit on COD collection (rental net of commission,
  transport/late-fee/damage pass-through per policy); debit on refund; balance
  derived from entries; advisory lock prevents negative balances.
- **Disputes:** participant-opened, admin-resolved, evidence-backed.
- **Password recovery:** single-use SHA-256 hashed token, 1h expiry, revokes all
  refresh sessions on use; dev token surfaced only outside production.
- **Metrics:** deduped by session/hour; public profile stats; private owner metrics.

## 8. Test Results

- **E2E smoke:** 51/51 PASS (full lifecycle + negative paths)
- **Integration:** 24/24 PASS
  - errors: 5/5
  - auth: 7/7 (incl. refresh rotation + token-reuse revokes all)
  - users: 4/4 (incl. default-address demotion)
  - categories: 4/4 (incl. cycles, uniqueness, deactivation gating)
  - health: 4/4
- All suites run on isolated scratch DBs; no destructive ops on dev DB.

## 9. Remaining / Approval-Dependent Items

- Late-fee amounts, grace period, damage formula, missing-product penalty —
  configurable in `platform_settings`, unapproved by default.
- Online payment gateway — out of scope (COD only).
- Wallet cash-out / bank payouts — future; ledger is reconciliation-ready.
- Transport collection recipient (provider vs platform) — decision point.
- Commission bps — unapproved (default 5%).
- Email provider for password reset (dev token returned outside production).
- Frontend UI completion (foundation in place; core flows to be wired).
- Production deployment (no credentials/access provided).

## 10. Git History

- `beeffa4` Baseline: backend API (13 modules, migrations 001–007) + frontend
  foundation + docs
- `35efe6f` Phase 2: backend completion (COD, transport, ledger, disputes,
  password reset, metrics, middleware, migrations 008–009)
