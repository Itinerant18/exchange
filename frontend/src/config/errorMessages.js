/**
 * Central Error Dictionary for Exchange24.
 *
 * Normalizes all error objects, codes, and network exceptions into
 * polished luxury fashion microcopy with actionable client steps.
 */
export const ERROR_MESSAGES = Object.freeze({
  // ── Authentication, Account & Identity ──
  AUTH_INVALID_CREDENTIALS: {
    title: 'Incorrect Credentials',
    message: 'The email or password you entered does not match our records.',
    action: 'Please verify your details or use the password reset link below.',
  },
  INVALID_CREDENTIALS: {
    title: 'Incorrect Credentials',
    message: 'The email or password you entered does not match our records.',
    action: 'Please verify your details or use the password reset link below.',
  },
  AUTH_EMAIL_EXISTS: {
    title: 'Account Already Exists',
    message: 'An account is already registered with this email address.',
    action: 'Sign in to your account, or request a password reset.',
  },
  EMAIL_EXISTS: {
    title: 'Account Already Exists',
    message: 'An account is already registered with this email address.',
    action: 'Sign in to your account, or request a password reset.',
  },
  AUTH_ACCOUNT_SUSPENDED: {
    title: 'Account Inactive',
    message: 'This account has been paused. Please contact our concierge team.',
    action: 'Reach out to concierge@exchange24.site for assistance.',
  },
  AUTH_SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your secure session has timed out.',
    action: 'Please sign in again to continue.',
  },
  UNAUTHORIZED: {
    title: 'Sign In Required',
    message: 'Please sign in to access this feature.',
    action: 'Sign in to continue.',
  },
  FORBIDDEN: {
    title: 'Restricted Access',
    message: 'You do not have permission to view or modify this resource.',
    action: 'Return to the catalog.',
  },
  TURNSTILE_FAILED: {
    title: 'Verification Challenge',
    message: 'Our security verification could not confirm your browser session.',
    action: 'Please complete the verification checkbox to proceed.',
  },
  AUTH_GOOGLE_FAILED: {
    title: 'Google Sign-In Failed',
    message: 'Could not complete Google authentication.',
    action: 'Please verify your Google account or try signing in with email.',
  },
  INVALID_GOOGLE_TOKEN: {
    title: 'Google Token Invalid',
    message: 'The Google credential provided was invalid or has expired.',
    action: 'Please click the Google button to re-authenticate.',
  },
  INVALID_APPLE_TOKEN: {
    title: 'Apple Token Invalid',
    message: 'Apple identity verification could not be validated.',
    action: 'Please try signing in again.',
  },

  // ── Password Reset ──
  PASSWORD_RESET_EMAIL_SENT: {
    title: 'Reset Link Sent',
    message: 'If that email address is registered, we have sent instructions to reset your password.',
    action: 'Please check your spam folder if the email does not arrive in a few minutes.',
  },
  RESET_TOKEN_INVALID: {
    title: 'Reset Link Expired',
    message: 'This password reset link is invalid or has expired.',
    action: 'Please request a fresh reset link.',
  },
  RESET_TOKEN_USED: {
    title: 'Link Already Used',
    message: 'This password reset link has already been used.',
    action: 'Please sign in with your new password.',
  },

  // ── Rental Dates & Sizing ──
  INVENTORY_UNIT_LOCKED: {
    title: 'Garment In Active Checkout',
    message: 'Another client is currently completing checkout for this piece in this size.',
    action: 'Checkout holds release after 15 minutes. Try again shortly or select another size.',
  },
  UNIT_LOCKED: {
    title: 'Garment In Active Checkout',
    message: 'Another client is currently completing checkout for this piece in this size.',
    action: 'Checkout holds release after 15 minutes. Try again shortly or select another size.',
  },
  RENTAL_OVERLAP: {
    title: 'Dates Unavailable',
    message: 'This designer piece is already reserved for your selected dates.',
    action: 'Please choose an alternate delivery date or duration on the calendar.',
  },
  RENTAL_DATES_UNAVAILABLE: {
    title: 'Dates Unavailable',
    message: 'This piece is already reserved for the selected event window.',
    action: 'Please select an alternative date range.',
  },
  INVALID_DATE_RANGE: {
    title: 'Invalid Event Dates',
    message: 'Your return date must occur after your delivery date.',
    action: 'Please select a return date at least 3 days after delivery.',
  },
  INVALID_DURATION: {
    title: 'Duration Below Minimum',
    message: 'Standard occasion rentals require a duration between 3 and 14 days.',
    action: 'Adjust your dates to reserve for 3 to 14 days.',
  },

  // ── Pre-Loved Resale Orders ──
  ORDER_ITEM_SOLD: {
    title: 'Piece Already Claimed',
    message: 'This one-of-a-kind pre-loved piece has just been purchased by another client.',
    action: 'Browse similar designer looks in our catalog.',
  },
  INVENTORY_SOLD_OUT: {
    title: 'Sold Out',
    message: 'This physical garment is no longer available.',
    action: 'Browse our latest arrivals in the catalog.',
  },

  // ── Media & Uploads ──
  MEDIA_IMAGE_TOO_LARGE: {
    title: 'Photograph Exceeds Limit',
    message: 'Garment photographs must be under 15 MB for optimal display quality.',
    action: 'Please select a compressed photo and upload again.',
  },
  MEDIA_VIDEO_TOO_LARGE: {
    title: 'Catwalk Video Exceeds Limit',
    message: 'Runway videos must be under 60 MB.',
    action: 'Please trim your clip to under 30 seconds and upload again.',
  },
  MEDIA_UNSUPPORTED_TYPE: {
    title: 'Unsupported File Format',
    message: 'Please upload JPG, PNG, WebP, or MP4 video files.',
    action: 'Convert your file to a supported format.',
  },

  // ── Profile, Addresses & KYC ──
  PROFILE_NAME_LENGTH: {
    title: 'Display Name Format',
    message: 'Display name must be between 2 and 100 characters.',
    action: 'Please enter your preferred name.',
  },
  PHONE_INVALID: {
    title: 'Invalid Mobile Number',
    message: 'Please provide a valid 10-digit mobile number.',
    action: 'Check the number format and try again.',
  },
  ADDRESS_IN_USE: {
    title: 'Address Required For Active Rental',
    message: 'This address cannot be deleted while an active rental dispatch is scheduled.',
    action: 'Update the address details instead.',
  },

  // ── Network, Rate Limiting & Edge ──
  RATE_LIMITED: {
    title: 'Please Slow Down',
    message: 'You have made several rapid requests.',
    action: 'Please wait a moment before trying again.',
  },
  NETWORK_OFFLINE: {
    title: 'Connection Interrupted',
    message: 'We are unable to reach the Exchange24 network.',
    action: 'Please check your internet connection.',
  },
  SYSTEM_INTERNAL_ERROR: {
    title: 'Runway Pause',
    message: 'We experienced an unexpected server pause while processing your request.',
    action: 'Our concierge engineers have been notified. Please retry shortly.',
  },
  NOT_FOUND: {
    title: 'Not Found',
    message: 'The requested look or resource could not be found.',
    action: 'Return to the catalog.',
  },
});

/**
 * Resolves any thrown error, API response envelope, or code into a structured
 * luxury error representation.
 */
export function resolveErrorMessage(
  errorOrMessage,
  fallback = 'Something unexpected occurred. Please try again.',
) {
  if (!errorOrMessage) {
    return { title: 'Notice', message: fallback, action: null };
  }

  // 1. Direct code lookup
  const code =
    errorOrMessage?.code ||
    errorOrMessage?.response?.data?.error?.code ||
    (typeof errorOrMessage === 'string' && ERROR_MESSAGES[errorOrMessage] ? errorOrMessage : null);

  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  // 2. Network offline check
  if (
    errorOrMessage?.name === 'TypeError' &&
    typeof errorOrMessage?.message === 'string' &&
    (errorOrMessage.message.includes('fetch') || errorOrMessage.message.includes('NetworkError'))
  ) {
    return ERROR_MESSAGES.NETWORK_OFFLINE;
  }

  // 3. String error with clean presentation
  if (typeof errorOrMessage === 'string' && !errorOrMessage.includes('[object') && !errorOrMessage.startsWith('{')) {
    return { title: 'Notice', message: errorOrMessage, action: null };
  }

  // 4. Object message property
  if (
    typeof errorOrMessage?.message === 'string' &&
    !errorOrMessage.message.includes('[object') &&
    !errorOrMessage.message.startsWith('{')
  ) {
    // Check if the message matches known patterns
    if (errorOrMessage.message.includes('LOCKED') || errorOrMessage.message.includes('checkout hold')) {
      return ERROR_MESSAGES.INVENTORY_UNIT_LOCKED;
    }
    return { title: 'Unable to Complete Request', message: errorOrMessage.message, action: null };
  }

  return { title: 'Unable to Complete Request', message: fallback, action: null };
}

/**
 * Convenience helper returning just the message string for simple forms.
 */
export function formatErrorMessage(errorOrMessage, fallback) {
  const resolved = resolveErrorMessage(errorOrMessage, fallback);
  return resolved.message;
}
