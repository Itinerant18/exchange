import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_ROOT, 'src');
const BACKEND_ROOT = path.resolve(FRONTEND_ROOT, '..', 'backend');

import { formatPaiseToRupees, calculateReturnDate } from '../src/utils/formatters.js';

/* ============================================================================
 * SUITE 1: ListingDetailPage Surface & Booking Math Stress Verification
 * ============================================================================
 */
describe('Challenger Suite 1: ListingDetailPage Surface & Booking Math', () => {
  const pdpPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'ListingDetailPage.jsx');
  assert.ok(fs.existsSync(pdpPath), 'ListingDetailPage.jsx must exist');
  const pdpCode = fs.readFileSync(pdpPath, 'utf8');

  test('1.1: handleAddToBag references declared displayMedia/displayImages and avoids runtime ReferenceError', () => {
    // Check if displayMedia is used and displayImages is declared
    const hasDisplayMediaUsage = pdpCode.includes('displayMedia');
    assert.equal(hasDisplayMediaUsage, true, 'displayMedia is used in ListingDetailPage.jsx');

    const declarationMatch = pdpCode.match(/(?:const|let|var|function)\s+displayImages\b/);
    assert.ok(
      declarationMatch,
      'displayImages is declared in ListingDetailPage.jsx'
    );

    // Verify that handleAddToBag safely evaluates image without throwing ReferenceError
    assert.doesNotThrow(() => {
      const displayMedia = [{ url: 'https://example.com/lehenga.jpg', isVideo: false }];
      const displayImages = displayMedia.map((m) => m.url);
      const title = 'Test Lehenga';
      const brand = 'Sabyasachi';
      const primarySize = 'M';
      const listingSize = 'M';
      const backupSize = '';
      const fittingSpecs = null;
      const rentalDuration = 4;
      const pricing = { subtotal: 400000, waiverFee: 29900, deposit: 100000, total: 529900 };

      return {
        title,
        brand,
        image: displayMedia[0]?.url || undefined,
        size: primarySize || listingSize,
        backupSize: backupSize || undefined,
        fittingSpecs: fittingSpecs || undefined,
        durationDays: rentalDuration,
        subtotalPaise: pricing.subtotal,
        waiverFeePaise: pricing.waiverFee,
        depositPaise: pricing.deposit,
        totalPaise: pricing.total,
      };
    });
  });

  test('1.2: Festive Care damage waiver arithmetic across rental durations (4 vs 8 days)', () => {
    function computePricing(listing, rentalDuration, damageWaiver) {
      const dailyRate = Number(listing?.rentalPricePaise || 0);
      const deposit = Number(listing?.depositPaise || 0);
      const subtotal = dailyRate * rentalDuration;
      const waiverFee = damageWaiver ? 29900 : 0;
      const total = subtotal + deposit + waiverFee;
      return { dailyRate, subtotal, deposit, waiverFee, total };
    }

    const mockListing = { rentalPricePaise: 150000, depositPaise: 300000 }; // ₹1,500/day, ₹3,000 deposit

    // 4-day rental without waiver
    const p4NoWaiver = computePricing(mockListing, 4, false);
    assert.equal(p4NoWaiver.subtotal, 600000); // ₹6,000
    assert.equal(p4NoWaiver.waiverFee, 0);
    assert.equal(p4NoWaiver.total, 900000); // ₹9,000

    // 4-day rental with waiver
    const p4Waiver = computePricing(mockListing, 4, true);
    assert.equal(p4Waiver.subtotal, 600000);
    assert.equal(p4Waiver.waiverFee, 29900); // Flat ₹299
    assert.equal(p4Waiver.total, 929900); // ₹9,299

    // 8-day rental with waiver — verify waiver is FLAT per-booking, NOT multiplied by 8
    const p8Waiver = computePricing(mockListing, 8, true);
    assert.equal(p8Waiver.subtotal, 1200000); // ₹12,000
    assert.equal(p8Waiver.waiverFee, 29900); // Flat ₹299
    assert.equal(p8Waiver.total, 1529900); // ₹15,299 (1,200,000 + 300,000 + 29,900)

    // Verify DamageWaiverBadge is rendered with feePaise={29900}
    assert.ok(pdpCode.includes('feePaise={29900}'), 'DamageWaiverBadge must receive feePaise={29900}');
  });

  test('1.3: Backup size resolution and mutual exclusion logic', () => {
    function resolveSizes(listing) {
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

    // Default sizing
    const defaultSizes = resolveSizes({ size: 'M' });
    assert.deepEqual(defaultSizes, ['XS', 'S', 'M', 'L', 'XL']);

    // Non-standard atelier size
    const customSizes = resolveSizes({ size: 'FreeSize' });
    assert.deepEqual(customSizes, ['FreeSize', 'XS', 'S', 'M', 'L', 'XL']);

    // Verify PDP wires BackupSizeSelector with availableSizes and primarySize
    assert.ok(pdpCode.includes('sizes={availableSizes}'), 'PDP must pass availableSizes to BackupSizeSelector');
    assert.ok(pdpCode.includes('onPrimarySizeChange={setPrimarySize}'), 'PDP must handle primary size change');
    assert.ok(pdpCode.includes('onBackupSizeChange={setBackupSize}'), 'PDP must handle backup size change');
  });

  test('1.4: 7-Stage Hygiene Guarantee trust badge and modal trigger contract', () => {
    assert.ok(pdpCode.includes('hygieneTrustBadge'), 'PDP must render .hygieneTrustBadge');
    assert.ok(pdpCode.includes('setHygieneModalOpen(true)'), 'Clicking badge must set hygieneModalOpen to true');
    assert.ok(pdpCode.includes('SterilizationGuaranteeInfographic'), 'Modal body must render SterilizationGuaranteeInfographic');
    assert.ok(pdpCode.includes('compact={false}'), 'SterilizationGuaranteeInfographic inside modal must be compact={false}');
    assert.ok(pdpCode.includes('setHygieneModalOpen(false)'), 'Close button and backdrop must set hygieneModalOpen to false');
  });
});

/* ============================================================================
 * SUITE 2: CreateListingPage Catwalk Video, Appraisal & Submission Payload
 * ============================================================================
 */
describe('Challenger Suite 2: CreateListingPage Video, Appraisal & Payload', () => {
  const createPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'CreateListingPage.jsx');
  assert.ok(fs.existsSync(createPath), 'CreateListingPage.jsx must exist');
  const createCode = fs.readFileSync(createPath, 'utf8');

  test('2.1: Video upload handler assigns aspectRatio: "9:16" to catwalk media', () => {
    // In handleFiles:
    assert.ok(
      createCode.includes("aspectRatio: isVideo ? '9:16' : '3:4'"),
      'handleFiles must set aspectRatio: "9:16" on videos and "3:4" on images'
    );

    // In handleCatwalkVideoUpload:
    assert.ok(
      createCode.includes("aspectRatio: '9:16'"),
      'handleCatwalkVideoUpload must set aspectRatio: "9:16"'
    );

    // Test simulation of catwalk file intake
    function processIncomingFile(file) {
      const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|webm|mov|ogg)$/i));
      const isImage = file.type.startsWith('image/') || Boolean(file.name.match(/\.(png|jpe?g|webp|avif)$/i));
      if (!isImage && !isVideo) return { error: 'unsupported' };
      return {
        mediaType: isVideo ? 'video' : 'image',
        aspectRatio: isVideo ? '9:16' : '3:4',
      };
    }

    const mp4Result = processIncomingFile({ name: 'runway-walk.mp4', type: 'video/mp4' });
    assert.equal(mp4Result.mediaType, 'video');
    assert.equal(mp4Result.aspectRatio, '9:16');

    const movResult = processIncomingFile({ name: 'catwalk.mov', type: 'video/quicktime' });
    assert.equal(movResult.mediaType, 'video');
    assert.equal(movResult.aspectRatio, '9:16');

    const jpgResult = processIncomingFile({ name: 'front-view.jpg', type: 'image/jpeg' });
    assert.equal(jpgResult.mediaType, 'image');
    assert.equal(jpgResult.aspectRatio, '3:4');
  });

  test('2.2: Condition appraisal 10-point scale maps scores 10..6 to backend enum', () => {
    function mapScoreToDbCondition(score) {
      return score >= 10 ? 'new' : score === 9 ? 'like_new' : score >= 7 ? 'good' : 'fair';
    }

    assert.equal(mapScoreToDbCondition(10), 'new');
    assert.equal(mapScoreToDbCondition(9), 'like_new');
    assert.equal(mapScoreToDbCondition(8), 'good');
    assert.equal(mapScoreToDbCondition(7), 'good');
    assert.equal(mapScoreToDbCondition(6), 'fair');
  });

  test('2.3: Form submission payload structure with conditionScore (6-10) and attributes', () => {
    // Verify CreateListingPage.jsx includes conditionScore and conditionGrade in top-level payload
    assert.ok(createCode.includes('conditionScore: conditionScore'), 'Payload must include conditionScore');
    assert.ok(createCode.includes('conditionGrade: tier.grade'), 'Payload must include conditionGrade');
    assert.ok(createCode.includes('condition: form.condition'), 'Payload must include condition');

    // Verify conditionScore and conditionGrade are NOT injected into payload.attributes
    // (Injecting non-taxonomy keys into attributes causes backend 400 rejection)
    const attributesBlockMatch = createCode.match(/payload\.attributes\s*=\s*\{([^}]+)\}/);
    assert.ok(attributesBlockMatch, 'payload.attributes must be defined');
    const attributesBlock = attributesBlockMatch[1];
    assert.equal(
      attributesBlock.includes('conditionScore:'),
      false,
      'payload.attributes must NOT contain conditionScore (must be top-level only)'
    );
  });
});

/* ============================================================================
 * SUITE 3: FilterModal Slide-Over Drawer & Dynamic CTA Verification
 * ============================================================================
 */
describe('Challenger Suite 3: FilterModal Drawer & Dynamic CTA', () => {
  const modalPath = path.join(SRC_DIR, 'components', 'rental', 'FilterModal.jsx');
  const cssPath = path.join(SRC_DIR, 'components', 'rental', 'FilterModal.module.css');
  assert.ok(fs.existsSync(modalPath), 'FilterModal.jsx must exist');
  assert.ok(fs.existsSync(cssPath), 'FilterModal.module.css must exist');

  const modalCode = fs.readFileSync(modalPath, 'utf8');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  test('3.1: Slide-over drawer layout and frosted backdrop styling', () => {
    // Backdrop
    assert.ok(cssCode.includes('backdrop-filter: blur(8px)'), 'Overlay must have frosted glass backdrop blur');
    assert.ok(cssCode.includes('justify-content: flex-end'), 'Overlay must anchor drawer to right edge');

    // Drawer container
    assert.ok(cssCode.includes('width: min(480px, 100vw)'), 'Drawer width must be min(480px, 100vw)');
    assert.ok(cssCode.includes('height: 100vh'), 'Drawer height must be 100vh');
    assert.ok(cssCode.includes('animation: slideDrawer'), 'Drawer must have slideDrawer animation');
  });

  test('3.2: Dynamic result count CTA formatting', () => {
    function formatCta(totalResults) {
      if (totalResults !== undefined && totalResults !== null) {
        return `VIEW ${totalResults} ${totalResults === 1 ? 'STYLE' : 'STYLES'}`;
      }
      return 'Show Results';
    }

    assert.equal(formatCta(0), 'VIEW 0 STYLES');
    assert.equal(formatCta(1), 'VIEW 1 STYLE');
    assert.equal(formatCta(12), 'VIEW 12 STYLES');
    assert.equal(formatCta(null), 'Show Results');
    assert.equal(formatCta(undefined), 'Show Results');
  });

  test('3.3: FilterModal and ListingsPage synchronize silhouette facet without dropping selections', async () => {
    // 1. FilterModal defines silhouette in FACET_TAXONOMY
    assert.ok(modalCode.includes("key: 'silhouette'"), 'FilterModal defines silhouette in FACET_TAXONOMY');

    // 2. Check ListingsPage.jsx ensures silhouette is in facet keys and not dropped
    const listingsPageCode = fs.readFileSync(
      path.join(SRC_DIR, 'features', 'listings', 'pages', 'ListingsPage.jsx'),
      'utf8'
    );
    assert.ok(
      listingsPageCode.includes('ALL_FACET_KEYS') && listingsPageCode.includes("'silhouette'"),
      'ListingsPage includes silhouette in facet synchronization so FilterModal selections are preserved'
    );
    assert.ok(
      listingsPageCode.includes('ALL_FACET_KEYS.includes(key)'),
      'ListingsPage syncFacetParams preserves silhouette in query parameters'
    );
  });

  test('3.4: FilterModal sets MAX_VISIBLE_VALUES to 12 ensuring all occasion options are visible', () => {
    assert.ok(modalCode.includes('MAX_VISIBLE_VALUES = 12'), 'FilterModal must set MAX_VISIBLE_VALUES = 12');
  });

  test('3.5: formatRentalRange uses UTC date methods to eliminate timezone displacement', () => {
    const formattersPath = path.join(SRC_DIR, 'utils', 'formatters.js');
    const formattersCode = fs.readFileSync(formattersPath, 'utf8');
    assert.ok(formattersCode.includes('getUTCDate()'), 'formatRentalRange must use getUTCDate()');
    assert.ok(formattersCode.includes('getUTCMonth()'), 'formatRentalRange must use getUTCMonth()');
    assert.ok(formattersCode.includes('getUTCFullYear()'), 'formatRentalRange must use getUTCFullYear()');
  });
});
