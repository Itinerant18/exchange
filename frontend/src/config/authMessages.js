const MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists',
  INVALID_EMAIL: 'Please enter a valid email address',
  WEAK_PASSWORD: 'Password must be 10–128 characters and include both letters and digits',
  ACCOUNT_NOT_ACTIVE: 'This account is not permitted to sign in',
  INVALID_REFRESH_TOKEN: 'Your session expired. Please sign in again',
  NOT_FOUND: 'That account was not found',
  UNAUTHENTICATED: 'Please sign in to continue',
  FORBIDDEN: 'You do not have permission to do that',

  // Password reset
  PASSWORD_RESET_EMAIL_SENT: 'If that email is registered, we sent password reset instructions.',
  RESET_TOKEN_INVALID: 'That reset link is invalid or has expired. Please request a new one.',
  RESET_TOKEN_USED: 'That reset link was already used. Please request a new one.',
  NEW_PASSWORD_WEAK: 'New password must be 10–128 characters and include both letters and digits.',

  // Profile / account
  PROFILE_SAVE_FAILED: 'Could not save profile changes. Please try again.',
  PHONE_INVALID: 'Please enter a valid phone number.',
  DISPLAY_NAME_INVALID: 'Display name must be between 2 and 100 characters.',
};

export function authErrorMessage(errorOrMessage) {
  if (!errorOrMessage) return '';

  const code =
    errorOrMessage?.code ?? errorOrMessage?.response?.data?.error?.code ?? null;

  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }

  if (typeof errorOrMessage === 'string') return errorOrMessage;
  if (typeof errorOrMessage?.message === 'string') return errorOrMessage.message;

  return 'Something went wrong. Please try again.';
}

const _authTitles = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_REGISTERED: 'Email already registered',
  INVALID_EMAIL: 'Invalid email',
  WEAK_PASSWORD: 'Password too weak',
  ACCOUNT_NOT_ACTIVE: 'Account not active',
  INVALID_REFRESH_TOKEN: 'Session expired',
  NOT_FOUND: 'Not found',
  UNAUTHENTICATED: 'Session expired',
  FORBIDDEN: 'Not allowed',
  PASSWORD_RESET_EMAIL_SENT: 'Reset link sent',
  RESET_TOKEN_INVALID: 'Invalid reset link',
  RESET_TOKEN_USED: 'Reset link already used',
  NEW_PASSWORD_WEAK: 'Password too weak',
  PROFILE_SAVE_FAILED: 'Profile update failed',
  PHONE_INVALID: 'Phone number invalid',
  DISPLAY_NAME_INVALID: 'Display name invalid',
};

const _authDetails = {
  INVALID_CREDENTIALS: 'Check your email and password and try again.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
  INVALID_EMAIL: 'Enter a valid email address.',
  WEAK_PASSWORD: 'Use at least 10 characters with both letters and digits.',
  ACCOUNT_NOT_ACTIVE: 'Your account has not been activated yet. Check your email for an activation link.',
  INVALID_REFRESH_TOKEN: 'Please sign in again to continue.',
  NOT_FOUND: 'The requested account was not found.',
  UNAUTHENTICATED: 'Please sign in again to continue.',
  FORBIDDEN: 'You do not have permission to do that.',
  PASSWORD_RESET_EMAIL_SENT: 'If the email exists, a password reset link was sent.',
  RESET_TOKEN_INVALID: 'The password reset link is not valid or has expired. Request a new one.',
  RESET_TOKEN_USED: 'This password reset link has already been used. Request a new one.',
  NEW_PASSWORD_WEAK: 'New password must be 10–128 characters and include both letters and digits.',
  PROFILE_SAVE_FAILED: 'Could not save your profile changes. Please try again.',
  PHONE_INVALID: 'Enter a valid phone number.',
  DISPLAY_NAME_INVALID: 'Display name must be between 2 and 100 characters.',
};

export const authUIText = Object.freeze({
  title: (code) => _authTitles[code] ?? 'Something went wrong',
  detail: (code) => _authDetails[code] ?? 'An unexpected error occurred. Please try again.',
});

export { MESSAGES };
