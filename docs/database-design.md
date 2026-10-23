# Database Design

**Status:** schema implementation approved (October 2026). Migrations in
`backend/database/migrations/` implement the MVP tables below. See
`database-schema-specification.md` for the original proposal and
`architecture.md` for overall system design.

## Current state

- PostgreSQL 17.11 runs locally in Docker (`exchnage_dev` database).
- Schema migrations are tracked in `schema_migrations` and applied by the
  built-in migration runner (`npm run db:migrate`).
- Integration tests run against an isolated database (`exchnage_test`),
  created and migrated automatically.

## Migration location

```text
backend/database/
├── migrations/   # ordered, versioned SQL files (001_..., 002_..., ...)
├── migrate.js    # idempotent runner with advisory locking + checksums
├── seeds/        # explicit development/reference data
└── factories/    # test-data builders, never used against production data
```

## Agreed design principles

### Identity and ownership

- One user account can act as buyer, renter, and seller.
- Roles and permissions are checked on the server.
- Company-owned inventory and peer-to-peer inventory are both represented,
  with ownership made explicit rather than inferred.
- Platform-owned rows use `owner_type = 'PLATFORM'` with a **NULL** owner user.
  There is no fake "platform user" account. CHECK constraints enforce the
  pairing `(owner_type, owner_user_id)`:
  - `SELLER` → `owner_user_id IS NOT NULL`
  - `PLATFORM` → `owner_user_id IS NULL`

### Identifiers and time

- UUID primary keys generated with `gen_random_uuid()` (built into PG 13+).
- `TIMESTAMPTZ` for instants, stored in UTC. Defaults use `now()`.
- Business-facing rental periods are date-based. **All rental dates are
  half-open:** a period is `[start_date, end_date)`; `end_date` is exclusive
  (the return/handover day). Overlap logic uses `daterange(start_date,
  end_date, '[)')`.
- `created_at` and `updated_at` on mutable records, kept current by the
  `set_updated_at()` trigger function.

### Money

- Monetary values are integer paise in `BIGINT` columns. No floating point.
- Percentages such as commission are integer basis points (1% = 100 bps).
- Commission/deposit amounts are snapshotted onto transactions at settlement
  time. Historical snapshots are never overwritten.
- Security deposits are liabilities, not revenue, and have their own ledger
  (`security_deposits`), separate from rental payments.

### Listings and inventory

A listing is a commercial offer. An inventory item is a physical object.

- A listing can map to one or more physical units (`inventory_items`).
- Quantities (total / available / reserved / rented / sold) are **derived by
  SQL aggregation** over `inventory_items.operational_status`. No maintained
  counters are stored, so they cannot drift.
- An item's `operational_status` describes the *physical* lifecycle
  (`AVAILABLE`, `RESERVED`, `RENTED`, `SALE_PENDING`, `SOLD`, `MAINTENANCE`,
  `DAMAGED`, `LOST`, `RETIRED`). It is distinct from the booking state machine.
  `BOOKED` was dropped as redundant: an upcoming confirmed rental is tracked by
  `rental_booking_items` rows, not by a status value.
- Rental availability is enforced by a partial GiST exclusion constraint on
  `rental_booking_items`:
  `EXCLUDE USING gist (inventory_item_id WITH =, daterange(start_date,
  end_date, '[)') WITH &&) WHERE item_status IN ('pending','confirmed','active')`
  (requires `btree_gist`). The blocking status set in the constraint predicate
  is identical to the set used by availability queries.
- Adjacent half-open periods (`[a,b)` then `[b,c)`) are permitted.
- A successful sale claims one physical item exclusively through a partial
  unique index on `order_items(inventory_item_id) WHERE status IN
  ('pending','paid')`, plus a conditional row update (`operational_status`).
  Double-selling is prevented at the database layer, not only the frontend.

### Workflow history

- Rental bookings and sale orders use explicit, server-enforced state machines.
- Every transition is recorded with its actor and timestamp
  (`rental_booking_status_history`, audit logs for sensitive actions).
- Historical financial amounts and decisions are not overwritten.
- Financial and audit history uses `ON DELETE RESTRICT` (not cascades).
- Media evidence is stored in object storage; PostgreSQL keeps only metadata
  and access rules.

## Finalized decisions and specification deltas

These resolution points were fixed before the migrations were written. They
differ from, or sharpen, `database-schema-specification.md`:

| # | Topic | Decision |
|---|-------|----------|
| 1 | Ownership | `owner_type` + conditional `owner_user_id` (NULL for platform). No synthetic platform user; CHECK constraints enforce referential integrity. |
| 2 | Orders model | Header `orders` + line `order_items`; one line row per physical unit; no `quantity` column; per-line `status` powers the sale-claim partial unique index. |
| 3 | Sale claim index | `order_items (inventory_item_id) WHERE status IN ('pending','paid')` — all referencing columns from one table only. |
| 4 | Rental dates | Half-open `[start, end)` everywhere; exclusion via expression `daterange(start_date, end_date, '[)')`; no redundant stored `rental_period` column. |
| 5 | Blocking statuses | Booking/item blocking set = `('pending','confirmed','active')`, identical in the exclusion constraint and availability queries. |
| 6 | Inventory statuses | Dropped `BOOKED` as redundant; kept `AVAILABLE, RESERVED, RENTED, SALE_PENDING, SOLD, MAINTENANCE, DAMAGED, LOST, RETIRED`. |
| 7 | FK indexes | PostgreSQL does NOT auto-index FK columns; explicit indexes are created for every FK used by queries. |
| 8 | Financial deletion | `payments`, `payment_events`, `security_deposits`, `refunds`, `audit_logs`, history tables: `ON DELETE RESTRICT` (or no FK cascade) so records are never silently deleted. |
| 9 | Self-review | Enforced in-row with `CHECK (reviewer_id <> reviewee_id)` (the spec wrongly considered this impossible). |
| 10 | Auth | Hybrid: short-lived HS256 access token (Bearer header) + rotating opaque refresh token stored hashed (`refresh_sessions`), delivered as HttpOnly cookie. Passwords hashed with Node's built-in `crypto.scrypt` (deviation from the spec's Argon2id default; no native dependency). |
| 11 | Roles | `user_roles` with `('customer','seller','admin')`; registration grants `customer` + `seller`; `admin` is assigned manually/seeded. |
| 12 | Categories | Name uniqueness per parent using `NULLS NOT DISTINCT`; categories are deactivated, never hard-deleted; parent FK is `RESTRICT`; cycle prevention lives in the service layer. |
| 13 | Commission | 500 bps (5%) placeholder, snapshot at settlement; not final and configurable before launch. |
| 14 | Deposits | Deposit rows exist only after collection; lifecycle `held → releasing → released | withheld`; deductions recorded with amount + reason. |
| 15 | Deferred | Organizations, inspections, disputes, notifications, memberships/subscriptions, delivery tracking, listing moderation queue remain future-phase (no tables). |

Unresolved business decisions still requiring the product owner's approval are
collected in the final implementation report.
