import { useState } from 'react';
import { reviewsApi } from '../../api/reviewsApi.js';
import styles from './ReviewFormModal.module.css';

const BODY_TYPE_OPTIONS = [
  { value: '', label: 'Select Body Type (Optional)' },
  { value: 'petite', label: 'Petite' },
  { value: 'slim', label: 'Slim' },
  { value: 'average', label: 'Average' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'curvy', label: 'Curvy' },
  { value: 'plus_size', label: 'Plus Size' },
];

const FIT_OPTIONS = [
  { value: 'RUNS_SMALL', label: 'Runs Small' },
  { value: 'TRUE_TO_SIZE', label: 'True to Size' },
  { value: 'RUNS_LARGE', label: 'Runs Large' },
];

export function ReviewFormModal({
  bookingId,
  listingTitle,
  initialSize = '',
  isOpen,
  onClose,
  onSuccess,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [fitRating, setFitRating] = useState('TRUE_TO_SIZE');
  const [sizeWorn, setSizeWorn] = useState(initialSize);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bustSize, setBustSize] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!rating) {
      setError('Please select a star rating (1–5).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        side: 'as_renter',
        qualifyingRentalBookingId: bookingId,
        rating: Number(rating),
        fitRating: fitRating || null,
        sizeWorn: sizeWorn.trim() || null,
        reviewerHeightCm: heightCm ? Number(heightCm) : null,
        reviewerWeightKg: weightKg ? Number(weightKg) : null,
        bustSize: bustSize.trim() || null,
        bodyType: bodyType || null,
        comment: comment.trim() || null,
      };

      await reviewsApi.createReview(payload);
      setSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>OUR RUNWAY REVIEWS</span>
            <h2 id="review-modal-title" className={styles.title}>
              Review {listingTitle || 'Your Rental'}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close review dialog"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className={styles.successState}>
            <span className={styles.successIcon}>✓</span>
            <h3 className={styles.successTitle}>Thank You for Sharing!</h3>
            <p className={styles.successMessage}>
              Your review and fit metrics help other renters choose the perfect look.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            {/* ── Star Rating ── */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Overall Rating *</label>
              <div className={styles.starPicker} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starBtn} ${
                      (hoverRating || rating) >= star ? styles.starFilled : styles.starEmpty
                    }`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    role="radio"
                    aria-checked={rating === star}
                  >
                    ★
                  </button>
                ))}
                <span className={styles.ratingText}>
                  {rating === 5 && 'Loved it! Exceptional piece'}
                  {rating === 4 && 'Great outfit, felt confident'}
                  {rating === 3 && 'Good overall experience'}
                  {rating === 2 && 'Fair, had minor fit issues'}
                  {rating === 1 && 'Did not meet expectations'}
                </span>
              </div>
            </div>

            {/* ── Fit Meter Rating ── */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>How did it fit?</label>
              <div className={styles.fitSelector}>
                {FIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.fitPill} ${
                      fitRating === opt.value ? styles.fitPillActive : ''
                    }`}
                    onClick={() => setFitRating(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Body Specs & Sizing Row ── */}
            <div className={styles.specsSection}>
              <h4 className={styles.sectionHeader}>Your Fit Specs (Optional)</h4>
              <p className={styles.sectionNote}>
                Helps other shoppers with similar body types find their ideal size.
              </p>

              <div className={styles.specsGrid}>
                <div className={styles.inputWrap}>
                  <label htmlFor="sizeWorn" className={styles.subLabel}>Size Worn</label>
                  <input
                    id="sizeWorn"
                    type="text"
                    value={sizeWorn}
                    onChange={(e) => setSizeWorn(e.target.value)}
                    placeholder="e.g. S, M, US 4"
                    className={styles.input}
                    maxLength={20}
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="bodyType" className={styles.subLabel}>Body Type</label>
                  <select
                    id="bodyType"
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                    className={styles.select}
                  >
                    {BODY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="heightCm" className={styles.subLabel}>Height (cm)</label>
                  <input
                    id="heightCm"
                    type="number"
                    min="100"
                    max="250"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="e.g. 168"
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="weightKg" className={styles.subLabel}>Weight (kg)</label>
                  <input
                    id="weightKg"
                    type="number"
                    min="25"
                    max="300"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 58"
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="bustSize" className={styles.subLabel}>Bust / Cup</label>
                  <input
                    id="bustSize"
                    type="text"
                    value={bustSize}
                    onChange={(e) => setBustSize(e.target.value)}
                    placeholder="e.g. 34B"
                    className={styles.input}
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* ── Written Comment ── */}
            <div className={styles.fieldGroup}>
              <label htmlFor="comment" className={styles.label}>
                Styling & Wear Review
              </label>
              <textarea
                id="comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Where did you wear it? How was the fabric, comfort, and compliments? Any styling tips?"
                className={styles.textarea}
                maxLength={2000}
              />
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting…' : 'Publish Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
