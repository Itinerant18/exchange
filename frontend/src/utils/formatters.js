/**
 * Money formatting utility. All amounts in backend are stored in paise (1 INR = 100 paise).
 */
export function formatPaiseToRupees(paise, { showDecimals = false } = {}) {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0';
  }
  const num = Number(paise);
  if (!isFinite(num) || num < 0) {
    return '₹0';
  }
  const rupees = num / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

/**
 * Clean human-readable date formatting for rental events.
 */
export function formatDate(dateString, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', opts);
}

/**
 * Format a rental date range, e.g. "Oct 29 – Nov 2, 2026 (4 days)"
 */
export function formatRentalRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return `${startDate} – ${endDate}`;

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startFormatted = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endFormatted = `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;

  return `${startFormatted} – ${endFormatted} (${diffDays} days)`;
}

/**
 * Calculate expected return date given a delivery date and duration (4 or 8 days)
 */
export function calculateReturnDate(deliveryDateStr, durationDays = 4) {
  if (!deliveryDateStr) return '';
  const date = new Date(deliveryDateStr);
  if (isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + Number(durationDays));
  return date.toISOString().split('T')[0];
}

/**
 * Standard aliases for Indian currency formatters
 */
export const paiseToInr = formatPaiseToRupees;
export const formatInr = formatPaiseToRupees;

