const readValue = (value, fallback) => value?.trim() || fallback;

export const getApiBaseUrl = () => {
  const envVal = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envVal) return envVal.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return '/api/v1';
};

/**
 * Central browser-side configuration. Only values prefixed with VITE_ are
 * exposed to the browser, so never place secrets in Vite environment files.
 */
export const appConfig = Object.freeze({
  name: readValue(import.meta.env.VITE_PLATFORM_NAME, 'Exchange24'),
  currency: readValue(import.meta.env.VITE_PLATFORM_CURRENCY, 'INR'),
  timezone: readValue(import.meta.env.VITE_PLATFORM_TIMEZONE, 'Asia/Kolkata'),
  turnstileSiteKey: readValue(import.meta.env.VITE_TURNSTILE_SITEKEY, '0x4AAAAAAF2CZKS04qmu5moS'),
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  mode: import.meta.env.MODE,
});
