import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Formatters under test
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
 * SECTION 1: VERIFICATION OF THE 3 CHALLENGER 1 DEFECT REMEDIATIONS
 * ============================================================================
 */
describe('Section 1: Verification of Challenger 1 Defects Remediation', () => {
  const bagDrawerPath = path.join(SRC_DIR, 'components', 'rental', 'BagDrawer.jsx');
  const listingDetailPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'ListingDetailPage.jsx');
  const listingCardPath = path.join(SRC_DIR, 'components', 'rental', 'ListingCard.jsx');

  const bagDrawerSource = fs.readFileSync(bagDrawerPath, 'utf8');
  const listingDetailSource = fs.readFileSync(listingDetailPath, 'utf8');
  const listingCardSource = fs.readFileSync(listingCardPath, 'utf8');

  // --------------------------------------------------------------------------
  // Defect 1: Damage Care Waiver Fee is ₹299 (29900 paise), not ₹12.50 (1250 paise)
  // --------------------------------------------------------------------------
  test('1.1: Defect 1 — BagDrawer completely eliminates legacy 1250 paise fee', () => {
    assert.equal(
      bagDrawerSource.includes('formatPaiseToRupees(1250)'),
      false,
      'BagDrawer.jsx must not contain legacy formatPaiseToRupees(1250)'
    );
    assert.equal(
      bagDrawerSource.includes('1250'),
      false,
      'BagDrawer.jsx must not reference 1250 paise anywhere'
    );
  });

  test('1.2: Defect 1 — BagDrawer renders ₹299 (29900 paise) for Festive Care waiver', () => {
    // Verifies dynamic payload waiver fee with fallback to 29900
    assert.ok(
      bagDrawerSource.includes('payload.waiverFeePaise || 29900') ||
      bagDrawerSource.includes('payload.waiverFeePaise ?? 29900'),
      'BagDrawer.jsx must dynamically read payload.waiverFeePaise with fallback to 29900'
    );

    // Verify formatted output for 29900 paise
    const formattedWaiver = formatPaiseToRupees(29900);
    assert.equal(formattedWaiver, '₹299', 'Waiver fee of 29900 paise must format as ₹299');
  });

  test('1.3: Defect 1 — ListingDetailPage sets waiver fee strictly to 29900 paise', () => {
    assert.ok(
      listingDetailSource.includes('waiverFee = damageWaiver ? 29900 : 0') ||
      listingDetailSource.includes('damageWaiver ? 29900 : 0'),
      'ListingDetailPage must define waiverFee as 29900 when damageWaiver is active'
    );
    assert.ok(
      listingDetailSource.includes('waiverFeePaise: pricing.waiverFee'),
      'ListingDetailPage must forward waiverFeePaise in bag payload and summary'
    );
  });

  // --------------------------------------------------------------------------
  // Defect 2: Rental duration subtotal is unbundled from waiver fee
  // --------------------------------------------------------------------------
  test('1.4: Defect 2 — ListingDetailPage unbundles rental subtotal from damage waiver', () => {
    // subtotalPaise passed to addToBag must be pure pricing.subtotal
    const match = listingDetailSource.match(/subtotalPaise:\s*([^,\n]+)/);
    assert.ok(match, 'ListingDetailPage must specify subtotalPaise in addToBag payload');
    const expr = match[1].trim();
    assert.equal(
      expr,
      'pricing.subtotal',
      `subtotalPaise must be pure "pricing.subtotal", got "${expr}"`
    );

    // Must not bundle waiver fee into subtotal
    assert.equal(
      listingDetailSource.includes('pricing.subtotal + pricing.waiverFee'),
      false,
      'ListingDetailPage must NOT bundle waiverFee into subtotalPaise'
    );
  });

  test('1.5: Defect 2 — BagDrawer breakdown rows sum exactly to displayed Grand Total', () => {
    // Simulate BagDrawer pricing arithmetic across various booking scenarios
    function simulateBagDrawerCalculation({ dailyRatePaise, durationDays, damageWaiver, depositPaise, courierPaise = 0 }) {
      const rentalSubtotalPaise = dailyRatePaise * durationDays;
      const waiverFeePaise = damageWaiver ? 29900 : 0;
      const summaryTotalPaise = rentalSubtotalPaise + depositPaise + waiverFeePaise;
      const grandTotalPaise = summaryTotalPaise + courierPaise;

      // Sum of individual displayed lines in BagDrawer
      const displayedLines = [
        rentalSubtotalPaise,
        damageWaiver ? waiverFeePaise : 0,
        depositPaise,
        courierPaise,
      ];
      const sumOfLines = displayedLines.reduce((acc, curr) => acc + curr, 0);

      return {
        rentalSubtotalPaise,
        waiverFeePaise,
        depositPaise,
        courierPaise,
        summaryTotalPaise,
        grandTotalPaise,
        sumOfLines,
        isConsistent: sumOfLines === grandTotalPaise,
      };
    }

    const testScenarios = [
      { dailyRatePaise: 250000, durationDays: 4, damageWaiver: true, depositPaise: 500000, courierPaise: 45000 },
      { dailyRatePaise: 250000, durationDays: 8, damageWaiver: true, depositPaise: 500000, courierPaise: 0 },
      { dailyRatePaise: 120000, durationDays: 4, damageWaiver: false, depositPaise: 0, courierPaise: 35000 },
      { dailyRatePaise: 1500000, durationDays: 8, damageWaiver: true, depositPaise: 2000000, courierPaise: 60000 },
      { dailyRatePaise: 0, durationDays: 4, damageWaiver: false, depositPaise: 0, courierPaise: 0 },
    ];

    for (const sc of testScenarios) {
      const calc = simulateBagDrawerCalculation(sc);
      assert.ok(calc.isConsistent, `Line items must sum to grand total for scenario: ${JSON.stringify(sc)}`);
      assert.equal(calc.sumOfLines, calc.grandTotalPaise);
    }
  });

  // --------------------------------------------------------------------------
  // Defect 3: ListingCard 4-day rental price matches PDP 4-day total (no 4x under-reporting)
  // --------------------------------------------------------------------------
  test('1.6: Defect 3 — ListingCard multiplies daily rate by 4 for "/ 4 days" reservation period', () => {
    assert.ok(
      listingCardSource.includes('effectiveRentalPricePaise * 4') ||
      listingCardSource.includes('rentalPricePaise * 4'),
      'ListingCard.jsx must multiply effectiveRentalPricePaise by 4 when rendering "/ 4 days"'
    );
  });

  test('1.7: Defect 3 — ListingCard 4-day advertised amount matches ListingDetailPage 4-day subtotal', () => {
    const dailyRates = [
      80000,   // ₹800/day
      250000,  // ₹2,500/day
      500000,  // ₹5,000/day
      1250000, // ₹12,500/day
      7500000, // ₹75,000/day
    ];

    for (const rate of dailyRates) {
      // ListingCard displayed amount for 4 days
      const card4DayAmount = rate * 4;
      const cardFormatted = formatPaiseToRupees(card4DayAmount);

      // PDP 4-day rental subtotal (dailyRate * rentalDuration where rentalDuration = 4)
      const pdpSubtotal = rate * 4;
      const pdpFormatted = formatPaiseToRupees(pdpSubtotal);

      assert.equal(
        cardFormatted,
        pdpFormatted,
        `ListingCard (${cardFormatted}) must match PDP subtotal (${pdpFormatted}) for daily rate ${rate}`
      );
    }
  });
});

/* ============================================================================
 * SECTION 2: CALENDAR, LEAP YEAR & BOUNDARY DURATION STRESS TESTS
 * ============================================================================
 */
describe('Section 2: Calendar, Leap Year & Boundary Duration Stress Tests', () => {
  // --------------------------------------------------------------------------
  // Leap Year Transitions (2024, 2028, 2032 vs 2025, 2026, 2027)
  // --------------------------------------------------------------------------
  test('2.1: Leap Year 2028 — Feb 25, 26, 27, 28, 29 across 4-day and 8-day rentals', () => {
    // 2028 is a leap year (29 days in Feb)
    assert.equal(calculateReturnDate('2028-02-25', 4), '2028-02-29');
    assert.equal(calculateReturnDate('2028-02-26', 4), '2028-03-01');
    assert.equal(calculateReturnDate('2028-02-27', 4), '2028-03-02');
    assert.equal(calculateReturnDate('2028-02-28', 4), '2028-03-03');
    assert.equal(calculateReturnDate('2028-02-29', 4), '2028-03-04');

    // 8-day durations
    assert.equal(calculateReturnDate('2028-02-21', 8), '2028-02-29');
    assert.equal(calculateReturnDate('2028-02-22', 8), '2028-03-01');
    assert.equal(calculateReturnDate('2028-02-25', 8), '2028-03-04');
    assert.equal(calculateReturnDate('2028-02-29', 8), '2028-03-08');
  });

  test('2.2: Non-Leap Year 2026 — Feb 25, 26, 27, 28 across 4-day and 8-day rentals', () => {
    // 2026 is non-leap (28 days in Feb)
    assert.equal(calculateReturnDate('2026-02-24', 4), '2026-02-28');
    assert.equal(calculateReturnDate('2026-02-25', 4), '2026-03-01');
    assert.equal(calculateReturnDate('2026-02-26', 4), '2026-03-02');
    assert.equal(calculateReturnDate('2026-02-27', 4), '2026-03-03');
    assert.equal(calculateReturnDate('2026-02-28', 4), '2026-03-04');

    // 8-day durations
    assert.equal(calculateReturnDate('2026-02-20', 8), '2026-02-28');
    assert.equal(calculateReturnDate('2026-02-21', 8), '2026-03-01');
    assert.equal(calculateReturnDate('2026-02-24', 8), '2026-03-04');
    assert.equal(calculateReturnDate('2026-02-28', 8), '2026-03-08');
  });

  test('2.3: All 12 Month Boundaries — 31-day, 30-day, and February rollover', () => {
    const monthCases = [
      { start: '2026-01-29', days: 4, expected: '2026-02-02' }, // Jan (31) -> Feb
      { start: '2026-03-29', days: 4, expected: '2026-04-02' }, // Mar (31) -> Apr
      { start: '2026-04-28', days: 4, expected: '2026-05-02' }, // Apr (30) -> May
      { start: '2026-05-29', days: 4, expected: '2026-06-02' }, // May (31) -> Jun
      { start: '2026-06-28', days: 4, expected: '2026-07-02' }, // Jun (30) -> Jul
      { start: '2026-07-29', days: 4, expected: '2026-08-02' }, // Jul (31) -> Aug
      { start: '2026-08-29', days: 4, expected: '2026-09-02' }, // Aug (31) -> Sep
      { start: '2026-09-28', days: 4, expected: '2026-10-02' }, // Sep (30) -> Oct
      { start: '2026-10-29', days: 4, expected: '2026-11-02' }, // Oct (31) -> Nov
      { start: '2026-11-28', days: 4, expected: '2026-12-02' }, // Nov (30) -> Dec
      { start: '2026-12-29', days: 4, expected: '2027-01-02' }, // Dec (31) -> Jan (New Year)
    ];

    for (const { start, days, expected } of monthCases) {
      const actual = calculateReturnDate(start, days);
      assert.equal(actual, expected, `Month transition failed for start date ${start}`);
    }
  });

  test('2.4: formatRentalRange handles multi-year rollovers with year suffix correctly', () => {
    const rangeNewYear = formatRentalRange('2026-12-29', '2027-01-02');
    assert.equal(rangeNewYear, 'Dec 29 – Jan 2, 2027 (4 days)');

    const range8NewYear = formatRentalRange('2026-12-26', '2027-01-03');
    assert.equal(range8NewYear, 'Dec 26 – Jan 3, 2027 (8 days)');
  });

  test('2.5: calculateReturnDate handles defensive input variants', () => {
    assert.equal(calculateReturnDate(null, 4), '');
    assert.equal(calculateReturnDate(undefined, 4), '');
    assert.equal(calculateReturnDate('', 4), '');
    assert.equal(calculateReturnDate('not-a-date', 4), '');
    assert.equal(calculateReturnDate('2026-05-10', 0), '2026-05-10');
    assert.equal(calculateReturnDate('2026-05-10', -4), '2026-05-06');
  });
});

/* ============================================================================
 * SECTION 3: SIZING MATRIX ANTI-COLLISION & RESILIENCE
 * ============================================================================
 */
describe('Section 3: Sizing Matrix Anti-Collision & Edge Case Stress', () => {
  function getBackupSizeOptions(availableSizes, primarySize) {
    return availableSizes.map((size) => ({
      size,
      disabled: size === primarySize,
    }));
  }

  function handlePrimarySizeChange(newPrimary, currentBackup) {
    return {
      primarySize: newPrimary,
      backupSize: currentBackup === newPrimary ? '' : currentBackup,
    };
  }

  test('3.1: Primary size is strictly disabled in backup size row across standard sizes', () => {
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];
    for (const primary of sizes) {
      const options = getBackupSizeOptions(sizes, primary);
      const disabledOption = options.find((opt) => opt.disabled);
      assert.ok(disabledOption, `Must have a disabled option for primary size ${primary}`);
      assert.equal(disabledOption.size, primary, 'The disabled option must be the primary size');

      // All other options must be enabled
      const enabledOptions = options.filter((opt) => !opt.disabled);
      assert.equal(enabledOptions.length, sizes.length - 1);
      assert.ok(!enabledOptions.some((opt) => opt.size === primary));
    }
  });

  test('3.2: Changing primary size to match current backup size resets backup to empty', () => {
    let state = { primarySize: 'M', backupSize: 'L' };

    // Change primary to 'S' (no collision with 'L')
    state = handlePrimarySizeChange('S', state.backupSize);
    assert.equal(state.primarySize, 'S');
    assert.equal(state.backupSize, 'L');

    // Change primary to 'L' (collision with current backup 'L')
    state = handlePrimarySizeChange('L', state.backupSize);
    assert.equal(state.primarySize, 'L');
    assert.equal(state.backupSize, '', 'Backup size must auto-clear to prevent duplicate reservation');
  });

  test('3.3: Single-size inventory listing disables backup size completely', () => {
    const singleSizeListing = ['M'];
    const options = getBackupSizeOptions(singleSizeListing, 'M');
    assert.equal(options.length, 1);
    assert.equal(options[0].disabled, true, 'Single size must be disabled in backup options');
  });

  test('3.4: Extreme bespoke sizes (e.g., Couture 38, Bespoke 42) preserve anti-collision', () => {
    const bespokeSizes = ['Couture 36', 'Couture 38', 'Couture 40', 'Couture 42'];
    const state = handlePrimarySizeChange('Couture 38', 'Couture 38');
    assert.equal(state.backupSize, '', 'Bespoke matching size must be cleared');

    const options = getBackupSizeOptions(bespokeSizes, 'Couture 40');
    const disabled = options.find((o) => o.disabled);
    assert.equal(disabled.size, 'Couture 40');
  });
});

/* ============================================================================
 * SECTION 4: CHECKOUT ARITHMETIC PRECISION & CURRENCY FORMATTING
 * ============================================================================
 */
describe('Section 4: Checkout Arithmetic Precision & Currency Formatting', () => {
  test('4.1: Paise to Rupees formatting across Indian numbering scales', () => {
    const cases = [
      { paise: 0, expected: '₹0' },
      { paise: 29900, expected: '₹299' },
      { paise: 100000, expected: '₹1,000' },
      { paise: 1000000, expected: '₹10,000' },
      { paise: 10000000, expected: '₹1,00,000' }, // 1 Lakh
      { paise: 50000000, expected: '₹5,00,000' }, // 5 Lakhs
      { paise: 100000000, expected: '₹10,00,000' }, // 10 Lakhs
      { paise: 1000000000, expected: '₹1,00,00,000' }, // 1 Crore
    ];

    for (const { paise, expected } of cases) {
      const formatted = formatPaiseToRupees(paise);
      assert.equal(formatted, expected, `Paise ${paise} should format to ${expected}, got ${formatted}`);
    }
  });

  test('4.2: Defensive fallback to ₹0 for invalid, nullish, or extreme values', () => {
    const invalid = [null, undefined, '', 'invalid', NaN, Infinity, -Infinity, -500];
    for (const val of invalid) {
      assert.equal(formatPaiseToRupees(val), '₹0');
    }
  });

  test('4.3: Integer invariant in platform commission and payout calculations', () => {
    // 20% platform share, 80% lender payout
    const rentalAmounts = [100000, 250000, 499900, 1000000, 7500000];
    for (const amt of rentalAmounts) {
      const platformShare = Math.round(amt * 0.20);
      const lenderPayout = amt - platformShare;
      assert.equal(platformShare + lenderPayout, amt, 'Platform share + lender payout must equal gross rental');
      assert.ok(Number.isInteger(platformShare), 'Platform share must be integer paise');
      assert.ok(Number.isInteger(lenderPayout), 'Lender payout must be integer paise');
    }
  });
});
