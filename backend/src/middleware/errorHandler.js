import { env } from '../config/env.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode =
    Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : 500;
  let code = error.isOperational ? error.code || 'INTERNAL_ERROR' : 'INTERNAL_ERROR';
  let message = error.isOperational ? error.message : 'Internal server error';

  if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'The request body is not valid JSON.';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request body is too large.';
  }

  const logEntry = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    message: error.message,
  };

  if (!env.isProduction && statusCode >= 500) {
    logEntry.stack = error.stack;
  }

  if (statusCode >= 500) {
    console.error('[error]', logEntry);
  } else {
    console.warn('[request-rejected]', logEntry);
  }

  const body = {
    error: { code, message },
    requestId: req.id,
  };

  res.status(statusCode).json(body);
}
