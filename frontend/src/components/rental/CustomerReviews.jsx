import { useEffect, useState, useMemo } from 'react';
import { reviewsApi } from '../../api/reviewsApi.js';
import { formatDate } from '../../utils/formatters.js';
import styles from './CustomerReviews.module.css';

const FIT_LABELS = {
  RUNS_SMALL: 'Runs Small',
  TRUE_TO_SIZE: 'True to Size',
  RUNS_LARGE: 'Runs Large',
};

function bodySpecLine(review) {
  const parts = [];
  if (review.sizeWorn) parts.push(`Wore size ${review.sizeWorn}`);
  if (review.reviewerHeightCm) parts.push(`${review.reviewerHeightCm} cm`);
  if (review.reviewerWeightKg) parts.push(`${review.reviewerWeightKg} kg`);
  if (review.bustSize) parts.push(`Bust ${review.bustSize}`);
  if (review.bodyType) parts.push(review.bodyType.replace('_', ' '));
  return parts.join(' · ');
}

/**
 * 'Our Runway' — real customer reviews for one listing, with the fit meter
 * aggregate (runs small / true to size / runs large) and reviewer body specs.
 */
export function CustomerReviews({ listingId, activeUserSize, listingTitle }) {
  const [reviews, setReviews] = useState([]);
  const [fitStats, setFitStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fitFilter, setFitFilter] = useState('all');
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  const customerPhotos = useMemo(() => {
    return reviews.flatMap((r) => (r.photos || []).map((url) => ({ url, review: r })));
  }, [reviews]);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    reviewsApi.getListingReviews(listingId, { limit: 10 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setReviews(rows);
        if (res?.meta?.fitStats) {
          setFitStats(res.meta.fitStats);
        }
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => setLoading(false));
  }, [listingId]);

  const hasFitData = fitStats && fitStats.totalRatings > 0;
  const visibleReviews = fitFilter === 'all'
    ? reviews
    : reviews.filter((review) => review.fitRating === fitFilter);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Our Runway</h3>
          <p className={styles.subtitle}>
            {fitStats ? (
              <>★ {fitStats.averageRating.toFixed(1)} average across {fitStats.totalRatings} verified {fitStats.totalRatings === 1 ? 'renter' : 'renters'} of {listingTitle || 'this piece'}</>
            ) : (
              <>Verified renters of {listingTitle || 'this piece'}</>
            )}
          </p>
        </div>
        <a href="/bookings" className={styles.writeReviewLink}>
          Review a Completed Rental →
        </a>
      </div>

      {/* ── Fit Meter Aggregate ── */}
      {hasFitData && (
        <div className={styles.fitMeter}>
          <div className={styles.fitMeterRow}>
            <span className={styles.fitMeterLabel}>Runs Small</span>
            <div className={styles.fitMeterTrack}>
              <div
                className={styles.fitMeterFill}
                style={{ width: `${Math.min(100, fitStats.runsSmall + fitStats.trueToSize / 2)}%` }}
              />
              <div
                className={styles.fitMeterMarker}
                style={{ width: `${hasFitData ? fitStats.trueToSize : 0}%`, alignSelf: 'flex-end' }}
                aria-hidden
              />
            </div>
            <span className={styles.fitMeterLabel}>Runs Large</span>
          </div>
          <div className={styles.fitMeterLegend}>
            <span>{fitStats.runsSmall}% Runs Small</span>
            <span>{fitStats.trueToSize}% True to Size</span>
            <span>{fitStats.runsLarge}% Runs Large</span>
          </div>
          {activeUserSize && (
            <p className={styles.fitMeterNote}>
              Most renters who wore size {activeUserSize} rated the fit true to size.
            </p>
          )}
        </div>
      )}

      {/* ── Fit Filters ── */}
      {reviews.length > 0 && (
        <div className={styles.filterRow} role="radiogroup" aria-label="Filter reviews by fit">
          {['all', 'RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'].map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterPill} ${fitFilter === key ? styles.filterPillActive : ''}`}
              onClick={() => setFitFilter(key)}
              role="radio"
              aria-checked={fitFilter === key}
            >
              {key === 'all' ? 'All Fits' : FIT_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {/* ── 'Our Runway' Customer Photo Gallery Reel ── */}
      {customerPhotos.length > 0 && (
        <div className={styles.photoReelSection}>
          <div className={styles.photoReelHeader}>
            <span className={styles.photoReelTitle}>Customer Photos ({customerPhotos.length})</span>
            <span className={styles.photoReelSubtitle}>See real drape, length & fit on verified renters</span>
          </div>
          <div className={styles.photoReelTrack}>
            {customerPhotos.map((item, idx) => (
              <button
                key={`${item.url}-${idx}`}
                type="button"
                className={styles.photoReelCard}
                onClick={() => setActivePhotoModal(item)}
                aria-label="View customer photo and body stats"
              >
                <img src={item.url} alt="Customer wearing outfit" className={styles.reelImage} loading="lazy" />
                <div className={styles.photoPill}>
                  {item.review.sizeWorn ? `Size ${item.review.sizeWorn}` : 'Rented'}
                  {item.review.reviewerHeightCm ? ` • ${item.review.reviewerHeightCm} cm` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loadingText}>Loading reviews from verified renters…</p>
      ) : visibleReviews.length > 0 ? (
        <div className={styles.reviewsGrid}>
          {visibleReviews.map((review) => (
            <article key={review.id} className={styles.card}>
              <div className={styles.reviewContent}>
                <div className={styles.cardHeader}>
                  <div className={styles.ratingRow}>
                    <div className={styles.stars}>
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </div>
                    <span className={styles.author}>
                      {review.reviewerDisplayName || 'Verified Renter'}
                    </span>
                  </div>
                  <span className={styles.date}>{formatDate(review.createdAt)}</span>
                </div>

                {review.fitRating && (
                  <span className={styles.fitBadge}>{FIT_LABELS[review.fitRating]}</span>
                )}
                {bodySpecLine(review) && (
                  <p className={styles.bodySpecs}>{bodySpecLine(review)}</p>
                )}
                {review.comment && (
                  <p className={styles.bodyText}>{review.comment}</p>
                )}

                {/* Attached review photos */}
                {review.photos && review.photos.length > 0 && (
                  <div className={styles.cardPhotosRow}>
                    {review.photos.map((src, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        className={styles.cardPhotoBtn}
                        onClick={() => setActivePhotoModal({ url: src, review })}
                      >
                        <img src={src} alt="Renter event photo" className={styles.cardPhotoImg} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyReviews}>
          <div className={styles.emptyIcon}>★</div>
          <p className={styles.emptyTitle}>Be the first to wear and review this piece!</p>
          <p className={styles.emptySub}>
            Customer reviews with fit notes and styling photos are invited after returning your rental.
          </p>
        </div>
      )}

      {/* ── Photo Lightbox Modal with Body Specs ── */}
      {activePhotoModal && (
        <div className={styles.lightboxOverlay} onClick={() => setActivePhotoModal(null)}>
          <div className={styles.lightboxModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={() => setActivePhotoModal(null)}
              aria-label="Close photo preview"
            >
              ✕
            </button>
            <div className={styles.lightboxContent}>
              <div className={styles.lightboxImageWrap}>
                <img src={activePhotoModal.url} alt="Customer fit photo" className={styles.lightboxImg} />
              </div>
              <div className={styles.lightboxDetails}>
                <div className={styles.lightboxHeader}>
                  <div className={styles.stars}>
                    {'★'.repeat(activePhotoModal.review.rating)}
                    {'☆'.repeat(5 - activePhotoModal.review.rating)}
                  </div>
                  <span className={styles.lightboxAuthor}>
                    {activePhotoModal.review.reviewerDisplayName || 'Verified Renter'}
                  </span>
                </div>
                {activePhotoModal.review.fitRating && (
                  <span className={styles.fitBadge}>{FIT_LABELS[activePhotoModal.review.fitRating]}</span>
                )}
                {bodySpecLine(activePhotoModal.review) && (
                  <p className={styles.lightboxSpecs}>{bodySpecLine(activePhotoModal.review)}</p>
                )}
                {activePhotoModal.review.comment && (
                  <p className={styles.lightboxComment}>"{activePhotoModal.review.comment}"</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
