const messages = {
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

  if (code && messages[code]) {
    return messages[code];
  }

  if (typeof errorOrMessage === 'string') return errorOrMessage;
  if (typeof errorOrMessage?.message === 'string') return errorOrMessage.message;

  return 'Something went wrong. Please try again.';
}
