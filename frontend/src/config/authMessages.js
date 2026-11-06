import { resolveErrorMessage, formatErrorMessage, ERROR_MESSAGES } from './errorMessages.js';

export function authErrorMessage(errorOrMessage) {
  if (!errorOrMessage) return '';
  return formatErrorMessage(errorOrMessage, 'Something went wrong. Please try again.');
}

const MESSAGES = ERROR_MESSAGES;

export const authUIText = Object.freeze({
  title: (code) => resolveErrorMessage(code).title,
  detail: (code) => resolveErrorMessage(code).message,
});

export { MESSAGES, resolveErrorMessage, formatErrorMessage };
