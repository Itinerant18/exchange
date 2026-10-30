import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPaiseToRupees } from '../../utils/formatters.js';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './ListingCard.module.css';

/**
 * 3:4 Portrait Catalog Listing Card with hover video preview (0.9x speed ramp),
 * INR currency formatting, and dual rent/buy presentation.
 */
export function ListingCard({ listing, onHoverPreview = true, sampleVideoFallback = false }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  if (!listing) return null;

  const {
    id,
    title,
    rentalPricePaise,
    rentalPrice,
    salePricePaise,
    salePrice,
    replacementValuePaise,
    replacementValue,
    isRental,
    isSale,
    city,
    images = [],
    media = [],
    brand,
    size,
    backupSize,
  } = listing;

  const effectiveRentalPricePaise = rentalPricePaise ?? (rentalPrice != null ? Math.round(rentalPrice * 100) : null);
  const effectiveSalePricePaise = salePricePaise ?? (salePrice != null ? Math.round(salePrice * 100) : null);
  const effectiveReplacementValuePaise = replacementValuePaise ?? (replacementValue != null ? Math.round(replacementValue * 100) : null);

  // Pool all media items
  const allMedia = [...(Array.isArray(images) ? images : []), ...(Array.isArray(media) ? media : [])];

  // Resolve primary image
  const primaryImage =
    allMedia.find((img) => img.isPrimary && !img.mimeType?.startsWith('video/') && img.mediaType !== 'video')?.objectKey ||
    allMedia.find((img) => img.isPrimary && !img.mimeType?.startsWith('video/') && img.mediaType !== 'video')?.url ||
    allMedia.find((img) => !img.mimeType?.startsWith('video/') && img.mediaType !== 'video')?.objectKey ||
    allMedia.find((img) => !img.mimeType?.startsWith('video/') && img.mediaType !== 'video')?.url ||
    listing.imageUrl ||
    listing.image ||
    allMedia[0]?.objectKey ||
    allMedia[0]?.url ||
    null;

  // Resolve video source (explicitly declared or sample fallback)
  const explicitVideo =
    listing.videoUrl ||
    listing.catwalkVideoUrl ||
    listing.video ||
    allMedia.find(
      (m) =>
        m.mimeType?.startsWith('video/') ||
        m.mediaType === 'video' ||
        (typeof (m.objectKey || m.url) === 'string' && (m.objectKey || m.url).match(/\.(mp4|webm|mov|ogg)$/i))
    )?.url ||
    allMedia.find(
      (m) =>
        m.mimeType?.startsWith('video/') ||
        m.mediaType === 'video' ||
        (typeof (m.objectKey || m.url) === 'string' && (m.objectKey || m.url).match(/\.(mp4|webm|mov|ogg)$/i))
    )?.objectKey;

  const hasVideoDeclared =
    allMedia.some(
      (m) =>
        m.mimeType?.startsWith('video/') ||
        m.mediaType === 'video' ||
        (typeof (m.objectKey || m.url) === 'string' && (m.objectKey || m.url).match(/\.(mp4|webm|mov|ogg)$/i))
    ) || Boolean(listing.videoUrl || listing.catwalkVideoUrl || listing.video || listing.hasVideo);

  const resolvedVideoSrc =
    explicitVideo ||
    (hasVideoDeclared || listing.sampleVideoFallback || sampleVideoFallback
      ? '/videos/hero-runway.mp4'
      : null);

  const hasVideo = Boolean(resolvedVideoSrc);
  const isLiked = isFavorite(id);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (!onHoverPreview || !resolvedVideoSrc || !videoRef.current) return;
    setIsHovered(true);
    setIsVideoLoading(true);

    try {
      // 0.9x playback speed for editorial catwalk elegance
      videoRef.current.playbackRate = 0.9;
    } catch {
      // safe fallback
    }

    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsVideoLoading(false);
          setIsVideoPlaying(true);
        })
        .catch(() => {
          setIsVideoLoading(false);
          setIsVideoPlaying(false);
        });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsVideoLoading(false);
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      try {
        videoRef.current.currentTime = 0;
      } catch {
        // safe fallback
      }
    }
  };

  const handleVideoPlaying = () => {
    setIsVideoLoading(false);
    setIsVideoPlaying(true);
  };

  const handleVideoCanPlay = () => {
    if (isHovered) {
      setIsVideoLoading(false);
    }
  };

  const handleVideoWaiting = () => {
    if (isHovered) {
      setIsVideoLoading(true);
    }
  };

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
    <article
      className={styles.card}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      <div className={styles.imageWrapper}>
        {primaryImage ? (
          <Link to={`/listings/${id}`} className={styles.imageLink} aria-label={`View ${title}`}>
            <img
              src={primaryImage}
              alt={title}
              className={styles.image}
              loading="lazy"
            />
            {hasVideo && (
              <video
                ref={videoRef}
                src={resolvedVideoSrc}
                className={`${styles.previewVideo} ${isVideoPlaying ? styles.previewVideoVisible : ''}`}
                playsInline
                muted
                loop
                preload="none"
                poster={primaryImage}
                onPlaying={handleVideoPlaying}
                onCanPlay={handleVideoCanPlay}
                onWaiting={handleVideoWaiting}
                aria-hidden="true"
              />
            )}
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

        {/* Video Loading Spinner on Hover */}
        {isHovered && isVideoLoading && hasVideo && (
          <div className={styles.videoLoader} aria-hidden="true" />
        )}

        {/* 0.9x Catwalk Live Indicator on Hover Video Playback */}
        {isHovered && isVideoPlaying && (
          <div className={styles.videoPlayingIndicator} aria-hidden="true">
            <span className={styles.videoLiveDot} />
            <span>0.9x Catwalk</span>
          </div>
        )}

        {/* Top Badges */}
        <div className={styles.badgeGroup}>
          {isRental && <span className={styles.badgeRental}>Rent</span>}
          {isSale && <span className={styles.badgeSale}>Pre-Loved</span>}
          {hasVideo && <span className={styles.badgeVideo}>▶ Video</span>}
          {isRental && (backupSize || listing.hasBackupSize !== false) && (
            <span className={styles.badgeBackupSize}>Free Backup Size</span>
          )}
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
          {isRental && effectiveRentalPricePaise && (
            <div className={styles.rentalPriceBlock}>
              <span className={styles.rentalPrice}>
                {formatPaiseToRupees(effectiveRentalPricePaise * 4)}
              </span>
              <span className={styles.rentalPeriod}>/ 4 days</span>
            </div>
          )}

          {isSale && effectiveSalePricePaise && (
            <div className={styles.rentalPriceBlock}>
              <span className={isRental ? styles.saleSubPrice : styles.rentalPrice}>
                {isRental ? `or Buy ${formatPaiseToRupees(effectiveSalePricePaise)}` : formatPaiseToRupees(effectiveSalePricePaise)}
              </span>
              {!isRental && <span className={styles.rentalPeriod}>buy</span>}
            </div>
          )}

          {effectiveReplacementValuePaise && (
            <span className={styles.retailAnchor}>
              {formatPaiseToRupees(effectiveReplacementValuePaise)} retail
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default ListingCard;
