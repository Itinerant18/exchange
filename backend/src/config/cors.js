import { env } from './env.js';

const allowedOrigins = new Set(env.frontendOrigins);

export const corsOptions = Object.freeze({
  origin(origin, callback) {
    // Requests without an Origin header come from curl, Postman, or
    // server-to-server clients. Browser CORS checks only apply to origins.
    if (!origin) {
      return callback(null, true);
    }
    return callback(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
  optionsSuccessStatus: 204,
});
