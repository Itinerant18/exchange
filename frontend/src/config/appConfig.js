const readValue = (value, fallback) => value?.trim() || fallback;

const apiBaseUrl = readValue(
  import.meta.env.VITE_API_BASE_URL,
  'http://127.0.0.1:5000/api/v1',
).replace(/\/+$/, '');

try {
  new URL(apiBaseUrl);
} catch {
  throw new Error('VITE_API_BASE_URL must be a valid absolute URL');
}

/**
 * Central browser-side configuration. Only values prefixed with VITE_ are
 * exposed to the browser, so never place secrets in Vite environment files.
 */
export const appConfig = Object.freeze({
  name: readValue(import.meta.env.VITE_PLATFORM_NAME, 'Exchnage'),
  currency: readValue(import.meta.env.VITE_PLATFORM_CURRENCY, 'INR'),
  timezone: readValue(import.meta.env.VITE_PLATFORM_TIMEZONE, 'Asia/Kolkata'),
  apiBaseUrl,
  mode: import.meta.env.MODE,
});
