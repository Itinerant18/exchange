const readValue = (value, fallback) => value?.trim() || fallback;

const getFallbackApiUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://127.0.0.1:5000/api/v1';
};

const apiBaseUrl = readValue(
  import.meta.env.VITE_API_BASE_URL,
  getFallbackApiUrl(),
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
  turnstileSiteKey: readValue(import.meta.env.VITE_TURNSTILE_SITEKEY, '0x4AAAAAAF2CZKS04qmu5moS'),
  apiBaseUrl,
  mode: import.meta.env.MODE,
});
