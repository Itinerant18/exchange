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

/**
 * Core HTTP request handler with automatic token attachment,
 * credentials handling, and standard error envelope parsing.
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, signal, token } = {}) {
  if (!path.startsWith('/')) {
    throw new Error('API paths must start with "/"');
  }

  const resolvedToken = token ?? localStorage.getItem(STORAGE_TOKEN_KEY);

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

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
