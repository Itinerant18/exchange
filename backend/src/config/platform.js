import { env } from './env.js';

/**
 * Platform-facing configuration. Components should read brand values from
 * here instead of embedding the brand name in controllers or views.
 */
export const platform = Object.freeze({
  name: env.platform.name,
  currency: env.platform.currency,
  timezone: env.platform.timezone,
  apiServiceName: `${env.platform.name} API`,
});
