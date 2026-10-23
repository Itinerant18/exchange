# Exchnage Foundation Report

- **Status:** Phases 1–3 complete — local infrastructure, backend foundation, and frontend foundation
- **Project root:** `C:\Users\user\Desktop\exchange`
- **Report date:** 22 October 2026

No database tables, migrations, authentication, or business features were added. PostgreSQL, pgAdmin, backend, and frontend were started and verified. The backend and frontend dev servers were stopped after verification; Docker services remain running.

---

## 1. Final folder structure

```text
exchange/
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx
│   │   │   ├── providers.jsx
│   │   │   └── router.jsx
│   │   ├── assets/
│   │   │   ├── fonts/
│   │   │   ├── icons/
│   │   │   └── images/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   └── AppLayout.module.css
│   │   │   ├── forms/
│   │   │   ├── feedback/
│   │   │   └── navigation/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── home/pages/
│   │   │   │   ├── HomePage.jsx
│   │   │   │   └── HomePage.module.css
│   │   │   ├── catalog/
│   │   │   ├── listings/
│   │   │   ├── rentals/
│   │   │   ├── orders/
│   │   │   ├── checkout/
│   │   │   ├── profile/
│   │   │   ├── seller/
│   │   │   ├── reviews/
│   │   │   ├── memberships/
│   │   │   ├── disputes/
│   │   │   └── notifications/
│   │   ├── hooks/
│   │   ├── services/
│   │   │   ├── apiClient.js
│   │   │   └── endpoints.js
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── styles/
│   │   │   ├── reset.css
│   │   │   ├── variables.css
│   │   │   └── global.css
│   │   ├── config/
│   │   │   └── appConfig.js
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── database.js
│   │   │   ├── cors.js
│   │   │   └── platform.js
│   │   ├── routes/
│   │   │   └── index.js
│   │   ├── middleware/
│   │   │   ├── requestId.js
│   │   │   ├── errorHandler.js
│   │   │   ├── notFound.js
│   │   │   └── README.md
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── profiles/
│   │   │   ├── catalog/
│   │   │   ├── listings/
│   │   │   ├── inventory/
│   │   │   ├── rentals/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── deposits/
│   │   │   ├── memberships/
│   │   │   ├── reviews/
│   │   │   ├── inspections/
│   │   │   ├── disputes/
│   │   │   ├── reputation/
│   │   │   ├── notifications/
│   │   │   ├── media/
│   │   │   └── admin/
│   │   ├── jobs/
│   │   ├── utils/
│   │   └── appErrors/
│   │       └── AppError.js
│   ├── database/
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── factories/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   │   └── health.test.js
│   │   └── helpers/
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
├── infrastructure/
│   ├── docker/postgres/
│   ├── scripts/
│   └── README.md
├── docs/
│   ├── architecture.md
│   ├── database-design.md
│   └── api-conventions.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Some module and feature directories are intentionally empty. They define boundaries without pretending the features exist. Empty directories are not tracked by Git until a real file is added.

---

## 2. Files created or modified

Preserved from Phase 1:

- `docker-compose.yml` — PostgreSQL and pgAdmin, pinned images, health checks, volumes, loopback ports.
- `.gitignore`, `.gitattributes`.
- Root `.env` and generated local credentials, ignored by Git.

Created or substantially updated:

- All backend source, configuration, middleware, route, error, and test files.
- All frontend Vite/React source, routing, layout, home shell, CSS tokens, API client, and config files.
- `README.md` — rewritten for the completed foundation.
- `docs/architecture.md` — updated to the implemented structure and phase status.
- `docs/database-design.md` — database principles only; no tables.
- `docs/api-conventions.md` — current API contract and health response.
- `infrastructure/README.md`.
- Root `.env.example` — clarified Compose scope and backend credential synchronization.
- `backend/.env.example`, `frontend/.env.example`.
- `backend/.env` and `frontend/.env` — generated locally and ignored by Git.

All project files were staged. No Git commit was created.

---

## 3. Dependencies installed

### Backend

| Package | Version | Purpose |
|---|---:|---|
| `express` | 5.3.0 | HTTP API framework |
| `cors` | 2.8.6 | Explicit frontend-origin allowlist |
| `dotenv` | 18.0.8 | Load `backend/.env` |
| `pg` | 8.23.1 | PostgreSQL pool and queries |
| Node test runner | Built in | Integration tests; no test dependency added |

### Frontend

| Package | Version | Purpose |
|---|---:|---|
| `react` | 19.3.1 | UI runtime |
| `react-dom` | 19.3.1 | Browser rendering |
| `react-router-dom` | 7.18.4 | Client routing |
| `vite` | 8.3.5 | Development server and production build |
| `@vitejs/plugin-react` | 6.1.2 | React JSX support in Vite |

No TypeScript, ORM, database migration library, UI framework, state manager, or test framework was added.

---

## 4. Environment variables

### Root `.env` — Docker Compose

```env
COMPOSE_PROJECT_NAME=exchnage
POSTGRES_DB=exchnage_dev
POSTGRES_USER=exchnage_app
POSTGRES_PASSWORD=...
POSTGRES_PORT=5432
PGADMIN_DEFAULT_EMAIL=...
PGADMIN_DEFAULT_PASSWORD=...
PGADMIN_PORT=5050
```

### `backend/.env` — API

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
API_PREFIX=/api/v1
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=exchnage_dev
DB_USER=exchnage_app
DB_PASSWORD=...
DB_SSL=false
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000

PLATFORM_NAME=Exchnage
PLATFORM_CURRENCY=INR
PLATFORM_TIMEZONE=Asia/Kolkata
```

### `frontend/.env` — browser-safe values only

```env
VITE_PLATFORM_NAME=Exchnage
VITE_PLATFORM_CURRENCY=INR
VITE_PLATFORM_TIMEZONE=Asia/Kolkata
VITE_API_BASE_URL=http://127.0.0.1:5000/api/v1
```

Important: `DB_PASSWORD` in `backend/.env` must match `POSTGRES_PASSWORD` in the root `.env`. The database name, user, and port must also match. The actual `.env` files are ignored by Git; only the examples are committed.

---

## 5. Exact PowerShell commands

### Start the database and pgAdmin

```powershell
cd C:\Users\user\Desktop\exchange
docker compose up -d
docker compose ps
```

Verify PostgreSQL:

```powershell
docker compose exec -T postgres sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Start the backend

In one terminal:

```powershell
cd C:\Users\user\Desktop\exchange\backend
npm install
npm run dev
```

### Start the frontend

In a second terminal:

```powershell
cd C:\Users\user\Desktop\exchange\frontend
npm install
npm run dev
```

### Open the applications

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:5000/api/v1/health`
- pgAdmin: `http://127.0.0.1:5050`

### Check health

```powershell
curl.exe -s http://127.0.0.1:5000/api/v1/health
```

### Run backend tests

```powershell
cd C:\Users\user\Desktop\exchange\backend
npm test
```

### Build the frontend

```powershell
cd C:\Users\user\Desktop\exchange\frontend
npm run build
```

### Stop

Stop the app servers with `Ctrl+C`.

Stop Docker while keeping data:

```powershell
cd C:\Users\user\Desktop\exchange
docker compose stop
```

`docker compose down -v` is destructive and deletes both database and pgAdmin volumes.

---

## 6. Health check

Endpoint:

```text
GET http://127.0.0.1:5000/api/v1/health
```

Verified response:

```json
{
  "data": {
    "status": "ok",
    "service": "Exchnage API",
    "environment": "development",
    "database": "connected",
    "databaseLatencyMs": 12.6,
    "uptimeSeconds": 2,
    "timestamp": "2026-10-22T04:05:18.669Z"
  }
}
```

The endpoint returns HTTP `503` with `DATABASE_UNAVAILABLE` when PostgreSQL cannot be reached. That path was verified using an unreachable database port:

```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "The database is not available."
  },
  "requestId": "..."
}
```

---

## 7. Test and verification results

| Check | Result |
|---|---|
| Docker Compose configuration | Valid |
| PostgreSQL container | Healthy, accepting connections on `127.0.0.1:5432` |
| pgAdmin container | Running on `127.0.0.1:5050` |
| Application tables | None — `\dt` returned “Did not find any relations” |
| Backend tests | 3 passed, 0 failed |
| Health endpoint | HTTP 200, database connected |
| Allowed-origin CORS | `Access-Control-Allow-Origin: http://localhost:5173` |
| CORS preflight | HTTP 204 with credentials enabled |
| Unknown route | HTTP 404 with consistent error envelope and request ID |
| Frontend production build | Passed; 32 modules transformed |
| Frontend dev server | HTTP 200 at `127.0.0.1:5173` |
| Backend dev server | HTTP 200 at `127.0.0.1:5000` |
| State after verification | App servers stopped; Docker stack still running |

Tested backend cases:

- `GET /api/v1/health` reports API and database readiness.
- An allowed browser origin receives CORS headers.
- An unknown route returns the shared 404 envelope and request ID.

Not verified:

- No automated browser/visual test was run, so the rendered UI was not screenshot-tested. The Vite build, dev server response, and HTML shell were verified.
- pgAdmin server registration has not been completed automatically. It must be added manually using the steps below.
- No authentication, authorization, validation, business endpoint, or database schema tests exist because those features are intentionally not implemented.

---

## 8. Remaining setup tasks

1. Open `http://127.0.0.1:5050` and sign in with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from the root `.env`.
2. Register a pgAdmin server with host `postgres`, port `5432`, database `exchnage_dev`, user `exchnage_app`, and the password from the root `.env`.
3. Confirm the environment assumptions before the next phase:
   - Windows development environment.
   - India / INR / `Asia/Kolkata`.
   - Launch supply model: platform-owned, peer-to-peer, or both.
   - Proposed JWT access-token plus rotating refresh-token authentication approach.
4. Approve Phase 4 before any schema, authentication, or business implementation begins.
5. Optionally create the first Git commit; files are currently staged but uncommitted.

The next phase should begin with an ER review for identity, profiles, roles, permissions, addresses, and sessions. No tables or migrations should be created until that review is approved.

---

## 9. Related documentation

- [Architecture](architecture.md)
- [Database design direction](database-design.md)
- [API conventions](api-conventions.md)
- [Project README](../README.md)
