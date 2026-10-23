import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFile, quiet: true });

const errors = [];

function read(name) {
  return process.env[name]?.trim() ?? '';
}

function required(name) {
  const value = read(name);
  if (!value) {
    errors.push(`${name} is required`);
  }
  return value;
}

function optional(name, fallback) {
  return read(name) || fallback;
}

function parseInteger(name, fallback, { min, max }) {
  const raw = optional(name, String(fallback));
  if (!/^\d+$/.test(raw)) {
    errors.push(`${name} must be an integer`);
    return fallback;
  }

  const value = Number(raw);
  if (value < min || value > max) {
    errors.push(`${name} must be between ${min} and ${max}`);
    return fallback;
  }

  return value;
}

function parseBoolean(name, fallback = false) {
  const raw = optional(name, String(fallback)).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  errors.push(`${name} must be either "true" or "false"`);
  return fallback;
}

function parseOrigins(raw) {
  if (!raw) return [];

  const origins = [];
  for (const candidate of raw.split(',').map((value) => value.trim()).filter(Boolean)) {
    if (candidate === '*') {
      errors.push('FRONTEND_URL must contain explicit origins, not "*"');
      continue;
    }

    try {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push(`FRONTEND_URL entry "${candidate}" must use http or https`);
        continue;
      }
      if (url.pathname !== '/' || url.search || url.hash) {
        errors.push(`FRONTEND_URL entry "${candidate}" must be an origin without a path`);
        continue;
      }
      origins.push(url.origin);
    } catch {
      errors.push(`FRONTEND_URL entry "${candidate}" is not a valid URL`);
    }
  }

  return [...new Set(origins)];
}

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

const nodeEnv = optional('NODE_ENV', 'development');
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  errors.push('NODE_ENV must be one of: development, test, production');
}

const host = optional('HOST', '127.0.0.1');
const port = parseInteger('PORT', 5000, { min: 1, max: 65535 });

let apiPrefix = optional('API_PREFIX', '/api/v1').replace(/\/+$/, '');
if (!apiPrefix.startsWith('/') || apiPrefix === '/' || !/^\/[a-zA-Z0-9/_-]+$/.test(apiPrefix)) {
  errors.push('API_PREFIX must start with "/" and contain only letters, numbers, "/", "_" or "-"');
  apiPrefix = '/api/v1';
}

const frontendOrigins = parseOrigins(required('FRONTEND_URL'));
if (nodeEnv === 'production') {
  for (const origin of frontendOrigins) {
    if (new URL(origin).protocol !== 'https:') {
      errors.push('FRONTEND_URL must use https in production');
    }
  }
}

const db = {
  host: required('DB_HOST'),
  port: parseInteger('DB_PORT', 5432, { min: 1, max: 65535 }),
  name: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  ssl: parseBoolean('DB_SSL', false),
  poolMax: parseInteger('DB_POOL_MAX', 10, { min: 1, max: 50 }),
  connectionTimeoutMs: parseInteger('DB_CONNECTION_TIMEOUT_MS', 5000, {
    min: 100,
    max: 60000,
  }),
};

const platformName = optional('PLATFORM_NAME', 'Exchnage');
const platformCurrency = optional('PLATFORM_CURRENCY', 'INR').toUpperCase();
const platformTimezone = optional('PLATFORM_TIMEZONE', 'Asia/Kolkata');

const authJwtSecret = required('AUTH_JWT_SECRET');
if (authJwtSecret.length < 32) {
  errors.push('AUTH_JWT_SECRET must be at least 32 characters long');
}

if (!/^[A-Z]{3}$/.test(platformCurrency)) {
  errors.push('PLATFORM_CURRENCY must be a three-letter currency code');
}
if (!isValidTimezone(platformTimezone)) {
  errors.push('PLATFORM_TIMEZONE must be a valid IANA timezone');
}

if (errors.length > 0) {
  throw new Error(`Invalid environment configuration:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  host,
  port,
  apiPrefix,
  frontendOrigins: Object.freeze(frontendOrigins),
  db: Object.freeze(db),
  auth: Object.freeze({
    jwtSecret: authJwtSecret,
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlDays: 30,
    refreshTokenCookieName: 'exch_refresh',
  }),
  platform: Object.freeze({
    name: platformName,
    currency: platformCurrency,
    timezone: platformTimezone,
  }),
});
