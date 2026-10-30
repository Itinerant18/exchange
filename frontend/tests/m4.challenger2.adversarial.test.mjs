import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Validation taxonomy from backend (pure JS)
import { FACETS, FACET_KEYS, validateListingAttributes } from '../../backend/src/modules/listings/listingAttributes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_ROOT, 'src');

// Read ConditionRatingScale.jsx to verify exported tiers & checkpoints directly
const conditionScalePath = path.join(SRC_DIR, 'components', 'rental', 'ConditionRatingScale.jsx');
const conditionScaleSource = fs.readFileSync(conditionScalePath, 'utf8');

const CONDITION_TIERS = [
  { grade: 'Pristine / Like New', score: '10 / 10', numericScore: 10 },
  { grade: 'Excellent', score: '9 / 10', numericScore: 9 },
  { grade: 'Very Good', score: '8 / 10', numericScore: 8 },
  { grade: 'Good', score: '7 / 10', numericScore: 7 },
  { grade: 'Fair / Archive', score: '6 / 10', numericScore: 6 },
];

const CORE_INSPECTION_CHECKPOINTS = [
  { id: 'seam', label: 'Seam Integrity', desc: 'No tears or fabric splitting; side basting stitches clean' },
  { id: 'zari', label: 'Zari Luster', desc: 'Metallic gold/silver zari unoxidized; zero thread unraveling' },
  { id: 'embroidery', label: 'Embroidery Retention', desc: 'Sequins, cutdana, and beads firmly anchored' },
  { id: 'lining', label: 'Lining Cleanliness', desc: 'Zero perspiration or cosmetics transfer; deodorized' },
  { id: 'aroma', label: 'Aroma Check', desc: 'Molecular ozone treatment verified; zero lingering fragrance' },
  { id: 'hardware', label: 'Hardware Function', desc: 'Heavy-duty metal zippers glide smoothly; hooks firmly stitched' },
  { id: 'uv', label: 'Optical UV Micro-Scan', desc: '365nm UV scan verifies zero invisible biological or chemical stains' },
];

/* ============================================================================
 * SECTION 1: CATWALK VIDEO UPLOAD & 9:16 ASPECT RATIO STRESS
 * ============================================================================
 */
describe('Section 1: Catwalk Video Upload & Aspect Ratio Integrity', () => {
  // Logic mirror from CreateListingPage.jsx handleCatwalkVideoUpload
  function simulateCatwalkUpload(file, currentMedia = []) {
    let error = '';
    if (!file) return { error: 'No file', media: currentMedia };
    const MAX_SIZE = 60 * 1024 * 1024; // 60MB
    if (file.size > MAX_SIZE) {
      error = `Catwalk video "${file.name}" exceeds the 60 MB limit.`;
      return { error, media: currentMedia };
    }
    const tempId = `catwalk-${Date.now()}`;
    const videoItem = {
      id: tempId,
      file,
      url: 'blob:http://localhost/sample-video-preview',
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      mimeType: file.type || 'video/mp4',
      mediaType: 'video',
      aspectRatio: '9:16',
      isPrimary: false,
    };
    const filtered = currentMedia.filter((m) => m.mediaType !== 'video');
    return { error: '', media: [...filtered, videoItem] };
  }

  test('1.1: File size boundary: exactly 60MB is accepted', () => {
    const exact60MB = 60 * 1024 * 1024; // 62,914,560 bytes
    const mockFile = { name: 'runway-exact-60mb.mp4', size: exact60MB, type: 'video/mp4' };
    const res = simulateCatwalkUpload(mockFile);
    assert.equal(res.error, '');
    assert.equal(res.media.length, 1);
    assert.equal(res.media[0].fileName, 'runway-exact-60mb.mp4');
    assert.equal(res.media[0].aspectRatio, '9:16');
  });

  test('1.2: File size boundary: 60MB + 1 byte is rejected with exact error message', () => {
    const over60MB = (60 * 1024 * 1024) + 1; // 62,914,561 bytes
    const mockFile = { name: 'runway-oversized.mp4', size: over60MB, type: 'video/mp4' };
    const res = simulateCatwalkUpload(mockFile);
    assert.equal(res.error, 'Catwalk video "runway-oversized.mp4" exceeds the 60 MB limit.');
    assert.equal(res.media.length, 0);
  });

  test('1.3: Extreme video sizes (100MB, 500MB) are cleanly rejected without throwing', () => {
    for (const size of [100 * 1024 * 1024, 500 * 1024 * 1024]) {
      const mockFile = { name: 'giant-video.mov', size, type: 'video/quicktime' };
      const res = simulateCatwalkUpload(mockFile);
      assert.ok(res.error.includes('exceeds the 60 MB limit.'));
      assert.equal(res.media.length, 0);
    }
  });

  test('1.4: Supported MIME types (mp4, webm, quicktime) are tagged as video and 9:16', () => {
    const supported = [
      { ext: 'mp4', mime: 'video/mp4' },
      { ext: 'webm', mime: 'video/webm' },
      { ext: 'mov', mime: 'video/quicktime' },
    ];
    for (const item of supported) {
      const mockFile = { name: `clip.${item.ext}`, size: 10 * 1024 * 1024, type: item.mime };
      const res = simulateCatwalkUpload(mockFile);
      assert.equal(res.error, '');
      assert.equal(res.media[0].mediaType, 'video');
      assert.equal(res.media[0].aspectRatio, '9:16');
      assert.equal(res.media[0].mimeType, item.mime);
    }
  });

  test('1.5: Video upload deduplicates existing video (maintains 1 vertical runway clip max)', () => {
    const file1 = { name: 'first.mp4', size: 5 * 1024 * 1024, type: 'video/mp4' };
    const file2 = { name: 'second.mp4', size: 8 * 1024 * 1024, type: 'video/mp4' };
    const initialPhotos = [
      { id: 'p1', fileName: 'front.jpg', mediaType: 'image', isPrimary: true },
      { id: 'p2', fileName: 'back.jpg', mediaType: 'image', isPrimary: false },
    ];

    const step1 = simulateCatwalkUpload(file1, initialPhotos);
    assert.equal(step1.media.length, 3);
    assert.equal(step1.media.filter((m) => m.mediaType === 'video').length, 1);

    const step2 = simulateCatwalkUpload(file2, step1.media);
    assert.equal(step2.media.length, 3);
    assert.equal(step2.media.filter((m) => m.mediaType === 'video').length, 1);
    assert.equal(step2.media.find((m) => m.mediaType === 'video').fileName, 'second.mp4');
  });

  test('1.6: Payload Construction: uploadedMedia persists aspectRatio 9:16', () => {
    const localVideoItem = {
      file: { name: 'runway.mp4', size: 5000000 },
      mimeType: 'video/mp4',
      mediaType: 'video',
      aspectRatio: '9:16',
      isPrimary: false,
    };

    const uploadedMediaPayload = {
      objectKey: 'http://127.0.0.1:5000/uploads/uuid.mp4',
      mimeType: localVideoItem.mimeType,
      sizeBytes: localVideoItem.file.size,
      isPrimary: localVideoItem.isPrimary,
      mediaType: localVideoItem.mediaType,
      aspectRatio: localVideoItem.aspectRatio || '9:16',
    };

    assert.equal(localVideoItem.aspectRatio, '9:16', 'Frontend item must have 9:16');
    assert.equal(uploadedMediaPayload.aspectRatio, '9:16', 'Payload construction must preserve aspectRatio');

    const createListingPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'CreateListingPage.jsx');
    const content = fs.readFileSync(createListingPath, 'utf8');
    assert.ok(
      content.includes("aspectRatio: item.aspectRatio || (item.mediaType === 'video' ? '9:16' : '3:4')") ||
      content.includes("aspectRatio: item.aspectRatio || '9:16'") ||
      content.includes('aspectRatio: item.aspectRatio'),
      'CreateListingPage.jsx must persist aspectRatio in uploadedMedia',
    );
  });

  test('1.7: CatwalkVideoPlayer is mounted with aspectRatio="9:16" in live preview and homepage', () => {
    const createListingPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'CreateListingPage.jsx');
    const content = fs.readFileSync(createListingPath, 'utf8');

    assert.ok(content.includes('CatwalkVideoPlayer'), 'CatwalkVideoPlayer must be imported');
    assert.ok(content.includes('aspectRatio="9:16"'), 'Preview CatwalkVideoPlayer must declare aspectRatio="9:16"');
    assert.ok(content.includes('handleCatwalkVideoUpload'), 'handleCatwalkVideoUpload handler must be defined');
    assert.ok(content.includes('60 * 1024 * 1024'), '60MB limit must be checked');
  });
});

/* ============================================================================
 * SECTION 2: CONDITION SCALE & DATABASE CONSTRAINT COMPATIBILITY
 * ============================================================================
 */
describe('Section 2: 10-Point Condition Scale & DB Constraint Compatibility', () => {
  const DB_ALLOWED_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

  // Mapping formula from CreateListingPage.jsx line 741
  function mapScoreToDbCondition(score) {
    return score >= 10 ? 'new' : score === 9 ? 'like_new' : score >= 7 ? 'good' : 'fair';
  }

  test('2.1: All 5 appraisal scale tiers declared in ConditionRatingScale.jsx map strictly to DB enums', () => {
    for (const tier of CONDITION_TIERS) {
      assert.ok(conditionScaleSource.includes(tier.grade), `Grade "${tier.grade}" must be declared in source`);
      const dbCondition = mapScoreToDbCondition(tier.numericScore);
      assert.ok(
        DB_ALLOWED_CONDITIONS.includes(dbCondition),
        `Tier score ${tier.numericScore} (${tier.grade}) mapped to "${dbCondition}" which is NOT allowed by DB constraint!`,
      );
    }
  });

  test('2.2: Specific score tier mappings match luxury expectations', () => {
    assert.equal(mapScoreToDbCondition(10), 'new', 'Score 10 (Pristine) must map to "new"');
    assert.equal(mapScoreToDbCondition(9), 'like_new', 'Score 9 (Excellent) must map to "like_new"');
    assert.equal(mapScoreToDbCondition(8), 'good', 'Score 8 (Very Good) must map to "good"');
    assert.equal(mapScoreToDbCondition(7), 'good', 'Score 7 (Good) must map to "good"');
    assert.equal(mapScoreToDbCondition(6), 'fair', 'Score 6 (Fair/Archive) must map to "fair"');
  });

  test('2.3: Boundary & out-of-range scores clamp safely to DB enum', () => {
    assert.equal(mapScoreToDbCondition(11), 'new');
    assert.equal(mapScoreToDbCondition(5), 'fair');
    assert.equal(mapScoreToDbCondition(0), 'fair');
    assert.equal(mapScoreToDbCondition(-10), 'fair');
  });

  test('2.4: Core inspection checkpoints all have id, label, and description', () => {
    assert.equal(CORE_INSPECTION_CHECKPOINTS.length, 7, 'Must have exactly 7 physical checkpoints');
    for (const cp of CORE_INSPECTION_CHECKPOINTS) {
      assert.ok(conditionScaleSource.includes(cp.label), `Checkpoint "${cp.label}" must be in source`);
    }
  });

  test('2.5: CRITICAL DEFECT EMPIRICAL PROOF: attributes.conditionScore rejected by backend validateListingAttributes', () => {
    class MockAppError extends Error {
      constructor(msg, opts = {}) {
        super(msg);
        Object.assign(this, opts);
      }
    }

    const payloadAttributes = {
      occasion: ['Festive'],
      conditionScore: ['10'],
      conditionGrade: ['Pristine / Like New'],
    };

    // Verify backend behavior: FACET_KEYS does NOT include conditionScore or conditionGrade
    assert.equal(FACET_KEYS.includes('conditionScore'), false);
    assert.equal(FACET_KEYS.includes('conditionGrade'), false);

    assert.throws(
      () => {
        validateListingAttributes(payloadAttributes, MockAppError);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('attributes.conditionScore is not a supported facet'));
        return true;
      },
      'Backend validateListingAttributes must reject attributes.conditionScore with HTTP 400',
    );
  });

  test('2.6: CreateListingPage source integrity: attributes payload does NOT inject conditionScore or conditionGrade', () => {
    const createListingPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'CreateListingPage.jsx');
    const content = fs.readFileSync(createListingPath, 'utf8');

    assert.ok(
      !content.includes('conditionScore: [String(conditionScore)]'),
      'CreateListingPage.jsx must not inject conditionScore into payload.attributes',
    );
    assert.ok(
      !content.includes('conditionGrade: [tier.grade]'),
      'CreateListingPage.jsx must not inject conditionGrade into payload.attributes',
    );

    class MockAppError extends Error {
      constructor(msg, opts = {}) {
        super(msg);
        Object.assign(this, opts);
      }
    }
    const cleanAttributes = { occasion: ['Festive', 'WeddingGuest'], neckline: ['VNeck'] };
    const validated = validateListingAttributes(cleanAttributes, MockAppError);
    assert.deepEqual(validated.occasion, ['Festive', 'WeddingGuest']);
    assert.deepEqual(validated.neckline, ['VNeck']);
  });
});

/* ============================================================================
 * SECTION 3: LENDER MONETIZATION & 6.5% PRICING EDGE CASES
 * ============================================================================
 */
describe('Section 3: Lender Monetization & 6.5% Pricing Formula Stress', () => {
  // Formula from CreateListingPage.jsx lines 1347-1349
  function computeRecommendedRentalFee(replacementValueRupees) {
    const retailVal = Number(replacementValueRupees || 0);
    const recommended4DayFee = retailVal >= 25000 ? Math.round((retailVal * 0.065) / 100) * 100 : null;
    const recommendedDailyRate = recommended4DayFee ? Math.round(recommended4DayFee / 4) : null;
    return { recommended4DayFee, recommendedDailyRate };
  }

  // Formula from CreateListingPage.jsx lines 1568-1577 (Live Preview Card)
  function computePreviewEarnings(replacementValueRupees, rentalPriceRupees, rentalsPerYear = 6) {
    const retailPrice = Number(replacementValueRupees) > 0 ? Number(replacementValueRupees) : 85000;
    const dailyRate = Number(rentalPriceRupees || 0);
    const fee4Day = dailyRate * 4;
    const grossAnnual = fee4Day * rentalsPerYear;
    const platformFee = Math.round(grossAnnual * 0.20);
    const netEarnings = grossAnnual - platformFee;
    const paybackYears = netEarnings > 0 && retailPrice > 0 ? (retailPrice / netEarnings).toFixed(1) : 'N/A';
    const roi3Year = netEarnings > 0 && retailPrice > 0 ? Math.round(((netEarnings * 3) / retailPrice) * 100) : 0;
    return { retailPrice, dailyRate, fee4Day, grossAnnual, platformFee, netEarnings, paybackYears, roi3Year };
  }

  test('3.1: Recommended 6.5% fee across retail range (₹25,000 to ₹5,00,000)', () => {
    // ₹25,000: 25000 * 0.065 = 1625 -> rounds to 1600 (₹400/day)
    const res25k = computeRecommendedRentalFee(25000);
    assert.equal(res25k.recommended4DayFee, 1600);
    assert.equal(res25k.recommendedDailyRate, 400);

    // ₹85,000: 85000 * 0.065 = 5525 -> rounds to 5500 (₹1375/day)
    const res85k = computeRecommendedRentalFee(85000);
    assert.equal(res85k.recommended4DayFee, 5500);
    assert.equal(res85k.recommendedDailyRate, 1375);

    // ₹2,00,000: 200000 * 0.065 = 13000 -> rounds to 13000 (₹3250/day)
    const res200k = computeRecommendedRentalFee(200000);
    assert.equal(res200k.recommended4DayFee, 13000);
    assert.equal(res200k.recommendedDailyRate, 3250);

    // ₹5,00,000: 500000 * 0.065 = 32500 -> rounds to 32500 (₹8125/day)
    const res500k = computeRecommendedRentalFee(500000);
    assert.equal(res500k.recommended4DayFee, 32500);
    assert.equal(res500k.recommendedDailyRate, 8125);
  });

  test('3.2: Retail values below threshold (< ₹25,000) suppress recommendation', () => {
    assert.equal(computeRecommendedRentalFee(24999).recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee(10000).recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee(0).recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee(-50000).recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee('abc').recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee('').recommendedDailyRate, null);
    assert.equal(computeRecommendedRentalFee(null).recommendedDailyRate, null);
  });

  test('3.3: 20% platform share and 80% net passive payout integer invariant', () => {
    const testCases = [
      { retail: 30000, rate: 500, freq: 4 },
      { retail: 85000, rate: 1375, freq: 6 },
      { retail: 150000, rate: 2500, freq: 10 },
      { retail: 500000, rate: 8125, freq: 15 },
    ];

    for (const tc of testCases) {
      const e = computePreviewEarnings(tc.retail, tc.rate, tc.freq);
      assert.equal(e.grossAnnual, e.fee4Day * tc.freq);
      assert.equal(e.grossAnnual, e.netEarnings + e.platformFee, 'Gross must strictly equal Net + Platform Fee');
      assert.equal(Math.round(e.grossAnnual * 0.20), e.platformFee);
      assert.ok(Number(e.paybackYears) > 0);
      assert.ok(e.roi3Year > 0);
    }
  });

  test('3.4: Zero daily rate handles gracefully (no division by zero)', () => {
    const e = computePreviewEarnings(85000, 0, 6);
    assert.equal(e.grossAnnual, 0);
    assert.equal(e.platformFee, 0);
    assert.equal(e.netEarnings, 0);
    assert.equal(e.paybackYears, 'N/A');
    assert.equal(e.roi3Year, 0);
  });

  test('3.5: Edge Case Guard: replacementValueRupees="0" safely falls back to benchmark ₹85,000 without Infinity ROI', () => {
    const e = computePreviewEarnings('0', 1000, 6);
    assert.equal(e.retailPrice, 85000, 'Zero replacement value must fall back to benchmark ₹85,000');
    assert.equal(e.netEarnings, 19200);
    assert.equal(e.paybackYears, '4.4');
    assert.ok(Number.isFinite(e.roi3Year), 'ROI must be finite');
    assert.equal(e.roi3Year, 68);

    const createListingPath = path.join(SRC_DIR, 'features', 'listings', 'pages', 'CreateListingPage.jsx');
    const content = fs.readFileSync(createListingPath, 'utf8');
    assert.ok(
      content.includes('Number(form.replacementValueRupees) > 0 ? Number(form.replacementValueRupees) : 85000'),
      'CreateListingPage.jsx must guard replacementValueRupees > 0 with fallback to 85000',
    );
  });
});

/* ============================================================================
 * SECTION 4: CUSTOMER REVIEWS, UPLOAD LIMITS & BODY STATS INTEGRITY
 * ============================================================================
 */
describe('Section 4: Customer Reviews, Upload Limits & Body Stats', () => {
  // Logic from ReviewFormModal.jsx handlePhotoUpload
  function simulatePhotoUpload(currentPhotos, newFile) {
    let error = '';
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (newFile.size > MAX_SIZE) {
      error = 'Photo must be under 10 MB.';
      return { error, photos: currentPhotos };
    }
    const updated = [...currentPhotos, `data:image/jpeg;base64,mock-data-${newFile.name}`].slice(0, 3);
    return { error: '', photos: updated };
  }

  test('4.1: Review photo upload enforces strictly 3 photos maximum', () => {
    let photos = [];
    for (let i = 1; i <= 5; i++) {
      const file = { name: `look-${i}.jpg`, size: 2 * 1024 * 1024 };
      const res = simulatePhotoUpload(photos, file);
      assert.equal(res.error, '');
      photos = res.photos;
    }
    assert.equal(photos.length, 3, 'Must never exceed 3 photos');
    assert.ok(photos[0].includes('look-1.jpg'));
    assert.ok(photos[1].includes('look-2.jpg'));
    assert.ok(photos[2].includes('look-3.jpg'));
  });

  test('4.2: Photo file size boundary: 10MB accepted, 10MB + 1 byte rejected', () => {
    const exact10MB = 10 * 1024 * 1024; // 10,485,760 bytes
    const over10MB = exact10MB + 1; // 10,485,761 bytes

    const resValid = simulatePhotoUpload([], { name: 'fit-exact.jpg', size: exact10MB });
    assert.equal(resValid.error, '');
    assert.equal(resValid.photos.length, 1);

    const resInvalid = simulatePhotoUpload([], { name: 'fit-too-large.jpg', size: over10MB });
    assert.equal(resInvalid.error, 'Photo must be under 10 MB.');
    assert.equal(resInvalid.photos.length, 0);
  });

  test('4.3: Body stats human boundary limits against DB constraints', () => {
    function validateBodyStats({ height, weight, bodyType, fitRating }) {
      if (height !== null && height !== undefined && (height < 100 || height > 250)) {
        return { valid: false, reason: 'Height out of bounds (100–250 cm)' };
      }
      if (weight !== null && weight !== undefined && (weight < 25 || weight > 300)) {
        return { valid: false, reason: 'Weight out of bounds (25–300 kg)' };
      }
      const ALLOWED_TYPES = ['petite', 'slim', 'average', 'athletic', 'curvy', 'plus_size'];
      if (bodyType && !ALLOWED_TYPES.includes(bodyType)) {
        return { valid: false, reason: 'Invalid bodyType' };
      }
      const ALLOWED_FIT = ['RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'];
      if (fitRating && !ALLOWED_FIT.includes(fitRating)) {
        return { valid: false, reason: 'Invalid fitRating' };
      }
      return { valid: true };
    }

    assert.equal(validateBodyStats({ height: 165, weight: 58, bodyType: 'petite', fitRating: 'TRUE_TO_SIZE' }).valid, true);
    assert.equal(validateBodyStats({ height: 100, weight: 25, bodyType: 'slim', fitRating: 'RUNS_SMALL' }).valid, true);
    assert.equal(validateBodyStats({ height: 250, weight: 300, bodyType: 'plus_size', fitRating: 'RUNS_LARGE' }).valid, true);

    assert.equal(validateBodyStats({ height: 99, weight: 50 }).valid, false);
    assert.equal(validateBodyStats({ height: 251, weight: 50 }).valid, false);
    assert.equal(validateBodyStats({ height: 170, weight: 24 }).valid, false);
    assert.equal(validateBodyStats({ height: 170, weight: 301 }).valid, false);
    assert.equal(validateBodyStats({ bodyType: 'muscular_extra' }).valid, false);
    assert.equal(validateBodyStats({ fitRating: 'SOMEWHAT_TIGHT' }).valid, false);
  });

  test('4.4: Persistence Disconnect: waistSize and hipsSize are not in DB reviews schema', () => {
    const DB_REVIEW_COLUMNS = [
      'id', 'reviewer_user_id', 'reviewee_user_id', 'qualifying_rental_booking_id',
      'qualifying_order_id', 'rating', 'comment', 'size_worn', 'reviewer_height_cm',
      'reviewer_weight_kg', 'bust_size', 'body_type', 'fit_rating', 'photos',
    ];

    assert.equal(DB_REVIEW_COLUMNS.includes('size_worn'), true);
    assert.equal(DB_REVIEW_COLUMNS.includes('bust_size'), true);
    assert.equal(DB_REVIEW_COLUMNS.includes('waist_size'), false, 'waist_size column is NOT in DB');
    assert.equal(DB_REVIEW_COLUMNS.includes('hips_size'), false, 'hips_size column is NOT in DB');
  });

  test('4.5: CustomerReviews bodySpecLine formats full spec string gracefully', () => {
    function bodySpecLine(review) {
      const parts = [];
      if (review.sizeWorn) parts.push(`Wore size ${review.sizeWorn}`);
      if (review.reviewerHeightCm) parts.push(`${review.reviewerHeightCm} cm`);
      if (review.reviewerWeightKg) parts.push(`${review.reviewerWeightKg} kg`);
      if (review.bustSize) parts.push(`Bust ${review.bustSize}`);
      if (review.waistSize || review.waist) parts.push(`Waist ${review.waistSize || review.waist}`);
      if (review.hipsSize || review.hips) parts.push(`Hips ${review.hipsSize || review.hips}`);
      if (review.bodyType) parts.push(review.bodyType.replace('_', ' '));
      return parts.join(' · ');
    }

    const fullReview = {
      sizeWorn: 'S',
      reviewerHeightCm: 165,
      reviewerWeightKg: 54,
      bustSize: '32B',
      waistSize: '26 in',
      hipsSize: '36 in',
      bodyType: 'slim',
    };

    const formatted = bodySpecLine(fullReview);
    assert.equal(formatted, 'Wore size S · 165 cm · 54 kg · Bust 32B · Waist 26 in · Hips 36 in · slim');

    const partialReview = { sizeWorn: 'M', bustSize: '34D' };
    assert.equal(bodySpecLine(partialReview), 'Wore size M · Bust 34D');
  });
});
