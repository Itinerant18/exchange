import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatPaiseToRupees,
  paiseToInr,
  formatInr,
  formatDate,
  formatRentalRange,
  calculateReturnDate
} from '../src/utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrcDir = path.resolve(__dirname, '../src');

test('Challenger 2 Empirical Verification: Currency Formatters & Edge Cases', async (t) => {
  const formatters = [
    { name: 'formatPaiseToRupees', fn: formatPaiseToRupees },
    { name: 'paiseToInr', fn: paiseToInr },
    { name: 'formatInr', fn: formatInr }
  ];

  for (const { name, fn } of formatters) {
    await t.test(`${name}: Zero paise returns ₹0`, () => {
      assert.equal(fn(0), '₹0');
      assert.equal(fn(0, { showDecimals: true }), '₹0.00');
      assert.equal(fn('0'), '₹0');
    });

    await t.test(`${name}: Null, undefined, and NaN return safe fallback ₹0`, () => {
      assert.equal(fn(null), '₹0');
      assert.equal(fn(undefined), '₹0');
      assert.equal(fn(NaN), '₹0');
      assert.equal(fn(''), '₹0');
      assert.equal(fn('invalid-string'), '₹0');
      assert.equal(fn({}), '₹0');
      assert.equal(fn([]), '₹0');
      assert.equal(fn(Infinity), '₹0');
      assert.equal(fn(-Infinity), '₹0');
    });

    await t.test(`${name}: Negative paise return safe fallback ₹0`, () => {
      assert.equal(fn(-100), '₹0');
      assert.equal(fn(-0.01), '₹0');
      assert.equal(fn(-999999), '₹0');
    });

    await t.test(`${name}: Sub-paise (fractional) handling without NaN or throwing`, () => {
      // 50 paise = ₹0.50
      assert.equal(fn(50, { showDecimals: true }), '₹0.50');
      assert.equal(fn(50), '₹1'); // rounded to nearest whole rupee if no decimals

      // 0.4 paise = ₹0.004 -> ₹0
      assert.equal(fn(0.4), '₹0');
      assert.equal(fn(0.4, { showDecimals: true }), '₹0.00');

      // 29900.4 paise -> ₹299
      assert.equal(fn(29900.4), '₹299');
      assert.equal(fn(29900.4, { showDecimals: true }), '₹299.00');

      // 29950 paise -> ₹299.50 with decimals, ₹300 without
      assert.equal(fn(29950, { showDecimals: true }), '₹299.50');
      assert.equal(fn(29950), '₹300');
    });

    await t.test(`${name}: Multi-crore amounts with Indian comma grouping`, () => {
      // ₹1,000 = 100,000 paise
      assert.equal(fn(100000), '₹1,000');

      // ₹10,000 = 1,000,000 paise
      assert.equal(fn(1000000), '₹10,000');

      // ₹1,00,000 (1 Lakh) = 10,000,000 paise
      assert.equal(fn(10000000), '₹1,00,000');

      // ₹10,00,000 (10 Lakhs) = 100,000,000 paise
      assert.equal(fn(100000000), '₹10,00,000');

      // ₹1,00,00,000 (1 Crore) = 1,000,000,000 paise
      assert.equal(fn(1000000000), '₹1,00,00,000');

      // ₹5,00,00,000 (5 Crores - High-end royal bridal archive) = 5,000,000,000 paise
      assert.equal(fn(5000000000), '₹5,00,00,000');

      // ₹100,00,00,000 (100 Crores) = 100,000,000,000 paise
      assert.equal(fn(100000000000), '₹1,00,00,00,000');
    });

    await t.test(`${name}: Standard rental prices across the platform`, () => {
      // ₹299 Festive Care
      assert.equal(fn(29900), '₹299');
      assert.equal(fn(29900, { showDecimals: true }), '₹299.00');

      // ₹1,499 starting price
      assert.equal(fn(149900), '₹1,499');

      // ₹25,000 designer lehenga
      assert.equal(fn(2500000), '₹25,000');
    });
  }
});

test('Challenger 2 Empirical Verification: Date Helpers & Boundaries', async (t) => {
  await t.test('calculateReturnDate: 4-day and 8-day periods', () => {
    assert.equal(calculateReturnDate('2026-10-29', 4), '2026-11-02');
    assert.equal(calculateReturnDate('2026-10-29', 8), '2026-11-06');
    assert.equal(calculateReturnDate('2026-10-29'), '2026-11-02'); // default 4 days
  });

  await t.test('calculateReturnDate: Month boundary and leap year', () => {
    // Leap year Feb 28 to March 3 (4 days)
    assert.equal(calculateReturnDate('2028-02-28', 4), '2028-03-03');
    // Year boundary Dec 30 to Jan 3 (4 days)
    assert.equal(calculateReturnDate('2026-12-30', 4), '2027-01-03');
    // Null/invalid date
    assert.equal(calculateReturnDate(null), '');
    assert.equal(calculateReturnDate(''), '');
    assert.equal(calculateReturnDate('invalid-date'), '');
  });

  await t.test('formatRentalRange: human-readable range with interval', () => {
    const range = formatRentalRange('2026-10-29', '2026-11-02');
    assert.match(range, /Oct 29 – Nov 2, 2026/);
    assert.match(range, /\(4 days\)/);
    assert.equal(formatRentalRange(null, null), '');
    assert.equal(formatRentalRange('invalid', 'dates'), 'invalid – dates');
  });

  await t.test('formatDate: human-readable single date', () => {
    assert.equal(formatDate(''), '');
    assert.equal(formatDate('invalid-date'), 'invalid-date');
    const formatted = formatDate('2026-10-29');
    assert.match(formatted, /29/);
    assert.match(formatted, /2026/);
  });
});

test('Challenger 2 Empirical Verification: Fee Consistency (₹299 / 29900 paise)', async (t) => {
  await t.test('DamageWaiverBadge.jsx defaults to 29900 paise', () => {
    const filePath = path.join(frontendSrcDir, 'components/rental/DamageWaiverBadge.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /DEFAULT_WAIVER_FEE_PAISE\s*=\s*29900/);
    assert.match(content, /₹299/);
  });

  await t.test('ListingDetailPage.jsx sets feePaise={29900}', () => {
    const filePath = path.join(frontendSrcDir, 'features/listings/pages/ListingDetailPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /<DamageWaiverBadge[^>]*feePaise=\{29900\}/);
  });

  await t.test('BagDrawer.jsx charges exactly 29900 paise for Damage Care', () => {
    const filePath = path.join(frontendSrcDir, 'components/rental/BagDrawer.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /formatPaiseToRupees\(29900\)/);
    assert.doesNotMatch(content, /formatPaiseToRupees\(1250\)/);
  });

  await t.test('MoleculeComparisonTable.jsx states Optional ₹299 Festive Care', () => {
    const filePath = path.join(frontendSrcDir, 'features/home/components/MoleculeComparisonTable.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /Optional ₹299 Festive Care protection/);
    assert.doesNotMatch(content, /₹125/);
  });
});

test('Challenger 2 Empirical Verification: Design Tokens & Zero Color Leaks', async (t) => {
  await t.test('variables.css contains brand tokens including aliases', () => {
    const variablesPath = path.join(frontendSrcDir, 'styles/variables.css');
    const css = fs.readFileSync(variablesPath, 'utf8');

    assert.match(css, /--color-burgundy:\s*#570020;/);
    assert.match(css, /--color-zari-gold:\s*#C8A251;/);
    assert.match(css, /--color-brand-burgundy:\s*#570020;/);
    assert.match(css, /--color-raw-silk:\s*#F8F8F8;/);
    assert.match(css, /--color-kajal-noir:\s*#1A1A1A;/);
    assert.match(css, /--color-antique-zari-gold:\s*#C8A251;/);
  });

  await t.test('Zero occurrences of #D1DBFF across entire frontend/src', () => {
    function walk(dir, fileList = []) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walk(fullPath, fileList);
        } else if (/\.(jsx?|css|html|json)$/.test(file)) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const allFiles = walk(frontendSrcDir);
    const matchesD1DBFF = [];
    const matchesPurple = [];

    const unbrandedPurples = ['#6a1b9a', '#f4ecf7', '#d5b4e0'];

    for (const file of allFiles) {
      const text = fs.readFileSync(file, 'utf8').toLowerCase();
      if (text.includes('#d1dbff')) {
        matchesD1DBFF.push(file);
      }
      for (const p of unbrandedPurples) {
        if (text.includes(p)) {
          matchesPurple.push({ file, p });
        }
      }
    }

    assert.equal(matchesD1DBFF.length, 0, `Found #D1DBFF leaks in: ${matchesD1DBFF.join(', ')}`);
    assert.equal(matchesPurple.length, 0, `Found unbranded purple leaks in: ${JSON.stringify(matchesPurple)}`);
  });
});
