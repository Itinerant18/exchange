export class AppError extends Error {
  constructor(
    message,
    {
      statusCode = 500,
      code = 'INTERNAL_ERROR',
      isOperational = true,
      cause,
    } = {},
  ) {
    super(message, { cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
  }
}
