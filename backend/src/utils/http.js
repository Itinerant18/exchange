import { AppError } from '../appErrors/AppError.js';

/**
 * Parses page/limit from a query object.
 * - page >= 1, limit between 1 and maxLimit (default 100).
 * - Returns { page, limit, offset }.
 */
export function parsePagination(query, { defaultLimit = 20, maxLimit = 100, defaultPage = 1 } = {}) {
  const pageRaw = query?.page ?? `${defaultPage}`;
  const limitRaw = query?.limit ?? `${defaultLimit}`;

  const page = Number.parseInt(pageRaw, 10);
  const limit = Number.parseInt(limitRaw, 10);

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError('page must be a positive integer.', { statusCode: 400, code: 'INVALID_PAGINATION' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AppError(`limit must be an integer between 1 and ${maxLimit}.`, { statusCode: 400, code: 'INVALID_PAGINATION' });
  }

  return { page, limit, offset: (page - 1) * limit };
}

/** Builds the standard `meta` object for collection responses. */
export function paginationMeta({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Validates that a request body is a plain JSON object (controller-level). */
export function assertObject(body, message = 'The request body must be a JSON object.') {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(message, { statusCode: 400 });
  }
  return body;
}

/** Normalizes a success response envelope: { data, meta? }. */
export function sendData(res, data, { status = 200, meta } = {}) {
  const body = { data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}
