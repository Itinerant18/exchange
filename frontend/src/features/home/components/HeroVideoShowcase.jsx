import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './HeroVideoShowcase.module.css';

/**
 * Rent The Runway Official Full-Coverage Hero Architecture (full-coverage-hero)
 * 
 * GRAPHICS TEAM INTEGRATION:
 * 1. Target Format: 2560 x 948 (aspect-ratio: 2.7:1), H.264 MP4, 24-30fps, optimized for web streaming.
 * 2. Save your video file(s) into `frontend/public/videos/` (e.g. `/videos/hero-runway.mp4`) or supply CDN URLs.
 * 3. Update the `videoSrc` in the `HERO_REELS` array below.
 * 4. While your video is being prepared or if `videoSrc` is null, the component automatically displays the
 *    high-resolution poster image (`posterImage`) with zero broken layout or missing media icons.
 */
export const HERO_REELS = [
  {
    id: 'master-runway',
    badge: 'THE CIRCULAR DESIGNER CLOSET',
    headline: 'One Closet, Endless Possibilities',
    subheadline: 'No matter the occasion, always have something new to wear. Over 750+ luxury designers on rotation.',
    videoSrc: 'https://cdn.rtrcdn.com/assets/imgs/OrganicHP_Hero_Desktop_081826.mp4', // Live RTR Master Video
    posterImage: 'https://cdn.rtrcdn.com/assets/imgs/OrganicHP_Hero_Poster_Desktop_081826.jpg',
    primaryCtaText: 'Rent For Events',
    primaryCtaLink: '/listings?rental=true',
    secondaryCtaText: 'Rent For Daily Wear',
    secondaryCtaLink: '/listings?sale=true',
    promoLabel: 'Rent with Subscription',
    promoPrice: '₹2,499',
    promoPeriod: 'first month',
    promoSubtext: '₹4,999/mo after'
  },
  {
    id: 'black-tie',
    badge: 'RED CARPET & COUTURE',
    headline: 'Wear the Designer. Skip the Retail.',
    subheadline: 'Rent floor-length evening gowns, liquid silks, and sculpted couture. Free complimentary backup size included.',
    videoSrc: null, // Ready for Graphics Team: '/videos/hero-black-tie.mp4'
    posterImage: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=2560&q=80',
    primaryCtaText: 'Explore Evening Gowns',
    primaryCtaLink: '/listings?q=Gown',
    secondaryCtaText: 'View Cocktail Edits',
    secondaryCtaLink: '/listings?q=Cocktail',
    promoLabel: 'Event Rental Guarantee',
    promoPrice: '2 Sizes',
    promoPeriod: 'included',
    promoSubtext: 'Complimentary backup fit'
  },
  {
    id: 'wedding-guest',
    badge: 'CURATED OCCASION EDITS',
    headline: 'Best-Dressed Guest at Every Event',
    subheadline: 'Romantic florals, tiered ruffles, and celebratory lehengas. Zero dry cleaning or laundry needed.',
    videoSrc: null, // Ready for Graphics Team: '/videos/hero-wedding.mp4'
    posterImage: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=2560&q=80',
    primaryCtaText: 'Shop Wedding Guest',
    primaryCtaLink: '/listings?q=Wedding',
    secondaryCtaText: 'Browse Vacation Sets',
    secondaryCtaLink: '/listings?q=Dress',
    promoLabel: 'Eco Dry Cleaning',
    promoPrice: '100%',
    promoPeriod: 'handled',
    promoSubtext: 'Prepaid return label'
  }
];

export function HeroVideoShowcase() {
  const [activeReelIdx, setActiveReelIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  const activeReel = HERO_REELS[activeReelIdx];

  // Playback synchronization
  useEffect(() => {
    setVideoError(false);
    if (videoRef.current && activeReel.videoSrc) {
      videoRef.current.load();
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          // Fallback if browser blocks automated play
        });
      }
    }
  }, [activeReelIdx, activeReel.videoSrc]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div className={styles.heroWrapper}>
      <div className={styles.fullCoverageHero}>
        
        {/* 1. Cinematic Background Video or High-Res Editorial Poster */}
        <div className={styles.mediaContainer}>
          {activeReel.videoSrc && !videoError ? (
            <video
              ref={videoRef}
              key={activeReel.videoSrc}
              className={styles.heroVideo}
              poster={activeReel.posterImage}
              preload="auto"
              playsInline
              autoPlay
              muted={isMuted}
              loop
              onError={() => setVideoError(true)}
            >
              <source src={activeReel.videoSrc} type="video/mp4" />
            </video>
          ) : (
            <img
              src={activeReel.posterImage}
              alt={activeReel.headline}
              className={styles.fallbackPoster}
            />
          )}
        </div>

        {/* 2. Editorial Gradient Scrim for Pristine Contrast */}
        <div className={styles.editorialScrim} />
        <div className={styles.vignetteOverlay} />

        {/* 3. Overlaid Left-Aligned Typography (HeroUnitCopy) */}
        <div className={styles.heroUnitCopy}>
          <div className={styles.eyebrowPill}>
            <span className={styles.eyebrowSparkle}>✦</span>
            <span>{activeReel.badge}</span>
          </div>

          <h1 className={styles.headline}>
            {activeReel.headline}
          </h1>

          <p className={styles.subheadline}>
            {activeReel.subheadline}
          </p>

          {/* Dual Pill CTAs */}
          <div className={styles.ctaContainer}>
            <Link to={activeReel.primaryCtaLink} className={styles.primaryCta}>
              {activeReel.primaryCtaText}
            </Link>
            <Link to={activeReel.secondaryCtaLink} className={styles.secondaryCta}>
              {activeReel.secondaryCtaText}
            </Link>
          </div>

          {/* Occasion Reel Switcher Tabs */}
          {HERO_REELS.length > 1 && (
            <div className={styles.reelTabs}>
              {HERO_REELS.map((reel, idx) => (
                <button
                  key={reel.id}
                  type="button"
                  className={`${styles.reelTab} ${idx === activeReelIdx ? styles.reelTabActive : ''}`}
                  onClick={() => setActiveReelIdx(idx)}
                >
                  {reel.id === 'master-runway' ? 'Official Runway' : reel.id.replace('-', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Floating Promo Callout Pill (SubscriptionPromoCallout) - Bottom Right */}
        <div className={styles.subscriptionCallout}>
          <div className={styles.calloutLeft}>
            <div className={styles.calloutTitle}>{activeReel.promoLabel}</div>
            <div className={styles.calloutSub}>Swap anytime • Keep what you love</div>
          </div>
          <div className={styles.calloutDivider} />
          <div className={styles.calloutRight}>
            <div className={styles.calloutPrice}>{activeReel.promoPrice}</div>
            <div className={styles.calloutPeriodBlock}>
              <span className={styles.calloutPeriod}>{activeReel.promoPeriod}</span>
              <span className={styles.calloutTerms}>{activeReel.promoSubtext}</span>
            </div>
          </div>
        </div>

        {/* 5. Floating Video Control Button (AtomVideoPauseButton) */}
        {activeReel.videoSrc && !videoError && (
          <div className={styles.videoControls}>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={toggleMute}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={togglePlay}
              title={isPlaying ? 'Pause Video' : 'Play Video'}
              aria-label={isPlaying ? 'Pause Video' : 'Play Video'}
            >
              {isPlaying ? (
                <svg className={styles.controlIcon} viewBox="0 0 10 14">
                  <path d="M0 0h2.5v14H0zM7.5 0h2.5v14H7.5z" />
                </svg>
              ) : (
                <svg className={styles.controlIcon} viewBox="0 0 10 14" style={{ marginLeft: 2 }}>
                  <path d="M0 0l10 7-10 7z" />
                </svg>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
