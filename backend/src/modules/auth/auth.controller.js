import { AppError } from '../../appErrors/AppError.js';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';
import * as passwordResetService from './passwordReset.service.js';

const COOKIE_NAME = env.auth.refreshTokenCookieName;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: `${env.apiPrefix}/auth`,
    maxAge: env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  };
}

const clearCookieOptions = () => ({ ...refreshCookieOptions(), maxAge: 0 });

function issueCookie(res, refreshToken) {
  res.cookie(COOKIE_NAME, refreshToken, refreshCookieOptions());
}

export async function register(req, res, next) {
  try {
    const body = req.body ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = body.password;
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;

    if (!EMAIL_PATTERN.test(email) || email.length > 255) {
      throw new AppError('A valid email address is required.', { statusCode: 400, code: 'INVALID_EMAIL' });
    }
    if (displayName && (displayName.length < 2 || displayName.length > 100)) {
      throw new AppError('displayName must be between 2 and 100 characters.', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    if (typeof password !== 'string') {
      throw new AppError('Password is required.', { statusCode: 400, code: 'WEAK_PASSWORD' });
    }

    const result = await authService.registerUser({ email, password, displayName });
    issueCookie(res, result.refreshToken);

    res.status(201).json({
      data: { user: result.user, accessToken: result.accessToken, tokenType: 'Bearer' },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new AppError('Email and password are required.', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const result = await authService.login({ email, password });
    issueCookie(res, result.refreshToken);
    res.status(200).json({
      data: { user: result.user, accessToken: result.accessToken, tokenType: 'Bearer' },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const result = await authService.refreshSession(token ?? null);
    issueCookie(res, result.refreshToken);
    res.status(200).json({
      data: { user: result.user, accessToken: result.accessToken, tokenType: 'Bearer' },
    });
  } catch (error) {
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    await authService.logout(token ?? null);
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.authUser.id);
    if (!user) {
      throw new AppError('User not found.', { statusCode: 404, code: 'NOT_FOUND' });
    }
    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const body = req.body ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const result = await passwordResetService.requestPasswordReset({ email });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const body = req.body ?? {};
    const result = await passwordResetService.resetPassword({
      token: body.token,
      newPassword: body.newPassword,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
