import { AppError } from '../appErrors/AppError.js';

export function notFound(req, res, next) {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, {
      statusCode: 404,
      code: 'NOT_FOUND',
    }),
  );
}
