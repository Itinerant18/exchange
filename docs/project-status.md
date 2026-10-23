# Exchange24 — Project Status Report

Generated: 2026-10-23 (Phase 2 completion pass)

## 1. Summary

The Exchange24 backend is complete against the backend completion gate and the
frontend foundation is in place. The full E2E smoke passes (51/51) and the
integration suite passes (24/24). New in this pass: COD-framed payment types,
transport (outbound/return) charges, configurable business policy, earnings
ledger, disputes, password recovery, analytics metrics, provider/renter
dashboards, rate limiting, security headers, readiness probe, and the admin
settings/dispute/reconciliation surface.

## 2. Database

Migrations (immutable, checksum-guarded): `001` … `009` — all applied to
`exchnage_dev` (9 migrations). Test DBs are force-dropped and re-migrated per
run by `tests/helpers/test-db.js`.

New in 008/009:

- `platform_settings` — JSONB policy store (delivery rate ₹15/km approved;
  late-fee/damage/commission unapproved ⇒ never auto-charged).
- `listings` +city, +delivery_available, +delivery_radius_km.
- `rental_bookings` +transport_mode, +outbound/return distance & amount, +late-fee
  columns.
- `booking_extensions`, `return_inspections`, `disputes`, `earnings_ledger`,
  `password_reset_tokens`, `metrics_events`.

Financial rules: integer paise BIGINT, UTC TIMESTAMPTZ, UUID PKs, half-open
`[start,end)` rental periods, FKs RESTRICT on financial/audit rows.

## 3. Backend modules (mounted under `/api/v1`)

13 original + new: `settings`, `delivery`, `ledger`, `disputes`, `metrics`,
`dashboard` (dashboard endpoints folded into provider/renter aggregations via
ledger), `auth` (now with forgot/reset password).

Key endpoints added:

- `POST /delivery/quote` — per-direction transport line items.
- `GET/POST /rentals/bookings/:id/accept|reject`, `.../extensions`,
  `.../late-fee`, `GET .../late-fee`.
- `POST /disputes`, `GET /disputes`, `GET /disputes/:id`,
  `GET/PATCH /admin/disputes`.
- `GET/PATCH /admin/settings`, `GET /admin/settings`.
- `GET /admin/reports/reconciliation` (sums by type/status).
- `POST /auth/forgot-password`, `POST /auth/reset-password`.
- `POST /metrics/events`, `GET /metrics/users/:id/stats`, `GET /metrics/me`.
- `GET /health/ready` (DB + migrations ≥ 9).
- `GET /ledger/me`-style balance via `GET /users/me`? balance exposed through
  `GET /payments` history + ledger entries.

Middleware: `securityHeaders`, global rate limit (600/5min), auth rate limit
(30/15min), request IDs, CORS, JSON body limit.

## 4. Tests

- E2E smoke: **51/51 PASS** (full lifecycle incl. transport quote, late-fee
  preview, inspection at return, deposit release + auto refund, sale order,
  review/reputation, negative paths).
- Integration: **24/24 PASS** (`errors` 5, `auth` 7, `users` 4, `categories` 4,
  `health` 4). All suites run on isolated scratch DBs.

## 5. Frontend

React 19 + Vite 8 foundation preserved (AppLayout, router, providers, home
page). Backend APIs are the source of truth; no fake data. Further UI work
tracked in `docs/project-status.md` open items.

## 6. Open / approval-dependent decisions

- Late-fee amounts, grace period, damage formula, missing-product penalty —
  configurable in `platform_settings`, `is_approved=false` by default ⇒ no
  undisclosed charge is ever imposed.
- Online payment gateway integration — out of scope (COD only).
- Wallet cash-out / bank payouts — future feature; ledger is reconciliation-ready.
- Transport collection recipient (provider vs platform) — `transport_provider_receives`
  default true but unapproved (decision point).
- Commission bps — unapproved (default 5%).

## 7. Deployment

No deployment executed (no credentials/access). Environment templates and
runbooks: see README. Rollback = revert migration set is NOT allowed (migrations
immutable); use forward-fix migrations.
