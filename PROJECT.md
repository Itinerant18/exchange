# Project: Exchange Fashion Rental & Circular Resale Platform Integration

## Architecture
- **Backend**: Node.js / Express modular monolith in `exchange/backend`. PostgreSQL database accessed via connection pool (`backend/src/config/database.js`).
- **Frontend**: React 19 / Vite single-page application in `exchange/frontend`. API client in `frontend/src/api/apiClient.js` with centralized endpoints in `frontend/src/api/endpoints.js`.
- **Data Flow & Auth**: JWT-based authentication using short-lived access tokens stored in `localStorage` (`exchnage.accessToken`) and HTTP-only refresh tokens sent as cookies. Silent refresh via `POST /auth/refresh`.
- **Rental Lifecycle**: Listing -> Inventory Units -> Booking (`pending`) -> Provider Accept (`confirmed`) -> Provider Start (`active`) -> Provider Return (`completed`) / Cancel (`cancelled`).

## Code Layout
- `backend/src/app.js`: Express app setup, top-level middleware, and route mounting.
- `backend/src/routes/index.js`: Main API router mounting module routers.
- `backend/src/modules/listings/`: Listings controller, routes, service, repository.
- `backend/src/modules/reviews/`: Reviews controller, routes, service, repository.
- `backend/src/modules/payments/`: Payments controller, routes, service.
- `backend/src/modules/inventory/`: Inventory controller, routes, repository.
- `backend/src/modules/rentals/`: Rental bookings controller, routes, service, repository.
- `backend/src/modules/disputes/`: Disputes controller, routes, service, repository.
- `backend/src/modules/admin/`: Admin controller, routes (audit logs, reports/reconciliation).
- `backend/src/modules/kyc/`: KYC controller, routes, service.
- `frontend/src/api/apiClient.js`: Base HTTP client, interceptors, token refresh, and retry logic.
- `frontend/src/api/endpoints.js`: API endpoint constants.
- `frontend/src/api/listingsApi.js`: Listings API client functions including image uploads.
- `frontend/src/features/rentals/pages/`: `MyBookingsPage.jsx`, `BookingDetailPage.jsx`.
- `frontend/src/features/disputes/pages/`: `DisputesPage.jsx`.
- `frontend/src/features/admin/pages/`: `AdminPage.jsx`.
- `tests/integration/`: Backend integration tests (`backup-size.test.mjs`, `auth.test.mjs`, etc.).
- `scripts/e2e-smoke.mjs`: End-to-end smoke verification script.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Listings Route Ordering | Ensure `GET /listings/mine` matches before `GET /listings/:id` | M1 | Survey (R1) |
| 2 | Reviews Route Ordering & Auth Fix | Ensure `GET /reviews/mine` matches before `GET /reviews/:id` and isolate `authenticate` so public reads return 200 | M1 | Survey (R1) |
| 3 | Payments Endpoint Harmonization | Map `endpoints.payments.intent` to `POST /payments` | M1 | Survey (R1) |
| 4 | Inventory Endpoint Harmonization | Map `endpoints.inventory.items` to `/inventory/items` and `/inventory/items/:id` | M1 | Survey (R1) |
| 5 | Listing Image Upload Base URL | Prepend `appConfig.apiBaseUrl` and handle FormData in `listingsApi.js` | M1 | Survey (R1) |
| 6 | Category Slug/UUID Resolution | Ensure `GET /categories/:idOrSlug` resolves both UUIDs and slugs | M1 | Survey (R1) |
| 7 | Silent Token Refresh & Replay | Implement 401 interceptor in `apiClient.js` with `POST /auth/refresh` and proper header precedence | M1 | Survey (R4) |
| 8 | Security Deposit Display Harmonization | Support `booking.depositAmountPaise ?? booking.depositPaise` in `MyBookingsPage` and `BookingDetailPage` | M2 | Survey (R2) |
| 9 | Dispute Identifier Validation | Validate exactly one of rental booking ID or order ID with explicit selectors in `DisputesPage.jsx` | M2 | Survey (R2) |
| 10 | Dispute Resolution Contract | Align `AdminPage.jsx` payload (`outcome: 'resolve'|'reject'`) with `disputes.service.js` | M2 | Survey (R2) |
| 11 | Booking Provider Action Controls | Implement accept, reject, start, return controls in `BookingDetailPage.jsx` | M2 | Survey (R3) |
| 12 | Listing Owner Mapping in Rentals | Expose `listingOwnerId` in `rentals.repository.js` `mapBookingRow` so providers are recognized | M2 | Survey (R3) |
| 13 | Bookings Role Toggle | Add role toggle (`role=renter` vs `role=provider`) in `MyBookingsPage.jsx` | M2 | Survey (R3) |
| 14 | Admin Dispute, Audit Logs & KYC Views | Add dispute resolution controls, audit logs view, and KYC queue view in `AdminPage.jsx` | M2 | Survey (R3) |
| 15 | Admin Reconciliation Endpoint & View | Verify `GET /admin/reports/reconciliation` backend mounting and frontend display | M2 | Survey (R3) |
| 16 | Inventory Unit Counting Guard | Condition initial unit insertion in `listings.service.js` on `initialInventory === true` or media | M2 | Survey (R5) |
| 17 | Test Regressions Resolution | Pass `tests/integration/backup-size.test.mjs` and `scripts/e2e-smoke.mjs` | M3 | Survey (R5) |
| 18 | Full E2E & Forensic Audit | Run full backend integration tests, frontend build, and forensic integrity verification | M3 | Survey (AC) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Routing, Endpoints & Session Resilience | Features 1-7 (R1, R4) | none | DONE |
| M2 | Contracts, Workflows & Inventory Logic | Features 8-16 (R2, R3, R5) | M1 | DONE |
| M3 | Full E2E Integration & Final Audit | Features 17-18 (R5, All AC) | M1, M2 | DONE |

## Interface Contracts

### Listings Router (`backend/src/modules/listings/listings.routes.js`)
- `GET /mine`: guarded by `authenticate`, returns authenticated user's listings (`listMine`).
- `GET /:id`: accepts UUID, returns listing detail. Returns 400 `INVALID_ID` if not a valid UUID.

### Reviews Router (`backend/src/modules/reviews/reviews.routes.js`)
- `GET /mine`: guarded by `authenticate`, returns authenticated user's reviews.
- `GET /:id`: public read (with `maybeAuthenticate`), returns single review by UUID. Must return 200 without requiring auth headers.

### Payments Router (`backend/src/modules/payments/payments.routes.js`)
- `POST /`: mounted at `/payments`, creates payment intent. Request body `{ bookingId, paymentMethod, amountPaise }`.

### Inventory Router (`backend/src/modules/inventory/inventory.routes.js`)
- `POST /items`: creates inventory unit. Request body `{ listingId, operationalStatus, ... }`.
- `GET /items`: lists inventory items with filters.
- `GET /items/:id`: gets inventory item by UUID.

### Rentals Provider Actions (`backend/src/modules/rentals/rentals.routes.js`)
- `POST /bookings/:id/accept`: provider confirms pending booking.
- `POST /bookings/:id/reject`: provider cancels pending booking.
- `POST /bookings/:id/start`: provider starts confirmed booking (`active`).
- `POST /bookings/:id/return`: provider marks active booking as completed.

### Disputes Resolution (`backend/src/modules/disputes/disputes.service.js`)
- `PATCH /admin/disputes/:id`: request body must contain `{ outcome: 'resolve' | 'reject', resolution: string }`.

### Silent Refresh (`frontend/src/api/apiClient.js`)
- Intercept 401 on non-auth endpoints.
- Request: `POST /auth/refresh` with `credentials: 'include'`.
- Response: `{ success: true, data: { accessToken: string } }`.
- Stored in `localStorage.setItem('exchnage.accessToken', data.accessToken)`.
- Replay: Re-run failed request with refreshed token in `Authorization: Bearer ${newToken}` header, ensuring caller-supplied stale headers do not override it.
