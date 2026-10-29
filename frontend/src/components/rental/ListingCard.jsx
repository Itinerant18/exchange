import { Link, useNavigate } from 'react-router-dom';
import { formatPaiseToRupees } from '../../utils/formatters.js';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './ListingCard.module.css';

export function ListingCard({ listing }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  if (!listing) return null;

  const {
    id,
    title,
    rentalPricePaise,
    salePricePaise,
    replacementValuePaise,
    isRental,
    isSale,
    city,
    images = [],
    brand,
    size,
  } = listing;

  const primaryImage = images.find((img) => img.isPrimary)?.objectKey || images[0]?.objectKey;
  const hasVideo = images.some((img) => img.mimeType?.startsWith('video/') || img.objectKey?.match(/\.(mp4|webm|mov|ogg)$/i));
  const isLiked = isFavorite(id);

  async function handleHeartClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthed) {
      navigate('/login');
      return;
    }
    try {
      await toggleFavorite(id);
    } catch {
      // Handled in context
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.imageWrapper}>
        {primaryImage ? (
          <Link to={`/listings/${id}`} className={styles.imageLink} aria-label={`View ${title}`}>
            <img
              src={primaryImage}
              alt={title}
              className={styles.image}
              loading="lazy"
            />
          </Link>
        ) : (
          <Link to={`/listings/${id}`} className={styles.placeholderLink} aria-label={`View ${title}`}>
            <div className={styles.placeholderBox}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
              </svg>
              <span className={styles.placeholderText}>Atelier Photo Pending</span>
            </div>
          </Link>
        )}

        {/* Top Badges */}
        <div className={styles.badgeGroup}>
          {isRental && <span className={styles.badgeRental}>Rent</span>}
          {isSale && <span className={styles.badgeSale}>Pre-Loved</span>}
          {hasVideo && <span className={styles.badgeVideo}>▶ Video</span>}
        </div>

        {/* Wishlist Action */}
        <button
          type="button"
          className={`${styles.wishlistBtn} ${isLiked ? styles.wishlistBtnActive : ''}`}
          onClick={handleHeartClick}
          aria-label={isLiked ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Real Size Strip from Database */}
        {size && (
          <div className={styles.quickSizes}>
            <span>Size {size}</span>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.designerRow}>
          <span className={styles.designer}>{brand || 'Designer Archive'}</span>
          {city && <span className={styles.location}>{city}</span>}
        </div>

        <h3 className={styles.title}>
          <Link to={`/listings/${id}`} className={styles.titleLink}>
            {title}
          </Link>
        </h3>

        <div className={styles.pricingRow}>
          {isRental && rentalPricePaise && (
            <div className={styles.rentalPriceBlock}>
              <span className={styles.rentalPrice}>
                {formatPaiseToRupees(rentalPricePaise)}
              </span>
              <span className={styles.rentalPeriod}>/ day</span>
            </div>
          )}

          {isSale && salePricePaise && (
            <div className={styles.rentalPriceBlock}>
              <span className={isRental ? styles.saleSubPrice : styles.rentalPrice}>
                {isRental ? `or Buy ${formatPaiseToRupees(salePricePaise)}` : formatPaiseToRupees(salePricePaise)}
              </span>
              {!isRental && <span className={styles.rentalPeriod}>buy</span>}
            </div>
          )}

          {replacementValuePaise && (
            <span className={styles.retailAnchor}>
              {formatPaiseToRupees(replacementValuePaise)} retail
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
