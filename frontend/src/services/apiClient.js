import { appConfig } from '../config/appConfig.js';

export class ApiError extends Error {
  constructor(message, { status, code, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Small shared fetch wrapper. Feature services will call this later; it is not
 * used for business requests in the foundation phase.
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, signal } = {}) {
  if (!path.startsWith('/')) {
    throw new Error('API paths must start with "/"');
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: payload?.error?.code,
      requestId: payload?.requestId || response.headers.get('x-request-id'),
    });
  }

  return payload?.data ?? payload;
}
