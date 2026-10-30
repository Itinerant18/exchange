import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Utilities under test
import {
  formatPaiseToRupees,
  formatDate,
  formatRentalRange,
  calculateReturnDate,
} from '../src/utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_ROOT, 'src');

/* ============================================================================
 * SECTION 1: SIZING MATRIX STRESS TESTS
 * ============================================================================
 */
describe('Section 1: Sizing Matrix Stress Tests', () => {
  // Test sizing availability resolution logic from ListingDetailPage
  function resolveAvailableSizes(listing) {
    const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
    const listingSize = listing?.size;
    if (listing?.availableSizes && Array.isArray(listing.availableSizes) && listing.availableSizes.length > 0) {
      return listing.availableSizes;
    }
    if (listingSize && !STANDARD_SIZES.includes(listingSize)) {
      return [listingSize, ...STANDARD_SIZES];
    }
    return STANDARD_SIZES;
  }

  test('1.1: Standard size listing defaults to 5 atelier sizes [XS, S, M, L, XL]', () => {
    const sizes = resolveAvailableSizes({ size: 'M' });
    assert.deepEqual(sizes, ['XS', 'S', 'M', 'L', 'XL']);
  });

  test('1.2: Custom couture size (e.g. "Couture 38" or "One Size") prepends custom size to standard sizes', () => {
    const sizes = resolveAvailableSizes({ size: 'Couture 38' });
    assert.deepEqual(sizes, ['Couture 38', 'XS', 'S', 'M', 'L', 'XL']);
  });

  test('1.3: Explicit multi-size array overrides default atelier list', () => {
    const customList = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    const sizes = resolveAvailableSizes({ size: 'XXS', availableSizes: customList });
    assert.deepEqual(sizes, customList);
  });

  test('1.4: Single-size exclusive listing returns strictly single-size array', () => {
    const sizes = resolveAvailableSizes({ size: 'Bespoke', availableSizes: ['Bespoke'] });
    assert.deepEqual(sizes, ['Bespoke']);
  });

  test('1.5: Backup size selector state logic prevents primary === backup', () => {
    let primarySize = 'M';
    let backupSize = 'L';

    // Simulate selecting 'M' as backup when primary is 'M'
    const isSameAsPrimary = (candidate) => candidate === primarySize;
    assert.equal(isSameAsPrimary('M'), true, 'Primary size chip must be disabled in backup row');
    assert.equal(isSameAsPrimary('L'), false, 'Non-primary size chip must be enabled');

    // Simulate changing primarySize to 'L' (which currently matches backupSize)
    function onPrimarySizeChange(newSize) {
      primarySize = newSize;
      if (backupSize === newSize) {
        backupSize = '';
      }
    }

    onPrimarySizeChange('L');
    assert.equal(primarySize, 'L');
    assert.equal(backupSize, '', 'Backup size must auto-clear when primary size changes to match it');
  });

  test('1.6: Single-size listing disables backup size selection and leaves only "None"', () => {
    const singleSizes = ['M'];
    const primarySize = 'M';
    let backupSize = '';

    const backupOptions = singleSizes.map((s) => ({
      size: s,
      disabled: s === primarySize,
    }));

    assert.equal(backupOptions.length, 1);
    assert.equal(backupOptions[0].disabled, true, 'Single size must be disabled in backup row');
    assert.equal(backupSize, '', 'Backup size remains None ("")');
  });

  test('1.7: Extreme size options (XXS, 6XL, Numeric, One Size) pass without error', () => {
    const extremeSizes = ['XXS', '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '4XL', '5XL', '6XL', 'One Size'];
    const sizes = resolveAvailableSizes({ availableSizes: extremeSizes });
    assert.equal(sizes.length, 16);
    assert.ok(sizes.includes('XXS'));
    assert.ok(sizes.includes('6XL'));
    assert.ok(sizes.includes('One Size'));
  });
});

/* ============================================================================
 * SECTION 2: RENTAL DURATION AND DATE BOUNDARIES
 * ============================================================================
 */
describe('Section 2: Rental Duration and Date Boundaries', () => {
  test('2.1: 4-day and 8-day booking slots produce exact day offsets', () => {
    const base = '2026-11-10';
    const return4 = calculateReturnDate(base, 4);
    const return8 = calculateReturnDate(base, 8);

    assert.equal(return4, '2026-11-14');
    assert.equal(return8, '2026-11-18');
  });

  test('2.2: Month boundary with 31 days (March -> April)', () => {
    // March has 31 days. March 29 + 4 days -> April 2.
    const res = calculateReturnDate('2026-03-29', 4);
    assert.equal(res, '2026-04-02');

    // March 29 + 8 days -> April 6.
    const res8 = calculateReturnDate('2026-03-29', 8);
    assert.equal(res8, '2026-04-06');
  });

  test('2.3: Month boundary with 30 days (April -> May)', () => {
    // April has 30 days. April 28 + 4 days -> May 2.
    const res = calculateReturnDate('2026-04-28', 4);
    assert.equal(res, '2026-05-02');

    // April 28 + 8 days -> May 6.
    const res8 = calculateReturnDate('2026-04-28', 8);
    assert.equal(res8, '2026-05-06');
  });

  test('2.4: Non-leap year February boundary (2026 has 28 days)', () => {
    // 2026 is non-leap year: Feb 26 + 4 days -> March 2.
    const res = calculateReturnDate('2026-02-26', 4);
    assert.equal(res, '2026-03-02');

    // Feb 25 + 4 days -> March 1.
    const res2 = calculateReturnDate('2026-02-25', 4);
    assert.equal(res2, '2026-03-01');

    // Feb 22 + 8 days -> March 2.
    const res8 = calculateReturnDate('2026-02-22', 8);
    assert.equal(res8, '2026-03-02');
  });

  test('2.5: Leap year February boundary (2028 has 29 days)', () => {
    // 2028 is leap year: Feb 26 + 4 days -> March 1 (Feb 26, 27, 28, 29 -> Mar 1).
    const res = calculateReturnDate('2028-02-26', 4);
    assert.equal(res, '2028-03-01');

    // Feb 27 + 4 days -> March 2.
    const res2 = calculateReturnDate('2028-02-27', 4);
    assert.equal(res2, '2028-03-02');

    // Feb 23 + 8 days -> March 2.
    const res8 = calculateReturnDate('2028-02-23', 8);
    assert.equal(res8, '2028-03-02');
  });

  test('2.6: Year-end rollover boundary (December -> January)', () => {
    // Dec 29, 2026 + 4 days -> Jan 2, 2027.
    const res4 = calculateReturnDate('2026-12-29', 4);
    assert.equal(res4, '2027-01-02');

    // Dec 26, 2026 + 8 days -> Jan 3, 2027.
    const res8 = calculateReturnDate('2026-12-26', 8);
    assert.equal(res8, '2027-01-03');
  });

  test('2.7: formatRentalRange produces consistent interval across leap year and month boundaries', () => {
    // Non-leap year range
    const range1 = formatRentalRange('2026-02-26', '2026-03-02');
    assert.equal(range1, 'Feb 26 – Mar 2, 2026 (4 days)');

    // Leap year range
    const range2 = formatRentalRange('2028-02-26', '2028-03-01');
    assert.equal(range2, 'Feb 26 – Mar 1, 2028 (4 days)');

    // Year rollover range
    const range3 = formatRentalRange('2026-12-29', '2027-01-02');
    assert.equal(range3, 'Dec 29 – Jan 2, 2027 (4 days)');

    // 8-day range
    const range8 = formatRentalRange('2026-11-10', '2026-11-18');
    assert.equal(range8, 'Nov 10 – Nov 18, 2026 (8 days)');
  });

  test('2.8: Invalid, null, undefined or empty dates handle gracefully without throwing', () => {
    assert.equal(calculateReturnDate('', 4), '');
    assert.equal(calculateReturnDate(null, 4), '');
    assert.equal(calculateReturnDate(undefined, 4), '');
    assert.equal(calculateReturnDate('invalid-date', 4), '');

    assert.equal(formatRentalRange('', '2026-11-14'), '');
    assert.equal(formatRentalRange('2026-11-10', ''), '');
    assert.equal(formatRentalRange(null, null), '');
    assert.equal(formatRentalRange('not-a-date', 'not-a-date'), 'not-a-date – not-a-date');
  });
});

/* ============================================================================
 * SECTION 3: PRICING CALCULATION BOUNDARIES & FESTIVE CARE
 * ============================================================================
 */
describe('Section 3: Pricing Calculation Boundaries & Festive Care', () => {
  function computePDPPricing(listing, rentalDuration, damageWaiver) {
    if (!listing) return { dailyRate: 0, subtotal: 0, deposit: 0, waiverFee: 29900, total: 0, buyPrice: 0 };
    const dailyRate = Number(listing.rentalPricePaise || 0);
    const deposit = Number(listing.depositPaise || 0);
    const subtotal = dailyRate * rentalDuration;
    const waiverFee = damageWaiver ? 29900 : 0;
    const total = subtotal + deposit + waiverFee;
    const buyPrice = Number(listing.salePricePaise || 0);
    return { dailyRate, subtotal, deposit, waiverFee, total, buyPrice };
  }

  test('3.1: Zero pricing boundaries (₹0 rental, ₹0 deposit, no waiver)', () => {
    const p = computePDPPricing({ rentalPricePaise: 0, depositPaise: 0 }, 4, false);
    assert.equal(p.dailyRate, 0);
    assert.equal(p.subtotal, 0);
    assert.equal(p.deposit, 0);
    assert.equal(p.waiverFee, 0);
    assert.equal(p.total, 0);
    assert.equal(formatPaiseToRupees(p.total), '₹0');
  });

  test('3.2: 4-day vs 8-day subtotal scaling (₹2,500/day rate)', () => {
    const listing = { rentalPricePaise: 250000, depositPaise: 500000 };
    const p4 = computePDPPricing(listing, 4, false);
    assert.equal(p4.subtotal, 1000000); // ₹10,000
    assert.equal(p4.total, 1500000);    // ₹15,000

    const p8 = computePDPPricing(listing, 8, false);
    assert.equal(p8.subtotal, 2000000); // ₹20,000
    assert.equal(p8.total, 2500000);    // ₹25,000
  });

  test('3.3: Festive Care Protection fee is strictly flat ₹299 (29900 paise)', () => {
    const listing = { rentalPricePaise: 250000, depositPaise: 500000 };
    const pNoWaiver = computePDPPricing(listing, 4, false);
    const pWithWaiver = computePDPPricing(listing, 4, true);

    assert.equal(pWithWaiver.waiverFee, 29900);
    assert.equal(pWithWaiver.total - pNoWaiver.total, 29900, 'Difference must equal exactly 29900 paise');
    assert.equal(formatPaiseToRupees(pWithWaiver.waiverFee), '₹299');
  });

  test('3.4: Zero-deposit waiver behavior (KYC verified renter)', () => {
    // When lender/admin grants zero-deposit or listing has 0 deposit
    const listing = { rentalPricePaise: 300000, depositPaise: 0 };
    const p = computePDPPricing(listing, 4, true);

    assert.equal(p.deposit, 0);
    assert.equal(p.waiverFee, 29900);
    assert.equal(p.total, 1200000 + 29900);
    assert.equal(formatPaiseToRupees(p.total), '₹12,299');
  });

  test('3.5: Multi-crore luxury bridal ensemble amounts (₹2.5 Crore)', () => {
    // ₹2.5 Crore = 2,50,00,000 INR = 2,50,00,00,000 paise
    const multiCrorePaise = 2500000000;
    const formatted = formatPaiseToRupees(multiCrorePaise);
    assert.ok(
      formatted.includes('2,50,00,000') || formatted.includes('25,000,000'),
      `Formatted multi-crore amount must show 2,50,00,000: got "${formatted}"`
    );
    assert.ok(formatted.startsWith('₹'));
    assert.ok(!formatted.includes('₹₹'));
    assert.ok(!formatted.includes('NaN'));
  });

  test('3.6: Fractional paise (sub-cent) rounding resilience', () => {
    // 29900.4 paise -> ₹299
    assert.equal(formatPaiseToRupees(29900.4), '₹299');
    // 29900.8 paise -> ₹299.01 or ₹299
    const formattedDec = formatPaiseToRupees(29950, { showDecimals: true });
    assert.equal(formattedDec, '₹299.50');
  });
});

/* ============================================================================
 * SECTION 4: CURRENCY FORMATTING EDGE CASES & DUPLICATE SYMBOLS
 * ============================================================================
 */
describe('Section 4: Currency Formatting Edge Cases & Symbol Integrity', () => {
  test('4.1: Defensive handling of non-numeric, nullish, or invalid inputs', () => {
    const invalidInputs = [null, undefined, NaN, 'abc', '', {}, [], Infinity, -Infinity, -100];
    for (const input of invalidInputs) {
      const res = formatPaiseToRupees(input);
      assert.equal(res, '₹0', `Input ${String(input)} should return '₹0', got '${res}'`);
    }
  });

  test('4.2: String numeric inputs parse safely without failure', () => {
    assert.equal(formatPaiseToRupees('29900'), '₹299');
    assert.equal(formatPaiseToRupees('0'), '₹0');
    assert.equal(formatPaiseToRupees('100000'), '₹1,000');
  });

  test('4.3: Source code static scan for accidental duplicate rupee symbols (₹₹)', () => {
    // Scan all JSX files in frontend/src
    function scanDirectory(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const violations = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDirectory(fullPath));
        } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Check for literal ₹₹ or ₹{formatPaiseToRupees
          const lines = content.split('\n');
          lines.forEach((line, lineIdx) => {
            if (line.includes('₹₹')) {
              violations.push({ file: fullPath, line: lineIdx + 1, content: line.trim() });
            }
            if (line.match(/₹\s*\{\s*formatPaiseToRupees/)) {
              violations.push({ file: fullPath, line: lineIdx + 1, content: line.trim(), reason: 'Redundant ₹ before formatPaiseToRupees' });
            }
          });
        }
      }
      return violations;
    }

    const duplicateViolations = scanDirectory(SRC_DIR);
    assert.deepEqual(duplicateViolations, [], `Found duplicate ₹ patterns: ${JSON.stringify(duplicateViolations, null, 2)}`);
  });
});

/* ============================================================================
 * SECTION 5: CROSS-SURFACE WORKFLOW INTEGRITY AUDIT
 * ============================================================================
 */
describe('Section 5: Cross-Surface Rental Workflow Integrity Audit', () => {
  test('5.1: BagDrawer damage care waiver fee must match ₹299 (29900 paise)', () => {
    const bagDrawerPath = path.join(SRC_DIR, 'components', 'rental', 'BagDrawer.jsx');
    const content = fs.readFileSync(bagDrawerPath, 'utf8');

    // Check if BagDrawer has hardcoded formatPaiseToRupees(1250)
    const hasLegacy1250 = content.includes('formatPaiseToRupees(1250)');
    assert.equal(
      hasLegacy1250,
      false,
      'BagDrawer.jsx:248 contains legacy formatPaiseToRupees(1250) instead of 29900 paise (₹299 Festive Care)'
    );
  });

  test('5.2: BagDrawer draft subtotal line item must not double-count Festive Care fee', () => {
    const listingDetailPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'ListingDetailPage.jsx');
    const content = fs.readFileSync(listingDetailPath, 'utf8');

    // Check how subtotalPaise is passed to addToBag
    const subtotalPassMatch = content.match(/subtotalPaise:\s*([^,\n]+)/);
    assert.ok(subtotalPassMatch, 'ListingDetailPage must pass subtotalPaise to addToBag');

    // If subtotalPaise includes pricing.waiverFee, verify whether BagDrawer displays waiver separately
    const subtotalExpression = subtotalPassMatch[1].trim();
    // If subtotalPaise bundles pricing.subtotal + pricing.waiverFee, then in BagDrawer,
    // line 243: "Rental (4 days)" displays subtotalPaise (which already has ₹299),
    // AND line 248 displays "Damage Care" (adding another ₹299 or ₹12.50)!
    assert.equal(
      subtotalExpression,
      'pricing.subtotal',
      `ListingDetailPage.jsx line 164 passes subtotalPaise as "${subtotalExpression}". It should pass pure "pricing.subtotal" so that Rental subtotal and Damage Care line are distinct in BagDrawer.`
    );
  });

  test('5.3: ListingCard pricing presentation consistency with ListingDetailPage', () => {
    const listingCardPath = path.join(SRC_DIR, 'components', 'rental', 'ListingCard.jsx');
    const cardContent = fs.readFileSync(listingCardPath, 'utf8');

    // In backend and PDP, rentalPricePaise is daily_rate_paise.
    // If ListingCard displays effectiveRentalPricePaise directly with "/ 4 days",
    // the customer is advertised ₹2,400 / 4 days, but PDP charges ₹9,600 for 4 days (4x discrepancy).
    // If period is "/ 4 days", price displayed must be effectiveRentalPricePaise * 4.
    // If price displayed is effectiveRentalPricePaise, period must be "/ day".
    const has4DaysPeriod = cardContent.includes('/ 4 days');
    const multipliesBy4 = cardContent.includes('effectiveRentalPricePaise * 4') || cardContent.includes('rentalPricePaise * 4');

    if (has4DaysPeriod) {
      assert.equal(
        multipliesBy4,
        true,
        'ListingCard.jsx:281-283 displays effectiveRentalPricePaise with label "/ 4 days" without multiplying daily rate by 4. This creates a 4x price mismatch with ListingDetailPage (where subtotal = dailyRate * 4).'
      );
    }
  });
});

/* ============================================================================
 * SECTION 6: TIMEZONE RESILIENCE & DATE INTEGRITY
 * ============================================================================
 */
describe('Section 6: Timezone Resilience & Date Integrity', () => {
  test('6.1: Date string parsing in formatRentalRange must not shift day in western timezones', () => {
    // When "2026-11-10" is parsed as UTC midnight, start.getDate() in UTC-5/UTC-8 yields 9 instead of 10.
    // formatters.js formatRentalRange uses start.getMonth() and start.getDate() on new Date("2026-11-10").
    const startDate = '2026-11-10';
    const endDate = '2026-11-14';
    const formatted = formatRentalRange(startDate, endDate);

    // Regardless of timezone where test runs, formatRentalRange must preserve the input date day (10 and 14)
    assert.ok(
      formatted.includes('Nov 10'),
      `formatRentalRange must include start date "Nov 10", got "${formatted}"`
    );
    assert.ok(
      formatted.includes('Nov 14'),
      `formatRentalRange must include end date "Nov 14", got "${formatted}"`
    );
    assert.ok(
      formatted.includes('(4 days)'),
      `formatRentalRange must indicate 4 days interval, got "${formatted}"`
    );
  });

  test('6.2: calculateReturnDate produces YYYY-MM-DD matching input calendar date plus duration', () => {
    // Test across several critical calendar dates
    const cases = [
      { start: '2026-01-01', days: 4, expected: '2026-01-05' },
      { start: '2026-02-28', days: 4, expected: '2026-03-04' },
      { start: '2026-04-30', days: 4, expected: '2026-05-04' },
      { start: '2026-12-28', days: 4, expected: '2027-01-01' },
      { start: '2026-12-28', days: 8, expected: '2027-01-05' },
    ];

    for (const { start, days, expected } of cases) {
      const actual = calculateReturnDate(start, days);
      assert.equal(actual, expected, `calculateReturnDate("${start}", ${days}) should be "${expected}", got "${actual}"`);
    }
  });
});

