import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
import { HeroVideoShowcase } from '../components/HeroVideoShowcase.jsx';
import { BrandTicker } from '../components/BrandTicker.jsx';
import { MoleculeVisualNav } from '../components/MoleculeVisualNav.jsx';
import { SlidingValueProps } from '../components/SlidingValueProps.jsx';
import styles from './HomePage.module.css';

export function HomePage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.getListings({ limit: 8, isRental: true })
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        setListings(data);
      })
      .catch(() => {
        setListings([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.home}>
      {/* ── 1. Editorial Hero (Video Reel Showcase) ── */}
      <section className={styles.hero}>
        <HeroVideoShowcase />
      </section>

      {/* ── 2. Designer Brand Marquee Ticker (RTR Ticker analogue) ── */}
      <BrandTicker />

      {/* ── 3. Visual Occasions Carousel (RTR MoleculeVisualNav analogue) ── */}
      <MoleculeVisualNav />

      {/* ── 4. Trending Rental Looks Grid ── */}
      <section className={styles.trendingSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>MOST COVETED</span>
            <h2 className={styles.sectionHeading}>Trending for the Season</h2>
            <p className={styles.sectionDesc}>The most reserved designer pieces across our rental collective.</p>
          </div>
          <Link to="/listings" className={styles.exploreAllLink}>
            Explore Full Wardrobe →
          </Link>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <p>Curating trending pieces...</p>
          </div>
        ) : listings.length > 0 ? (
          <div className={styles.listingsGrid}>
            {listings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No listings currently available. Be the first to list a designer look!</p>
            <Link to="/listings/new" className={styles.ctaButton}>List a Piece</Link>
          </div>
        )}
      </section>

      {/* ── 5. How It Works (RTR 3-Step Sliding Value Proposition) ── */}
      <SlidingValueProps />

      {/* ── 6. Bottom Membership & Seller CTA ── */}
      <section className={styles.bottomCtaSection}>
        <div className={styles.bottomCtaContainer}>
          <span className={styles.ctaEyebrow}>CIRCULAR FASHION REVOLUTION</span>
          <h2 className={styles.ctaHeading}>Monetize Your Own Atelier Wardrobe</h2>
          <p className={styles.ctaText}>
            List your luxury lehengas, gowns, and designer occasion wear. Earn recurring rental income while verified courier delivery and deposit security are completely handled.
          </p>
          <div className={styles.ctaButtonGroup}>
            <Link to="/listings/new" className={styles.primaryCtaBtn}>Start Renting Out</Link>
            <Link to="/listings" className={styles.secondaryCtaBtn}>Browse Collection</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
