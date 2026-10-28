import { useEffect, useState } from 'react';
import { reviewsApi } from '../../api/reviewsApi.js';
import { formatDate } from '../../utils/formatters.js';
import styles from './CustomerReviews.module.css';

export function CustomerReviews({ ownerId, activeUserSize = 'M', listingTitle }) {
  const [reviews, setReviews] = useState([]);
  const [reputation, setReputation] = useState({ averageRating: 5.0, reviewCount: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    reviewsApi.getReviews({ revieweeId: ownerId, limit: 10 })
      .then((res) => {
        // Backend returns { data: rows, meta: { reputation, page, total } }
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setReviews(rows);
        if (res?.meta?.reputation) {
          setReputation(res.meta.reputation);
        }
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => setLoading(false));
  }, [ownerId]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Customer Reviews & Reputation</h3>
          <p className={styles.subtitle}>
            {reputation.reviewCount > 0 ? (
              <>★ {reputation.averageRating.toFixed(1)} average rating across {reputation.reviewCount} verified transactions</>
            ) : (
              <>Verified atelier and lender reputation</>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.loadingText}>Loading reviews from verified customers…</p>
      ) : reviews.length > 0 ? (
        <div className={styles.reviewsGrid}>
          {reviews.map((review) => (
            <article key={review.id} className={styles.card}>
              <div className={styles.reviewContent}>
                <div className={styles.cardHeader}>
                  <div className={styles.ratingRow}>
                    <div className={styles.stars}>
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </div>
                    <span className={styles.author}>
                      {review.reviewer_display_name || 'Verified Renter'}
                    </span>
                  </div>
                  <span className={styles.date}>{formatDate(review.created_at)}</span>
                </div>

                {review.comment && (
                  <p className={styles.bodyText}>{review.comment}</p>
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
    </div>
  );
}
