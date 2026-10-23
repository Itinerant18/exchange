# Exchnage

A fashion rental, resale, and circular-fashion marketplace for Gen Z and young
adults. People will be able to rent occasion wear, buy and sell pre-owned
pieces, and build trust through verified transactions.

“Exchnage” is the current placeholder brand. Brand name, currency, timezone,
and theme values are centralized so the brand can be changed without rewriting
feature code. The local folder is currently named `exchange`; that does not
affect the application.

## Current status

**Backend complete; frontend foundation only.** Full details, schemas, endpoint
list, and test results live in [docs/project-status.md](docs/project-status.md).

Implemented so far:

- PostgreSQL 17.11 and pgAdmin 9.18 in Docker, with pinned images and
  persistent volumes.
- **Database schema, migrations 001–007**: identity/auth, catalog, inventory +
  rentals (GiST overlap exclusion), sales (sale-claim unique index), finance
  (payments, payment events, security deposits, refunds), trust & admin (KYC,
  reviews, audit logs). Applied and idempotency-verified in `exchnage_dev`.
- Express 5 API covering **auth, users, categories, listings, inventory,
  rentals, orders, payments, deposits, refunds, reviews, KYC, and admin audit
  logs** with JWT access tokens, rotating hashed refresh cookies, scrypt
  passwords, RBAC (`customer`/`seller`/`admin`), audit logging, and a uniform
  error envelope.
- Migration runner (`npm run db:migrate`), admin-promotion CLI
  (`npm run admin:grant`), and an end-to-end smoke script
  (`backend/scripts/e2e-smoke.mjs`, 51 checks passing).
- Isolated-database integration tests (`backend/tests`) — running; see the
  status report for per-file results.
- React 19 + Vite 8 foundation shell (router, API client, design tokens) with
  no marketplace UI yet.

Deliberately open: real payment-provider integration, commission accounting,
remaining test files, and the frontend feature build. See
[docs/project-status.md](docs/project-status.md) §10.

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, JavaScript/JSX, React Router, CSS Modules, global CSS variables |
| Backend | Node.js, Express 5, ES modules, `pg` |
| Database | PostgreSQL 17 in Docker |
| Database UI | pgAdmin 4 in Docker, local development only |
| Infrastructure | Docker Compose |
| Tests | Node.js built-in test runner, native `fetch` |

No TypeScript, Next.js, NestJS, ORM, MongoDB, Redux, or microservices are used.

## Architecture at a glance

```text
Browser
  |
  | http://127.0.0.1:5173
  v
React SPA (Vite)
  |
  | REST JSON, /api/v1
  v
Express API (modular monolith)
  |
  | parameterized SQL via pg
  v
PostgreSQL (Docker, 127.0.0.1:5432)

pgAdmin (Docker) --> PostgreSQL        # development administration only
```

- React never connects to PostgreSQL.
- Express is the only application layer with database access.
- Business rules, prices, permissions, and availability will be enforced on the
  server.
- pgAdmin is a database administration client, not the database.

## Repository layout

```text
exchange/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                 # App.jsx, router.jsx, providers.jsx
│   │   ├── assets/              # images, icons, fonts
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/          # AppLayout + module CSS
│   │   │   ├── forms/
│   │   │   ├── feedback/
│   │   │   └── navigation/
│   │   ├── features/            # auth, home, catalog, listings, rentals, ...
│   │   ├── hooks/
│   │   ├── services/            # apiClient.js, endpoints.js
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── styles/              # reset.css, variables.css, global.css
│   │   ├── config/              # appConfig.js
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/              # env, database, cors, platform
│   │   ├── routes/              # /api/v1 router
│   │   ├── middleware/          # request ID, errors, not found
│   │   ├── modules/             # empty feature boundaries
│   │   ├── jobs/
│   │   ├── utils/
│   │   └── appErrors/
│   ├── database/
│   │   ├── migrations/          # intentionally empty until approved
│   │   ├── seeds/
│   │   └── factories/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── helpers/
│   ├── .env.example
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

Some feature/module directories are intentionally empty. They establish
boundaries without pretending the features exist. Empty directories are not
tracked by Git until a real file is added.

## Prerequisites

- Windows 10/11 with Docker Desktop using the WSL 2 backend, or Ubuntu with
  Docker Engine and the Compose plugin.
- Node.js 22 or newer (Node 24 is installed in this workspace).
- npm 10 or newer.
- Git.
- PowerShell on Windows.

Check:

```powershell
docker --version
docker compose version
node --version
npm --version
git --version
```

Start Docker Desktop and wait for the engine:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker info
```

If the path is different, start Docker Desktop from the Start menu.

## Environment configuration

Three environment files are used. None of them is committed.

### 1. Root `.env` — Docker Compose and PostgreSQL credentials

```powershell
Copy-Item .env.example .env
notepad .env
```

Required values:

```dotenv
COMPOSE_PROJECT_NAME=exchnage
POSTGRES_DB=exchnage_dev
POSTGRES_USER=exchnage_app
POSTGRES_PASSWORD=replace-with-a-long-random-password
POSTGRES_PORT=5432
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=replace-with-a-long-random-password
PGADMIN_PORT=5050
```

This workspace already has a generated `.env` with random local credentials.

### 2. `backend/.env` — API and database connection

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

Set `DB_PASSWORD` to the same value as `POSTGRES_PASSWORD` in the root `.env`.
Also keep `DB_PORT`, `DB_NAME`, and `DB_USER` consistent with the root values.

The backend runs on the host, so it uses `DB_HOST=127.0.0.1`. If the backend is
later run inside Docker on the Compose network, its host becomes `postgres`.

### 3. `frontend/.env` — browser-safe Vite configuration

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Only variables prefixed with `VITE_` may be used by the browser. Never put
database credentials, JWT secrets, or payment keys in the frontend environment.

```dotenv
VITE_PLATFORM_NAME=Exchnage
VITE_PLATFORM_CURRENCY=INR
VITE_PLATFORM_TIMEZONE=Asia/Kolkata
VITE_API_BASE_URL=http://127.0.0.1:5000/api/v1
```

The API base URL includes `/api/v1`.

## Start the database

From the project root:

```powershell
docker compose config
docker compose up -d
docker compose ps
```

Expected status:

```text
exchnage-postgres-1   postgres:17.11-alpine   Up ... (healthy)   127.0.0.1:5432->5432/tcp
exchnage-pgadmin-1    dpage/pgadmin4:9.18.0   Up ...             127.0.0.1:5050->80/tcp
```

Verify database readiness:

```powershell
docker compose exec -T postgres sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Expected:

```text
127.0.0.1:5432 - accepting connections
```

No application tables exist yet. That is expected.

## Connect pgAdmin

1. Open `http://127.0.0.1:5050`.
2. Sign in with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from the
   root `.env`.
3. Register a server:
   - **Name:** `Exchnage Local`
   - **Host:** `postgres`
   - **Port:** `5432`
   - **Maintenance database:** `POSTGRES_DB` from `.env` (currently `exchnage_dev`)
   - **Username:** `POSTGRES_USER` from `.env` (currently `exchnage_app`)
   - **Password:** `POSTGRES_PASSWORD` from the root `.env`
4. Save and expand `Databases` → the database named by `POSTGRES_DB`.

Use `postgres`, not `localhost`, as the hostname inside pgAdmin. Inside the
pgAdmin container, `localhost` refers to pgAdmin itself. The backend on Windows
uses `127.0.0.1:5432` instead.

## Install and start the backend

```powershell
cd backend
npm install
npm run dev
```

For a clean, reproducible install from `package-lock.json`:

```powershell
npm ci
```

Expected startup output:

```text
[server] Exchnage API listening on http://127.0.0.1:5000
[server] Health: http://127.0.0.1:5000/api/v1/health
[server] Environment: development
```

Health check:

```powershell
curl.exe -s http://127.0.0.1:5000/api/v1/health
```

Example response:

```json
{
  "data": {
    "status": "ok",
    "service": "Exchnage API",
    "environment": "development",
    "database": "connected",
    "databaseLatencyMs": 3.7,
    "uptimeSeconds": 9,
    "timestamp": "2026-10-22T04:00:09.059Z"
  }
}
```

If PostgreSQL is unavailable, the endpoint returns HTTP `503` with
`DATABASE_UNAVAILABLE` rather than exposing connection details.

Run backend tests:

```powershell
npm test
```

The current tests are read-only and use the development database only for
`SELECT 1`. A separate test database will be introduced with the first schema.

## Install and start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The foundation shell displays the configured brand name. It does not call the
API yet; the shared client is prepared for later features.

Build check:

```powershell
npm run build
npm run preview
```

Preview runs at `http://127.0.0.1:4173`.

## Local ports

| Host port | Container port | Service | Purpose |
|-----------|----------------|---------|---------|
| `5000` | — | Express API | `http://127.0.0.1:5000/api/v1` |
| `5173` | — | Vite dev server | `http://127.0.0.1:5173` |
| `5432` | `5432` | PostgreSQL | Host access through `127.0.0.1`; containers use `postgres:5432` |
| `5050` | `80` | pgAdmin | `http://127.0.0.1:5050` |

Only the Docker ports are published, and both are bound to `127.0.0.1`, not
`0.0.0.0`.

## Common commands

From the project root:

```powershell
docker compose up -d          # start database and pgAdmin
docker compose ps             # status
docker compose stop           # stop containers, keep data
docker compose down           # remove containers/network, keep volumes
docker compose logs -f postgres
docker compose logs -f pgadmin
docker compose restart
```

Backend:

```powershell
cd backend
npm run dev                   # node --watch src/server.js
npm start                     # production-style start
npm test                      # integration tests
```

Frontend:

```powershell
cd frontend
npm run dev
npm run build
npm run preview
```

Stop backend/frontend with `Ctrl+C`.

## Database persistence, backup, and reset

PostgreSQL data lives in the named volume `exchnage_postgres_data`; pgAdmin
settings live in `exchnage_pgadmin_data`.

- `docker compose down` preserves both volumes.
- `docker compose down -v` deletes both volumes and all local database data.
- Changing `POSTGRES_*` values in `.env` does not modify an already initialized
  database volume. Reset the volume or alter the role intentionally.

Back up:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/exchnage.dump'
docker compose cp postgres:/tmp/exchnage.dump .\backups\exchnage.dump
docker compose exec postgres rm -f /tmp/exchnage.dump
```

Restore after stopping the API:

```powershell
docker compose cp .\backups\exchnage.dump postgres:/tmp/exchnage-restore.dump
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/exchnage-restore.dump'
docker compose exec postgres rm -f /tmp/exchnage-restore.dump
```

Reset the local database:

```powershell
# Destructive: removes the database and pgAdmin volumes.
docker compose down -v
docker compose up -d
```

`backups/` and dump files are ignored by Git.

## Configuration notes

### Backend environment

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development`, `test`, or `production` |
| `HOST` | API bind host; `127.0.0.1` locally |
| `PORT` | API port; `5000` |
| `API_PREFIX` | `/api/v1` |
| `FRONTEND_URL` | Comma-separated allowed CORS origins |
| `DB_HOST` | `127.0.0.1` for host-run backend |
| `DB_PORT` | `5432` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL credentials |
| `DB_SSL` | `false` locally |
| `DB_POOL_MAX` | Connection pool ceiling |
| `DB_CONNECTION_TIMEOUT_MS` | Connection timeout |
| `PLATFORM_NAME` | Brand name |
| `PLATFORM_CURRENCY` | `INR` |
| `PLATFORM_TIMEZONE` | `Asia/Kolkata` |

Invalid or missing values cause a clear startup error. Secrets are never logged
by the configuration module.

### Frontend environment

| Variable | Purpose |
|----------|---------|
| `VITE_PLATFORM_NAME` | Brand name rendered by React |
| `VITE_PLATFORM_CURRENCY` | Display currency |
| `VITE_PLATFORM_TIMEZONE` | Business timezone |
| `VITE_API_BASE_URL` | Express API base URL including `/api/v1` |

### Branding

- Backend platform values are centralized in `backend/src/config/platform.js`.
- Frontend values are centralized in `frontend/src/config/appConfig.js` and CSS
  custom properties in `frontend/src/styles/variables.css`.
- The HTML `<title>` is a fallback; React applies the configured brand name at
  runtime.
- Do not scatter the brand name through feature components.

## Current middleware status

Implemented:

- request ID
- centralized error handling
- not-found handling

Pending and intentionally not mounted:

- `authenticate`
- `authorize`
- `validateRequest`

They will be added with real server-side checks when authentication and business
resources are implemented. See `backend/src/middleware/README.md`.

## Troubleshooting

**Docker engine is not running**

Start Docker Desktop and wait for `docker info` to succeed.

**Port 5432 or 5050 is already allocated**

Change `POSTGRES_PORT` or `PGADMIN_PORT` in the root `.env`, then
`docker compose up -d`. Update `DB_PORT` in `backend/.env` if the PostgreSQL
host port changes. pgAdmin still uses `postgres:5432` inside Docker.

**Backend fails with an environment error**

Read the named missing/invalid variables. Copy `backend/.env.example` to
`backend/.env` and make sure `DB_PASSWORD` matches the root `.env` value.
Never commit the real file.

**Health endpoint returns 503**

Check:

```powershell
docker compose ps
docker compose logs --tail=100 postgres
```

Make sure the backend's `DB_HOST`, port, database name, user, and password point
at the running container.

**pgAdmin cannot connect**

Use host `postgres`, port `5432`, and the credentials from the root `.env`.
Confirm PostgreSQL is `(healthy)`.

**Frontend starts on a different port**

The Vite config uses `strictPort: true`. If `5173` is occupied, stop the other
process instead of silently changing ports; CORS is configured for `5173`.

**Changed `.env` credentials but login still fails**

PostgreSQL and pgAdmin initialize their volumes on first start. Changing
environment values does not rewrite an existing database cluster or pgAdmin
login. Reset the relevant volume after backing up, or alter the role/password
through PostgreSQL.

## Documentation

- [Project status report (schemas, relations, endpoints, test results)](docs/project-status.md)
- [Architecture](docs/architecture.md)
- [Database design direction](docs/database-design.md)
- [API conventions](docs/api-conventions.md)

## Next phase

The next phase requires explicit approval. It should start with an ER review for
identity, profiles, roles, permissions, addresses, and sessions. Only after that
review should migration tooling and the first schema migration be added.

No authentication, business features, or database tables should be implemented
before that approval.
