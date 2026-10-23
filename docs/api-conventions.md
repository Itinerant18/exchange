# API Conventions

**Status:** foundation only. The only implemented endpoint is the health check.

## Base path

All application endpoints live under:

```text
/api/v1
```

Versioning is part of the URL so breaking changes can be introduced without
silently changing existing clients.

## Format

- Requests and responses use JSON.
- The API does not serve HTML.
- The server sets `X-Request-Id` on responses. A valid client-supplied
  `X-Request-Id` is preserved; otherwise the server generates one.

## Success envelope

Collection and resource responses will use:

```json
{
  "data": {},
  "meta": {}
}
```

`meta` is omitted when it is not needed. A `204 No Content` response has no body.

## Error envelope

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found: GET /api/v1/example"
  },
  "requestId": "..."
}
```

Rules:

- `code` is stable and machine-readable.
- `message` is safe to show to a user.
- Internal SQL errors, stack traces, credentials, and private evidence are never
  returned to clients.
- Server errors are logged with the request ID for correlation.

## Implemented endpoints

| Method | Path | Purpose | Database access |
|--------|------|---------|-----------------|
| `GET` | `/api/v1/health` | API and database readiness | `SELECT 1` only |

Example successful response:

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

If the database cannot be reached, the endpoint returns `503` with
`DATABASE_UNAVAILABLE`. It does not expose connection details.

No business endpoints are implemented or mocked. A route is documented only
when it actually exists.

## Status codes

| Code | Use |
|------|-----|
| `200` | Successful read or update |
| `201` | Resource created |
| `204` | Successful request with no response body |
| `400` | Malformed request or invalid input |
| `401` | Authentication required or invalid |
| `403` | Authenticated but not permitted |
| `404` | Resource or route not found |
| `409` | Conflict such as unavailable inventory |
| `422` | Semantically invalid input |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Dependency unavailable |

## Pagination

Collection endpoints will use bounded pagination. The initial convention is
`page` and `limit`, with a maximum `limit`; this can move to cursor pagination if
large datasets require it. No collection endpoint exists yet.

## Validation and authorization

- Validate path parameters, query strings, and request bodies at the boundary.
- Authentication and authorization middleware are intentionally not implemented
  yet.
- When added, authorization will be enforced by the server for every protected
  operation, not only by the frontend.
- Business rules and money calculations belong in services, never in controllers
  or the browser.

## CORS

- Allowed origins come from `FRONTEND_URL`; wildcard origins are rejected.
- Credentials are enabled, so the origin list must be explicit.
- Requests without an `Origin` header (curl, Postman, server-to-server) are
  allowed.
- Local frontend origins are `http://localhost:5173` and
  `http://127.0.0.1:5173`.

## Documentation

OpenAPI documentation will be introduced after the first real resource
contracts are designed. Until then, this file and the code are the source of
truth.
