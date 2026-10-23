// In-memory fixed-window rate limiter. Single-process only; production should
// swap in a shared store (Redis) — documented in project-status.md.
const buckets = new Map();

function clientKey(req) {
  return (req.ip || req.socket?.remoteAddress || 'unknown').toString();
}

export function createRateLimiter({ windowMs, max, keyPrefix = '' }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${clientKey(req)}`;
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.start + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      });
    }
    return next();
  };
}

// Sweep stale buckets occasionally to bound memory.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > 10 * 60 * 1000) buckets.delete(key);
  }
}, 60 * 1000).unref();
