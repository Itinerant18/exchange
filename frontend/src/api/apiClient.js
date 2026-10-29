import { appConfig } from '../config/appConfig.js';

export class ApiError extends Error {
  constructor(message, { status, code, requestId, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

const STORAGE_TOKEN_KEY = 'exchnage.accessToken';

let isRefreshing = null;

function shouldSkipRefresh(path) {
  const pathname = path.split('?')[0];
  if (pathname === '/auth/me') return false;
  return pathname.startsWith('/auth/');
}

async function requestNewAccessToken() {
  if (isRefreshing) return isRefreshing;

  isRefreshing = (async () => {
    try {
      const res = await fetch(`${appConfig.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      const newToken = data?.data?.accessToken;
      if (newToken) {
        localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
        return newToken;
      }
      throw new Error('No token returned');
    } catch (err) {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      throw err;
    } finally {
      isRefreshing = null;
    }
  })();

  return isRefreshing;
}

/**
 * Core HTTP request handler with automatic token attachment,
 * credentials handling, silent token refresh, and standard error envelope parsing.
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, signal, token, _isRetry = false } = {}) {
  if (!path.startsWith('/')) {
    throw new Error('API paths must start with "/"');
  }

  let callerToken = token;
  const sanitizedHeaders = { ...headers };
  for (const [key, value] of Object.entries(sanitizedHeaders)) {
    if (key.toLowerCase() === 'authorization') {
      delete sanitizedHeaders[key];
      if (!callerToken && typeof value === 'string') {
        const match = value.match(/^Bearer\s+(.+)$/i);
        if (match) callerToken = match[1];
      }
    }
  }

  const resolvedToken = callerToken ?? localStorage.getItem(STORAGE_TOKEN_KEY);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const requestHeaders = {
    Accept: 'application/json',
    ...(body === undefined || isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...sanitizedHeaders,
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };

  const serializedBody =
    body === undefined || typeof body === 'string' || isFormData
      ? body
      : JSON.stringify(body);

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: serializedBody,
    signal,
  });

  // Handle silent token refresh on 401 if refresh cookie is valid and not already retried
  if (response.status === 401 && !_isRetry && !shouldSkipRefresh(path)) {
    try {
      const currentStoredToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      let refreshedToken = null;

      if (currentStoredToken && resolvedToken && currentStoredToken !== resolvedToken) {
        refreshedToken = currentStoredToken;
      } else {
        refreshedToken = await requestNewAccessToken();
      }

      if (refreshedToken) {
        return apiRequest(path, {
          method,
          body,
          headers: sanitizedHeaders,
          signal,
          token: refreshedToken,
          _isRetry: true,
        });
      }
    } catch {
      // Fall through to standard error handler
    }
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const errorData = payload?.error;
    throw new ApiError(errorData?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: errorData?.code,
      requestId: payload?.requestId || response.headers.get('x-request-id'),
      details: errorData?.details,
    });
  }

  // The backend wraps successful responses in { data, meta }
  // Return the full payload if meta is present so pagination works seamlessly
  if (payload && 'data' in payload) {
    if ('meta' in payload) {
      return payload;
    }
    return payload.data;
  }

  return payload;
}

export const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiRequest(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => apiRequest(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
};
