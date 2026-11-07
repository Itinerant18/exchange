/**
 * Central Error Classes and Database Normalizer for Exchange24 Cloudflare Worker.
 *
 * Prevents raw PostgreSQL error stacks and internal identifiers from leaking
 * to the client, converting them into secure, machine-readable domain error codes.
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required to access this resource') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`,
      `${entity} was not found.`,
      404,
      id ? { id } : undefined,
    );
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 409, details);
  }
}

export class LockedResourceError extends AppError {
  constructor(resourceName = 'garment unit', heldUntilMinutes = 15) {
    super(
      'INVENTORY_UNIT_LOCKED',
      `This ${resourceName} is currently held in another active checkout session.`,
      409,
      { heldUntilMinutes },
      true,
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment before trying again.') {
    super('RATE_LIMITED', message, 429, undefined, true);
  }
}

/**
 * Maps raw PostgreSQL SQLSTATE codes into secure, user-friendly AppError instances.
 */
export function normalizeDatabaseError(err: any, fallbackCode = 'DB_OPERATION_FAILED'): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const sqlState = String(err?.code || '');
  const detail = String(err?.detail || '').toLowerCase();
  const constraint = String(err?.constraint || '').toLowerCase();

  // 23505: Unique constraint violation
  if (sqlState === '23505') {
    if (detail.includes('email') || constraint.includes('email')) {
      return new ConflictError('AUTH_EMAIL_EXISTS', 'An account with this email address already exists.');
    }
    if (constraint.includes('user_favorites_pkey')) {
      return new ConflictError('FAVORITE_ALREADY_EXISTS', 'This piece is already in your private wishlist.');
    }
    if (constraint.includes('overlap') || detail.includes('overlap')) {
      return new ConflictError('RENTAL_DATES_UNAVAILABLE', 'This piece is already booked for the selected dates.');
    }
    return new ConflictError('RESOURCE_ALREADY_EXISTS', 'A conflicting record already exists in our system.');
  }

  // 23503: Foreign key violation
  if (sqlState === '23503') {
    return new NotFoundError('Referenced resource');
  }

  // 23514: Check constraint violation
  if (sqlState === '23514') {
    if (constraint.includes('display_name') || detail.includes('display_name')) {
      return new ValidationError('Display name must be between 2 and 100 characters.', { field: 'displayName' });
    }
    if (constraint.includes('email_format') || detail.includes('email')) {
      return new ValidationError('Please enter a valid email address.', { field: 'email' });
    }
    if (constraint.includes('phone') || detail.includes('phone')) {
      return new ValidationError('Please enter a valid mobile number.', { field: 'phoneNumber' });
    }
    return new ValidationError('The submitted data does not meet validation criteria.');
  }

  // 40001: Serialization failure / 40P01: Deadlock detected
  if (sqlState === '40001' || sqlState === '40P01') {
    return new AppError(
      'CONCURRENT_CONFLICT',
      'A concurrent transaction conflict occurred. Please retry your request.',
      409,
      undefined,
      true,
    );
  }

  // Connection errors
  if (
    err?.message?.includes('connection') ||
    err?.message?.includes('ECONNREFUSED') ||
    err?.message?.includes('Hyperdrive')
  ) {
    return new AppError(
      'SYSTEM_DB_UNAVAILABLE',
      'The database service is temporarily resting. Please try again shortly.',
      503,
      undefined,
      true,
    );
  }

  // Safe fallback concealing internal SQL queries
  return new AppError(
    fallbackCode,
    typeof err?.message === 'string' && !err.message.includes('syntax error') && !err.message.includes('SELECT') && !err.message.includes('INSERT')
      ? err.message
      : 'A database operation could not be completed. Please try again.',
    500,
  );
}
