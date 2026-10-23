# Middleware

Implemented now:

- `requestId.js` — assigns a request ID and returns it in `X-Request-Id`.
- `notFound.js` — creates a consistent 404 for unmatched routes.
- `errorHandler.js` — centralized safe error responses and server-side logging.

Intentionally pending:

- `authenticate.js`
- `authorize.js`
- `validateRequest.js`

They are not implemented or mounted yet because authentication, role checks,
and a request-validation library are outside this phase. Adding middleware that
only appears to protect routes would be misleading. They will be implemented
with real server-side checks when authentication and business endpoints are
introduced.
