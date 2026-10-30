import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './CatwalkVideoPlayer.module.css';

const DEFAULT_VIDEO_MP4 = '/videos/hero-runway.mp4';
const DEFAULT_POSTER = '/videos/hero-runway-poster.jpg';

/**
 * 9:16 Vertical Catwalk Video Player with IntersectionObserver viewport auto-play,
 * frosted glass audio toggle, accessible controls, and resilient fallback media.
 */
export function CatwalkVideoPlayer({
  src,
  videoUrl,
  videoUrlMp4,
  videoUrlWebm,
  poster,
  posterUrl,
  title,
  altText,
  aspectRatio = '9:16',
  autoPlayOnVisible = true,
  mutedDefault = true,
  loop = true,
  className = '',
  onPlay,
  onPause,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(mutedDefault);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Determine media sources with resilient fallbacks
  const resolvedMp4 = videoUrlMp4 || src || videoUrl || (!videoUrlWebm ? DEFAULT_VIDEO_MP4 : null);
  const resolvedWebm = videoUrlWebm || null;
  const resolvedPoster = posterUrl || poster || DEFAULT_POSTER;
  const resolvedAlt = altText || title || 'Haute Couture Catwalk Video Showcase';

  // Compute CSS aspect ratio variable
  const cssAspectRatio = aspectRatio === '3:4' ? '3 / 4' : '9 / 16';

  // Safe playback execution
  const executePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
        setIsPlaying(true);
        setHasPlaybackError(false);
        if (typeof onPlay === 'function') onPlay();
      }
    } catch (err) {
      // Browser autoplay policy blocked or aborted
      setIsPlaying(false);
    }
  }, [onPlay]);

  const executePause = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    if (typeof onPause === 'function') onPause();
  }, [onPause]);

  // IntersectionObserver for viewport autoplay/pause [0.15, 0.35]
  useEffect(() => {
    if (!autoPlayOnVisible) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!videoRef.current) return;

          // Autoplay when element reaches >35% viewport threshold
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            executePlay();
          }
          // Pause when element drops below <15% viewport threshold
          else if (!entry.isIntersecting || entry.intersectionRatio < 0.15) {
            executePause();
          }
        });
      },
      {
        threshold: [0.15, 0.35],
      }
    );

    const target = containerRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [autoPlayOnVisible, executePlay, executePause]);

  // Sync mute state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Audio mute/unmute toggle with frosted glass button
  const toggleMute = (e) => {
    e.stopPropagation();
    setUserInteracted(true);
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  // Play/pause toggle
  const togglePlayPause = (e) => {
    e.stopPropagation();
    setUserInteracted(true);
    if (isPlaying) {
      executePause();
    } else {
      executePlay();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlayPause(e);
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMute(e);
    }
  };

  const handleVideoError = () => {
    setHasPlaybackError(true);
    setIsLoading(false);
    setIsPlaying(false);
  };

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
    setIsPlaying(true);
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${className}`}
      style={{ '--aspect-ratio': cssAspectRatio }}
      tabIndex={0}
      role="region"
      aria-label={resolvedAlt}
      onKeyDown={handleKeyDown}
      onClick={togglePlayPause}
    >
      {/* Video Stream Element */}
      <video
        ref={videoRef}
        className={`${styles.video} ${!isPlaying ? styles.videoDimmed : ''}`}
        poster={resolvedPoster}
        playsInline
        muted={isMuted}
        loop={loop}
        preload="metadata"
        aria-label={resolvedAlt}
        onLoadedData={handleLoadedData}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onError={handleVideoError}
      >
        {resolvedWebm && <source src={resolvedWebm} type="video/webm" />}
        {resolvedMp4 && <source src={resolvedMp4} type="video/mp4" />}
        Your browser does not support the video tag.
      </video>

      {/* Loading Spinner */}
      {isLoading && !hasPlaybackError && (
        <div className={styles.loadingSpinner} aria-hidden="true">
          <div className={styles.spinnerRing} />
        </div>
      )}

      {/* Playback Error Fallback */}
      {hasPlaybackError && (
        <div className={styles.errorOverlay}>
          <img src={resolvedPoster} alt={resolvedAlt} className={styles.fallbackPoster} />
          <span className={styles.errorTitle}>Catwalk Video Unavailable</span>
          <p className={styles.errorText}>
            Unable to stream runway footage. Showing high-resolution atelier portrait.
          </p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={(e) => {
              e.stopPropagation();
              setHasPlaybackError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
                executePlay();
              }
            }}
          >
            Retry Video
          </button>
        </div>
      )}

      {/* Center Play Button Overlay when Paused */}
      {!isPlaying && !isLoading && !hasPlaybackError && (
        <div className={styles.centerPlayOverlay}>
          <button
            type="button"
            className={styles.centerPlayBtn}
            onClick={togglePlayPause}
            aria-label="Play catwalk video"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        </div>
      )}

      {/* Top Banner Tag */}
      <div className={styles.topOverlay} aria-hidden="true">
        <span className={styles.catwalkTag}>
          <span className={styles.liveDot} />
          {aspectRatio === '9:16' ? '9:16 Catwalk Motion' : 'Runway Motion'}
        </span>
      </div>

      {/* Bottom Frosted Glass Audio & Play Controls Overlay */}
      <div className={styles.controlsOverlay} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.miniPlayBtn}
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        <div className={styles.soundControls}>
          <button
            type="button"
            className={`${styles.soundToggleBtn} ${!isMuted ? styles.soundToggleActive : ''}`}
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute catwalk audio' : 'Mute catwalk audio'}
          >
            <span className={styles.soundIcon}>{isMuted ? '🔇' : '🔊'}</span>
            <span className={styles.soundLabel}>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CatwalkVideoPlayer;
