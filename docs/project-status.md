# Exchange24 — Full Project Status Report

Generated: 2026-10-23 · working tree (uncommitted files on disk)

This is the complete engineering report for the Exchange24 marketplace backend
and frontend: everything that was built, the full database schema and its
relations, the complete REST surface, the code/file map, real test results, and
what remains open.

---

## 1. Executive status

| Layer | Status |
|---|---|
| Database schema + migrations | ✅ Done — 21 domain tables + `schema_migrations`, migrations 001–007 applied to `exchnage_dev` |
| Backend REST API | ✅ Done — all 13 modules implemented and mounted under `/api/v1` |
| Auth/security | ✅ Done — JWT access tokens, rotating hashed refresh cookies, scrypt passwords, RBAC |
| Backend tests | 🔶 In progress — `errors` 5/5, `auth` 7/7, `users` 4/4, `categories` 4/4 passing; remaining test files + full `npm test` run pending |
| E2E smoke | ✅ Done — `backend/scripts/e2e-smoke.mjs`, 51 checks passing against a live server |
| Operations CLI | ✅ Done — `npm run admin:grant` (promote user to admin) + `scripts/e2e-smoke.mjs` |
| Frontend | 🔶 Foundation only — React 19 + Vite shell, router, API client; no marketplace UI yet |
| Infrastructure | ✅ Done — Docker Compose (Postgres 17.11 + pgAdmin 9.18), schema verification SQL |
| Documentation | ✅ Done — this report, database design, architecture, API conventions, middleware README |

Hard rules honoured throughout: no ORM (raw parameterized SQL via `pg`), no new
runtime dependencies, money stored as integer paise (`BIGINT`), all timestamps
`TIMESTAMPTZ` UTC, UUID primary keys, applied migrations are immutable
(checksum-guarded), financial/audit foreign keys are `RESTRICT`, no real payment
captures (intents + manual admin settlement only), no client-trusted user ids,
frontend untouched during backend work.

---

## 2. Repository layout (as built)

```text
exchange/
├── docker-compose.yml            # postgres:17.11-alpine + dpage/pgadmin4:9.18.0
├── .env / .env.example           # Docker Compose credentials
├── README.md                     # setup/runbook (foundation-era; see docs/)
├── backend/
│   ├── package.json              # scripts: dev, start, db:migrate, admin:grant, test
│   ├── .env / .env.example       # API + DB connection (incl. AUTH_JWT_SECRET)
│   ├── .env.test.example / .env.test
│   ├── database/
│   │   ├── migrate.js            # idempotent, transactional, advisory-locked runner
│   │   ├── migrations/
│   │   │   ├── 001_create_identity_tables.sql
│   │   │   ├── 002_create_catalog_tables.sql
│   │   │   ├── 003_create_inventory_and_rentals.sql
│   │   │   ├── 004_create_sales_tables.sql
│   │   │   ├── 005_create_finance_tables.sql
│   │   │   ├── 006_create_trust_and_admin_tables.sql
│   │   │   └── 007_loosen_payments_type_entity_match.sql
│   │   └── factories/
│   │       └── grant-admin.js    # dev-only CLI: promotes a user to `admin`
│   ├── src/
│   │   ├── server.js             # listen + graceful shutdown
│   │   ├── app.js                # express factory: CORS, JSON, cookies, routes
│   │   ├── routes/index.js       # mounts /health + all module routers
│   │   ├── config/               # env.js, database.js (pool+withTransaction), cors.js, platform.js
│   │   ├── middleware/           # authenticate.js (authenticate/requireRole/maybeAuthenticate),
│   │   │                         # errorHandler.js, notFound.js, requestId.js, README.md
│   │   ├── modules/              # 13 feature modules (see §4)
│   │   ├── services/auditLogService.js
│   │   ├── utils/                # validators, http, pgErrorMapper, jwt, passwordCrypto,
│   │   │                         # refreshTokens, cookies
│   │   └── appErrors/AppError.js
│   ├── scripts/e2e-smoke.mjs     # full lifecycle smoke against a running dev API
│   └── tests/                    # node:test suites + isolation helpers (see §7)
├── frontend/
│   ├── vite.config.js, index.html, .env.example
│   └── src/                      # React 19 + Vite 8 foundation (see §8)
├── infrastructure/
│   ├── docker/                   # postgres init assets
│   ├── scripts/verify-schema-constraints.sql   # reusable constraint smoke tests
│   └── README.md
└── docs/
    ├── project-status.md         # ← this report
    ├── database-design.md        # design decisions & deltas (work log)
    ├── database-schema-specification.md
    ├── database_job_output.md
    ├── database-architecture_review.md
    ├── foundation-report.md
    ├── architecture.md
    └── api-conventions.md
```

---

## 3. Database schema

### 3.1 Engineering rules

- **Money:** integer paise in `BIGINT`; no floats anywhere (APIs accept/return
  integers too, e.g. `rentalPricePaise: 50000` = ₹500.00/day).
- **Time:** `TIMESTAMPTZ` (UTC) everywhere; `updated_at` maintained by the
  `set_updated_at()` trigger on every mutable table.
- **Primary keys:** `UUID DEFAULT gen_random_uuid()`.
- **Rental periods:** half-open `[start_date, end_date)` on `DATE` columns;
  `end` is the return day; a 2-day booking costs `2 × daily_rate`.
- **Identity:** emails stored lowercase + case-insensitive unique index;
  passwords hashed with scrypt (`salt$N$r$p$hash` embedded);
  refresh tokens are opaque, stored only as SHA-256 hashes, rotated on use.
- **Ownership model:** `owner_type`/`owner_user_id` pairs — `SELLER` rows
  reference a real user, `PLATFORM` rows have `owner_user_id IS NULL`; enforced
  by CHECK, not a fake "platform user".

### 3.2 Table inventory (22 live tables in `exchnage_dev`)

`audit_logs, categories, inventory_items, kyc_verifications, listing_images,
listings, order_items, orders, payment_events, payments, refresh_sessions,
refunds, rental_booking_items, rental_booking_status_history, rental_bookings,
reviews, schema_migrations, security_deposits, user_addresses, user_profiles,
user_roles, users`

### 3.3 Entity–relationship map

`PK ──FK──►` arrows show `child.column → parent.table (ON DELETE action)`.

```text
                    users
                      ▲ (identity hub)
      ┌───────────┬───┴────────┬──────────────┬───────────────┐
      │           │            │              │               │
 user_profiles  user_      refresh_       kyc_            audit_logs
 (CASCADE)      addresses  sessions       verifications   (RESTRICT)
                (CASCADE)  (CASCADE)      (CASCADE)

 user_roles ──► users (CASCADE) · assigned_by ──► users (SET NULL)

 categories (self-tree)
   └─ parent_id ──► categories.id (RESTRICT) · same name allowed in
       different branches; slugs globally unique

 listings
   ├─ category_id ──► categories.id (RESTRICT)
   └─ owner_user_id ──► users.id (RESTRICT)
        │
        ├── listing_images.listing_id ──► listings.id (CASCADE)
        │
        └── inventory_items.listing_id ──► listings.id (RESTRICT)
             inventory_items.owner_user_id ──► users.id (RESTRICT)
                  │
                  ├──► rental_booking_items.inventory_item_id (RESTRICT)
                  └──► order_items.inventory_item_id (RESTRICT)

 rental_bookings (header: renter + listing + money snapshots)
   ├─ renter_user_id ──► users.id (RESTRICT)
   ├─ rental_listing_id ──► listings.id (RESTRICT)
   │
   ├── rental_booking_items (1 physical unit per row)
   │     ├─ rental_booking_id ──► rental_bookings.id (CASCADE)
   │     └─ inventory_item_id ──► inventory_items.id (RESTRICT)
   │
   ├── rental_booking_status_history (append-only)
   │     ├─ rental_booking_id ──► rental_bookings.id (CASCADE)
   │     └─ changed_by_user_id ──► users.id (RESTRICT)
   │
   ├── payments.rental_booking_id ──► rental_bookings.id (RESTRICT)
   ├── security_deposits.rental_booking_id ──► rental_bookings.id (RESTRICT, UNIQUE)
   └── reviews.qualifying_rental_booking_id ──► rental_bookings.id (RESTRICT)

 orders (header)
   ├─ buyer_user_id ──► users.id (RESTRICT)
   ├── order_items (1 claimed unit per row)
   │     ├─ order_id ──► orders.id (CASCADE)
   │     ├─ inventory_item_id ──► inventory_items.id (RESTRICT)
   │     └─ listing_id ──► listings.id (RESTRICT)
   ├── payments.order_id ──► orders.id (RESTRICT)
   └── reviews.qualifying_order_id ──► orders.id (RESTRICT)

 payments (per attempt/settlement)
   ├─ recorded_by_user_id ──► users.id (RESTRICT)
   └── payment_events.payment_id ──► payments.id (RESTRICT)  [append-only]
   └── refunds.payment_id ──► payments.id (RESTRICT)
         └─ created_by_user_id ──► users.id (RESTRICT)

 reviews
   ├─ reviewer_user_id ──► users.id (RESTRICT)
   └─ reviewee_user_id ──► users.id (RESTRICT)

 kyc_verifications.reviewed_by_user_id ──► users.id (RESTRICT)
```

Financial and audit children are deliberately `RESTRICT`/`CASCADE`-free against
users so no money or audit trail can vanish through a user delete; users are
soft-deleted (`status = 'deleted'`) in practice.

### 3.4 Full schema — table by table

#### `users` *(migration 001)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | default `gen_random_uuid()` |
| email | VARCHAR(255) NOT NULL | `CHECK email = lower(email)`, e-mail format CHECK; **unique on `lower(email)`** |
| password_hash | VARCHAR(255) NOT NULL | scrypt, salt embedded; never returned by APIs |
| status | VARCHAR(20) NOT NULL DEFAULT 'active' | `active` \| `suspended` \| `deleted` |
| last_login_at, created_at, updated_at | TIMESTAMPTZ | |

#### `user_profiles` *(001)* — `user_id UUID UNIQUE → users (CASCADE)`
display_name VARCHAR(100) (min 2 chars), phone_number (regex
`^\+?[0-9][0-9\s-]{4,31}$`), avatar_url VARCHAR(500), bio TEXT.

#### `user_addresses` *(001)* — `user_id → users (CASCADE)`
address_type (`shipping`|`billing`|`both`, default `shipping`), full_name,
phone_number, line1, line2, city, state, postal_code (format CHECK),
country (default 'India'), is_default BOOLEAN NOT NULL.
- **Unique partial index** `user_addresses_default_unique (user_id) WHERE is_default`
  → one default address per user; service demotes-then-sets inside one tx.
- Index: `user_addresses_user_id_idx`.

#### `refresh_sessions` *(001)* — `user_id → users (CASCADE)`
token_hash VARCHAR(64) NOT NULL UNIQUE (SHA-256 hex of the opaque token),
expires_at, revoked_at (CHECK `revoked_at > created_at` when set).
Purpose: rotation + reuse-detection (reuse ⇒ revoke all sessions).

#### `user_roles` *(001)* — `user_id → users (CASCADE)`, `assigned_by → users (SET NULL)`
role_name CHECK ∈ (`customer`, `seller`, `admin`); UNIQUE `(user_id, role_name)`.
Registration grants `customer`+`seller`; `admin` is seeded manually via
`npm run admin:grant`.

#### `categories` *(002)* — self-referencing tree
parent_id → categories.id (RESTRICT; no self-parent CHECK), name VARCHAR(100),
slug VARCHAR(120) (format `^[a-z0-9]+(-[a-z0-9]+)*$`, globally unique),
description, image_url, display_order INTEGER ≥ 0, is_active BOOLEAN.
- Unique `(parent_id, lower(name)) NULLS NOT DISTINCT` — same name allowed in
  different branches.
- DELETE is never issued: categories are **deactivated** (`is_active = false`),
  blocked while active children exist; cycles prevented in service by walking
  ancestors (depth limit 5).
- Indexes: parent_id, active roots `(parent_id, display_order) WHERE is_active`.

#### `listings` *(002)* — commercial offer
owner_type (`SELLER`|`PLATFORM`) + owner_user_id → users (RESTRICT), paired by
CHECK (SELLER ⇒ not null, PLATFORM ⇒ null); category_id → categories (RESTRICT);
title (min 3 chars); condition ∈ `new|like_new|good|fair|poor`; size, colour,
brand; **money (BIGINT paise):** rental_price_paise, sale_price_paise,
deposit_paise, replacement_value_paise (all ≥ 0 when present);
is_rental (default true) / is_sale (default false) — at least one;
listing_status ∈ `active|inactive|retired`; deposit only allowed with rental;
rental price required when is_rental, sale price when is_sale.
- Indexes: category+status, partial price indexes for active rental/sale
  browsing, owner, status.

#### `listing_images` *(002)* — `listing_id → listings (CASCADE)`
object_key VARCHAR(500) UNIQUE, mime_type CHECK `^image/(png|jpeg|jpg|webp|avif)$`,
size_bytes ≤ 25 MiB, visibility (`public`|`private`), is_primary.
- **Unique partial** `(listing_id) WHERE is_primary` → one primary image per
  listing; service demotes the previous primary atomically.

#### `inventory_items` *(003)* — one row = one physical unit
listing_id → listings (RESTRICT), owner pairing identical to listings,
serial_or_sku VARCHAR(100), condition, and lifecycle
`operational_status ∈ AVAILABLE | RESERVED | RENTED | SALE_PENDING | SOLD |
MAINTENANCE | DAMAGED | LOST | RETIRED`.
(`BOOKED` deliberately omitted — upcoming rentals are rows in
`rental_booking_items`, not a status.)
- Indexes: `(listing_id, operational_status)`, owner, status.

#### `rental_bookings` *(003)* — header
renter_user_id → users (RESTRICT), rental_listing_id → listings (RESTRICT),
status state machine `pending → confirmed → active → completed`,
with `cancelled`/`expired` exits; start_date/end_date DATE with
`end_date > start_date`; money snapshots (immutable once confirmed):
subtotal_amount_paise, deposit_amount_paise, total_amount_paise with CHECK
`total = subtotal + deposit`; deposit_paid BOOLEAN; actual_return_date ≥ start.
- Indexes: renter, listing, status, `(listing_id, start_date, end_date)`.

#### `rental_booking_items` *(003)* — per physical unit
rental_booking_id → rental_bookings (CASCADE), inventory_item_id →
inventory_items (RESTRICT), item_status mirrors the header machine; every unit
row keeps its own start/end dates, daily_rate_paise snapshot,
`line_total_paise = (end_date - start_date) * daily_rate_paise` CHECK.
- **Overlap guard (the core availability guarantee):**
  ```sql
  ADD CONSTRAINT rental_booking_items_no_overlap
  EXCLUDE USING gist (
      inventory_item_id WITH =,
      daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (item_status IN ('pending', 'confirmed', 'active'));
  ```
  Requires `btree_gist`; the predicate set matches the app's blocking-status
  set exactly, so availability checks and the DB agree by construction.

#### `rental_booking_status_history` *(003)* — append-only
rental_booking_id (CASCADE), from_status/to_status, changed_by_user_id → users
(RESTRICT), reason TEXT; no updated_at (immutable log).

#### `orders` *(004)* — header
buyer_user_id → users (RESTRICT); status `pending → paid`, exits `cancelled`/
`refunded`; total_amount_paise (snapshot, ≥ 0).

#### `order_items` *(004)* — one row = one claimed unit (no quantity column)
order_id (CASCADE), inventory_item_id (RESTRICT), listing_id (RESTRICT),
unit_price_paise, line status mirrors order status.
- **Sale exclusivity:**
  ```sql
  CREATE UNIQUE INDEX order_items_sale_claim
      ON public.order_items (inventory_item_id)
      WHERE status IN ('pending', 'paid');
  ```
  One item can be in at most one live order; `cancelled`/`refunded` lines free
  the claim automatically.

#### `payments` *(005, amended by 007)*
`rental_booking_id` / `order_id` — an XOR CHECK enforces exactly one entity;
payment_type ∈ `rental|sale|deposit|refund|commission|payout`; direction
`in|out`; amount_paise > 0; status `pending|succeeded|failed|cancelled`;
provider, provider_transaction_id, idempotency_key, recorded_by_user_id → users
(RESTRICT).
- Unique partial `idempotency_key` (replay ⇒ same payment returned);
  unique `(provider, provider_transaction_id)` when present;
  indexed by booking/order/`(type,status)`.
- **Migration 007** loosened `payments_type_entity_match` so
  `refund|commission|payout` may reference **either** a booking or an order
  (commissions on sales were impossible under the original CHECK). Applied as a
  new migration: DROP + ADD `NOT VALID` + `VALIDATE` — migrations 001–006
  untouched (checksum immutability).

#### `payment_events` *(005)* — append-only
payment_id (RESTRICT), event_type ∈ `initiated|succeeded|failed|cancelled|
refund_initiated|refund_succeeded|refund_failed|note`, provider_event_id, amount,
payload JSONB. Unique `(payment_id, provider_event_id)` when present for
at-least-once webhook collapse.

#### `security_deposits` *(005)* — liability ledger, one row per booking
rental_booking_id UNIQUE (RESTRICT); status `held → releasing → released|withheld`;
collected_amount_paise ≥ 0, deduction_amount_paise ≤ collected, deduction needs
a reason (`deduction_amount_paise = 0 OR deduction_reason IS NOT NULL`);
released_at TIMESTAMPTZ.

#### `refunds` *(005)*
payment_id → payments (RESTRICT), refund_amount_paise > 0, reason ∈
`customer_request|item_returned|quality_issue|duplicate_charge|cancellation|
platform_initiated`, status `pending|succeeded|failed|cancelled`,
processed_at, created_by_user_id → users (RESTRICT).

#### `kyc_verifications` *(006)*
user_id → users (CASCADE); verification_type ∈ `aadhaar|pan|passport|
driver_license`; status `pending|verified|rejected|expired`; provider +
provider_reference/document_url (masked — full document numbers never stored);
attempt_number ≥ 1 UNIQUE `(user_id, attempt_number)`; reviewed_by_user_id →
users (RESTRICT); `rejected` requires rejection_reason.

#### `reviews` *(006)*
reviewer_user_id, reviewee_user_id (both RESTRICT; self-review CHECK-blocked);
exactly one qualifying target via XOR CHECK:
`qualifying_rental_booking_id` (booking must be `completed`) or
`qualifying_order_id` (order must be `paid`); rating 1–5; status
`published|hidden|removed`.
- Unique partial duplicates: `(reviewer, reviewee, qualifying_rental_booking_id)`
  and `(reviewer, reviewee, qualifying_order_id)`.

#### `audit_logs` *(006)* — append-only
user_id → users (RESTRICT) (NULL = "operations"), action VARCHAR(100),
entity_type ∈ fixed allowlist, entity_id UUID (generic, no FK),
previous_value/new_value JSONB, ip_address INET, user_agent.

#### `schema_migrations` *(created by migrate.js)*
filename, checksum, applied_at — powers idempotent, checksum-guarded,
advisory-locked migration runs (each file applied in its own transaction with
its history row).

### 3.5 Lifecycle state machines (DB + service agree)

```text
inventory: AVAILABLE ⇄ MAINTENANCE · DAMAGED → AVAILABLE · LOST → RETIRED
           RESERVED (booking starts) · RENTED (returned → AVAILABLE)
           SALE_PENDING (order) → SOLD · RETIRED (retire) — workflow-only

rental_booking(+items):
  pending ──settlePayment──▶ confirmed ──start──▶ active ──return──▶ completed
     │                          │ admin expire ▼
     └──cancel (renter, pre-confirm)──▶ cancelled          expired
  cancel/expiry RELEASE unit claims back to AVAILABLE

order:    pending ──settlePayment──▶ paid · pending ──cancel──▶ cancelled
line:     pending → paid/cancelled · paid → refunded
claim:    order create claims AVAILABLE→SALE_PENDING; cancel releases

payment:  pending ──admin settle──▶ succeeded · pending ──admin fail──▶ failed|cancelled
deposit:  held (created at deposit settle) → releasing (on return) → released|withheld
refund:   pending → succeeded|failed (admin settle)
```

---

## 4. Backend code map (backend/src)

Shared plumbing:

| File | Responsibility |
|---|---|
| `config/env.js` | validated env (invalid values abort startup); loads `.env` itself |
| `config/database.js` | pg Pool, `withTransaction`, health probe; DATE columns pinned to plain `YYYY-MM-DD` strings via type parser |
| `config/cors.js` · `platform.js` | CORS allowlist; brand/currency/timezone |
| `appErrors/AppError.js` | typed errors {statusCode, code} used across every module |
| `middleware/requestId.js` · `errorHandler.js` · `notFound.js` | request id; envelope `{error:{code,message},requestId}`; 404 |
| `middleware/authenticate.js` | `authenticate`, `maybeAuthenticate` (optional/anonymous), `requireRole`, `extractBearerToken` |
| `utils/validators.js` | `isUuid, expectString, expectInt, expectEnum, expectAmount, expectIsoDate` |
| `utils/http.js` | `parsePagination`, `paginationMeta`, `sendData` |
| `utils/pgErrorMapper.js` | maps SQLSTATEs/constraints to typed errors (`RENTAL_OVERLAP`, `SALE_CLAIM_CONFLICT`, …); **throws** — safe as `.catch()` patch |
| `utils/jwt.js` · `passwordCrypto.js` · `refreshTokens.js` · `cookies.js` | HS256 access tokens (15 min), scrypt hashing, rotate-and-revoke refresh sessions, cookie parsing |
| `services/auditLogService.js` | `writeAuditLog` (tx-aware) + `auditContext(req)` |

Feature modules (`src/modules/<name>/`): each has `routes.js` (+ `controller.js`
in some), `service.js` (business rules + transactions), `repository.js` (raw SQL):

| Module | Routes (prefix) | Highlights |
|---|---|---|
| `auth` | `/auth` | register (grants customer+seller), login (timing-safe), me; refresh cookie `exch_refresh` (HttpOnly, path `/api/v1/auth`, 30 d) with rotation; **reuse ⇒ revoke all sessions**; logout |
| `users` | `/users` | profile GET/PATCH; addresses CRUD with demote-then-set default handling |
| `categories` | `/categories` (public GETs) + admin writes + `/admin/categories` reads | admin-only mutations, deactivate semantics, cycle + depth checks, slugify |
| `listings` | `/listings` (public, optional-auth owner-aware detail) + owner ops | filters (category/condition/mode/price/q/sort), images with single-primary management, retire blocked while units claimed |
| `inventory` | `/inventory/items` | manual transition guard map; RESERVED/RENTED/SALE_PENDING/SOLD workflow-only; blocking rentals freeze transitions |
| `rentals` | `/rentals/availability` (public) + `/rentals/bookings` | one-tx create (header snapshot → arbitrated unit insert via GiST exclusion → atomic claim AVAILABLE→RESERVED); cancel/start/return/admin-expire with history rows; `MAX_RENTAL_DAYS = 90` |
| `orders` | `/orders` | deduped items, ≤ 20 units, sale claim, self-purchase blocked, cancel releases claims |
| `payments` | `/payments` + `/admin/payments` | intents only (never capture); idempotency replay; duplicate-charge guard; admin settle (manual/offline record) applies booking-confirm / deposit-row / order-paid; admin fail |
| `deposits` | `/deposits` + `/admin/deposits` | renter reads; admin release (auto pending refund `item_returned`, headroom-capped) / deduct (reason ≥ 4 chars) |
| `refunds` | `/admin/refunds` + participant `GET /refunds/:id` | create/settle; refundable = payment − Σ(pending+succeeded) |
| `reviews` | `/reviews` (+ `/reviews/mine`) + `/admin/reviews` | sides as_renter/as_provider (completed booking) + as_buyer (paid order); platform-owned listings unreviewable; admin moderation |
| `kyc` | `/kyc` + `/admin/kyc` | attempts (aadhhaar/pan/passport/driver_license), masked refs, attempt numbers, admin verify/reject (self-review blocked) |
| `admin` | `/admin/audit-logs` | read-only audit trail with filters |

Mount table (`routes/index.js`): `/auth, /users, /categories (public+admin),
/admin/categories, /listings (public+owner), /inventory, /rentals,
/orders, /payments, /admin/payments, /deposits, /admin/deposits,
/admin/refunds, /refunds, /reviews, /admin/reviews, /kyc, /admin/kyc, /admin`.

Full REST surface (all JSON; all paths prefixed `/api/v1`):

```text
PUBLIC
GET  /health
POST /auth/register · /auth/login · /auth/refresh · /auth/logout      (cookie-based refresh)
GET  /categories · /categories/:id
GET  /listings · /listings/:id ·  /rentals/availability?listingId&startDate&endDate
GET  /reviews?revieweeId=&minRating=&page=&limit= · /reviews/:id       (optional auth)

AUTHENTICATED (any role)
GET  /auth/me
GET/PATCH /users/me/profile
GET/POST /users/me/addresses · GET/PATCH/DELETE /users/me/addresses/:id
GET   /listings/mine · POST /listings · PATCH|PUT /listings/:id · DELETE /listings/:id
POST  /listings/:id/images · DELETE /listings/:id/images/:imageId
POST /inventory/items · GET /inventory/items · GET/PATCH/DELETE /inventory/items/:id
POST /rentals/bookings · GET /rentals/bookings · GET /rentals/bookings/:id
POST /rentals/bookings/:id/cancel (renter pre-confirm | admin incl. active)
POST /rentals/bookings/:id/start (provider) · /return (provider) · /expire (admin)
POST /orders · GET /orders · GET /orders/:id · POST /orders/:id/cancel
POST /payments · GET /payments?rentalBookingId|orderId · GET /payments/:id
GET  /deposits · GET /deposits/:id
POST /reviews · GET /reviews/mine · DELETE /reviews/:id (author or admin)
POST /kyc · GET /kyc
ADMIN ONLY (requireRole('admin'))
POST /categories · PATCH /categories/:id · DELETE /categories/:id (=deactivate)
GET  /admin/categories · /admin/categories/:id
POST /admin/payments/:id/settle · /admin/payments/:id/fail
POST /admin/deposits/:id/release · /admin/deposits/:id/deduct
POST /admin/refunds · GET /admin/refunds · POST /admin/refunds/:id/settle
PATCH /admin/reviews/:id (published|hidden moderation)
GET  /admin/kyc · PATCH /admin/kyc/:id (verify|reject)
GET  /admin/audit-logs?action=&entityType=&entityId=&from=&to=&page=&limit=
```

Error envelope (uniform, from `errorHandler`):

```json
{ "error": { "code": "RENTAL_OVERLAP", "message": "The selected days are no longer available for this item." }, "requestId": "…" }
```

Tags: `400 VALIDATION_ERROR/INVALID_ID/INVALID_PAGINATION` ·
`401 UNAUTHENTICATED/INVALID_TOKEN/INVALID_CREDENTIALS/INVALID_REFRESH_TOKEN` ·
`403 FORBIDDEN/ACCOUNT_NOT_ACTIVE/SELF_BOOKING_NOT_ALLOWED/SELF_PURCHASE_NOT_ALLOWED` ·
`404 *_NOT_FOUND` · `409 CATEGORY_CYCLE/CATEGORY_HAS_ACTIVE_CHILDREN/
CATEGORY_NAME_TAKEN/CATEGORY_SLUG_TAKEN/DATES_NOT_AVAILABLE/RENTAL_OVERLAP/
SALE_CLAIM_CONFLICT/PAYMENT_ALREADY_EXISTS/ALREADY_SETTLED/BOOKING_NOT_PAYABLE/
DUPLICATE_REVIEW/…` · `503 DATABASE_UNAVAILABLE`.

---

## 5. Migration & operations tooling

| Tool | File / command | Notes |
|---|---|---|
| Migration runner | `npm run db:migrate` → `backend/database/migrate.js` | checksum-guarded (editing an applied file aborts), advisory-locked, per-file transactions, importable `runMigrations(pool)` for tests |
| Schema smoke tests | `infrastructure/scripts/verify-schema-constraints.sql` | exercises exclusion constraint, sale-claim uniqueness, one-default-address, payments XOR |
| Admin promotion CLI | `npm run admin:grant -- <email>` → `backend/database/factories/grant-admin.js` | idempotent; writes `ROLE_ADMIN_GRANTED` audit row with NULL actor ("operations") |
| E2E smoke | `node scripts/e2e-smoke.mjs` (server on :5000) | 51 assertions across the full lifecycle |

---

## 6. Verification performed (real runs)

- Migrations 001–007 applied to `exchnage_dev`; re-run idempotent
  ("already applied: 6"); 22 tables live (verified via `information_schema`).
- Constraint smoke SQL: exclusion overlap, sale claim, one-default-address,
  payments XOR/type/entity — all enforced as designed.
- `scripts/e2e-smoke.mjs` against the running API — **51/51 PASS**, covering:
  register (roles granted) → `admin:grant` CLI → admin login → category create +
  seller denial → listing create → self-booking denial → inventory → public
  availability → book 2 days (subtotal/total incl. deposit) → overlapping
  booking 409 → payment intent (+idempotent replay) → admin settle → booking
  confirmed → re-settle 409 → renter cannot settle → deposit intent/settle →
  deposit_paid flag → second deposit 409 → provider start → renter return 403 →
  provider return → unit freed → deposit `releasing` → admin release → auto
  refund `item_returned` → refund settle (204) → sale order → purchase settle →
  order paid → unit SOLD → double purchase 409 → review created → duplicate
  review 409 → reputation meta (count/average).
- Isolated-DB integration suites (each file gets its own
  `exchnage_test_<file>` database, dropped & re-migrated per run):
  `errors.test.mjs` **5/5**, `auth.test.mjs` **7/7** (incl. refresh-rotation and
  token-reuse revocation), `users.test.mjs` **4/4** (incl. default-address
  demotion race semantics), `categories.test.mjs` **4/4** (tree/uniqueness/
  cycles/deactivation gating). Existing `health.test.js` retained.
- Fixes discovered & landed during verification: `translatePgError` now throws
  (a `.catch()` callback that returns would swallow rejections),
  payments participant-key mismatch, intent idempotency ordering, deposit
  payable-state rule, `deposits.repository` RETURNING fix, BIGINT→Number
  coercion in listing mappers, DATE string parsing, users `is_default`
  creation path, categories admin router guard/shadowing, optional-auth
  middleware extraction (`maybeAuthenticate`) shared by listings + reviews.

**Not yet verified:** remaining integration suites (listings, inventory,
rentals, orders, payments/deposits/refunds, reviews+kyc+audit, and the
rental-overlap/sale-claim concurrency tests) are planned; full `npm test`
aggregates those once written.

---

## 7. Backend test infrastructure (backend/tests)

| File | Purpose |
|---|---|
| `helpers/test-db.js` | per-file scratch DB (`exchnage_test_<file>`): DROP `WITH (FORCE)` + CREATE + `runMigrations`, `startTestServer()` (ephemeral port), `makeClient` (token/opts-aware), `registerUser`, `registerAdminUser` (spawns the grant CLI against the test DB), `closeDatabasePool` |
| `integration/errors.test.mjs` | error envelope, 401 map, INVALID_ID, typed 404s, pagination validation |
| `integration/auth.test.mjs` | registration/roles, lowercase emails, credential honesty, `/auth/me`, refresh rotation + reuse-revocation, logout, garbage cookies |
| `integration/users.test.mjs` | profile patching, address defaults (demote), validation, cross-user isolation |
| `integration/categories.test.mjs` | public/admin visibility, admin-only writes, name/slug conflicts, cycle + self-parent, deactivation gating |
| `integration/health.test.js` | (pre-existing) health + DB connectivity |

Test command: `npm test` → `node --env-file=.env --env-file-if-exists=.env.test --test`
(Node 24 built-in runner; all files run in parallel, each on its own database).

---

## 8. Frontend (foundation only — untouched during backend phase)

`frontend/src`:

| File | Responsibility |
|---|---|
| `main.jsx` · `app/App.jsx` · `app/providers.jsx` · `app/router.jsx` | React 19 bootstrap, provider tree, router |
| `components/layout/AppLayout.jsx` (+ module CSS) | app shell |
| `config/appConfig.js` | `VITE_PLATFORM_NAME/CURRENCY/TIMEZONE`, `VITE_API_BASE_URL` validation |
| `services/apiClient.js` | fetch wrapper pointed at `/api/v1` (no feature calls yet) |
| `services/endpoints.js` | `endpoints.health` (placeholder registry) |
| `features/home/pages/HomePage.jsx` (+ CSS) | brand shell page |
| `styles/{reset,variables,global}.css` | design tokens |

Build stack: Vite 8, `npm run dev` (:5173, strict port), `build`, `preview`.

---

## 9. How to run the whole stack

```powershell
# 1. Database
docker compose up -d                       # postgres 17.11 + pgAdmin 9.18

# 2. Backend
cd backend; npm install
npm run db:migrate                          # applies 001–007 (idempotent)
npm run admin:grant -- user@example.com     # optional promotion to admin
npm run dev                                 # http://127.0.0.1:5000/api/v1/health
npm test                                    # integration suite (isolated DBs)
node scripts/e2e-smoke.mjs                  # while dev server is up

# 3. Frontend (separate terminal)
cd frontend; npm install; npm run dev       # http://127.0.0.1:5173
```

---

## 10. Open items & next steps

1. **Finish the test suite** — remaining files (listings, inventory, rentals
   incl. admin-expire path, orders, payments/deposits/refunds,
   reviews+kyc+audit, concurrency: N parallel bookings on one unit ⇒ exactly 1
   succeeds) then a full `npm test` run.
2. **Commission capture** — `settlePayment` intentionally does not yet write a
   `commission` payment row; decided to expose a configurable bps snapshot as
   an open design decision.
3. **Real payment provider** — the settle/fail endpoints are manual/offline
   records only; a provider integration (e.g. webhook ingestion over
   `payment_events`) is out of scope of this phase.
4. **Rental–sale coexistence defaults** — a sale on a listing with future
   blocking rentals currently refuses at order time; fine-grained policy
   (auto-block sale dates, per-cohort rules) is an open product decision.
5. **Frontend feature work** — marketplace UI over the now-stable API
   (auth flows, catalog, listings, bookings, orders, reviews).
6. **Housekeeping** — refresh stale foundation docs (`README.md` "Current
   status", `docs/foundation-report.md`), and commit the working tree.
