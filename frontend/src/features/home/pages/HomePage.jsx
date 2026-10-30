import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
import { CatwalkVideoPlayer } from '../../../components/rental/CatwalkVideoPlayer.jsx';
import { SterilizationGuaranteeInfographic } from '../../../components/rental/SterilizationGuaranteeInfographic.jsx';
import { SustainabilityImpactCalculator } from '../../../components/rental/SustainabilityImpactCalculator.jsx';
import { LenderIncomeCalculator } from '../../../components/rental/LenderIncomeCalculator.jsx';
import { HeroVideoShowcase } from '../components/HeroVideoShowcase.jsx';
import { BrandTicker } from '../components/BrandTicker.jsx';
import { MoleculeVisualNav } from '../components/MoleculeVisualNav.jsx';
import { HeroWithExpandableTextPills } from '../components/HeroWithExpandableTextPills.jsx';
import { SlidingValueProps } from '../components/SlidingValueProps.jsx';
import { MoleculeComparisonTable } from '../components/MoleculeComparisonTable.jsx';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
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
      {/* ── 1. Editorial Hero (Rent The Runway FullCoverageHero) ── */}
      <section className={styles.hero}>
        <HeroVideoShowcase />
      </section>

      {/* ── 2. Designer Brand Marquee Ticker (RTR Ticker analogue) ── */}
      <BrandTicker />

      {/* ── 3. Visual Occasions Carousel (RTR MoleculeVisualNav analogue) ── */}
      <MoleculeVisualNav />

      {/* ── 4. Trending Rental Looks Grid with INR Pricing ── */}
      <section className={styles.trendingSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>MOST COVETED OCCASION WEAR</span>
            <h2 className={styles.sectionHeading}>Trending for the Season</h2>
            <p className={styles.sectionDesc}>
              The most reserved designer lehengas, evening gowns, and festive couture in India.
            </p>
          </div>
          <Link to="/listings?rental=true" className={styles.exploreAllLink}>
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

      {/* ── 5. RTR Expandable Interactive Tabs ("Our closet is your closet") ── */}
      <HeroWithExpandableTextPills />

      {/* ── Haute Couture in Motion: 9:16 Catwalk Video Showcase ── */}
      <section className={styles.catwalkShowcaseSection}>
        <div className={styles.editorialIntro}>
          <span className={styles.editorialEyebrow}>RUNWAY IN MOTION</span>
          <h2 className={styles.editorialHeading}>Experience Couture in 9:16 Motion</h2>
          <p className={styles.editorialText}>
            Watch how master-crafted lehenga flares, silk drapes, and hand-embroidered dupattas move on the runway.
          </p>
        </div>
        <div className={styles.catwalkContainer}>
          <CatwalkVideoPlayer
            src="/videos/hero-runway.mp4"
            poster="/videos/hero-runway-poster.jpg"
            title="Official Atelier Runway Catwalk"
            aspectRatio="9:16"
            autoPlayOnVisible={true}
            mutedDefault={true}
          />
        </div>
      </section>

      {/* ── 6. How It Works (RTR Sliding Value Proposition) ── */}
      <SlidingValueProps />

      {/* ── 7. 7-Stage Sterilization Guarantee with Editorial Introduction ── */}
      <section className={styles.infographicSection}>
        <div className={styles.editorialIntro}>
          <span className={styles.editorialEyebrow}>HOSPITAL-GRADE CLINICAL HYGIENE</span>
          <h2 className={styles.editorialHeading}>The 7-Stage Hygiene &amp; Sterilization Guarantee</h2>
          <p className={styles.editorialText}>
            Every piece arrives in certified showroom condition. Backed by 365nm UV optical micro-scanning, high-pressure steam sanitization, and molecular ozone chamber deodorization. Safer, fresher, and cleaner than buying off-the-rack.
          </p>
        </div>
        <SterilizationGuaranteeInfographic />
      </section>

      {/* ── 8. Circular Sustainability Impact Calculator ── */}
      <section className={styles.infographicSectionAlt}>
        <div className={styles.infographicInner}>
          <div className={styles.editorialIntro}>
            <span className={styles.editorialEyebrow}>CIRCULAR SUSTAINABILITY FOOTPRINT</span>
            <h2 className={styles.editorialHeading}>Calculate Your Positive Environmental Impact</h2>
            <p className={styles.editorialText}>
              By choosing circular rental over single-wear manufacturing, you conserve thousands of liters of freshwater and prevent kilograms of CO2e emissions. Select a garment silhouette and see your verified eco-savings.
            </p>
          </div>
          <SustainabilityImpactCalculator defaultCategory="Lehenga" initialRentals={1} />
        </div>
      </section>

      {/* ── 9. Wardrobe Monetization Studio / Lender Passive Income Teaser ── */}
      <section className={styles.infographicSection}>
        <div className={styles.editorialIntro}>
          <span className={styles.editorialEyebrow}>PASSIVE WARDROBE YIELD</span>
          <h2 className={styles.editorialHeading}>Turn Your Atelier Closet Into Passive Income</h2>
          <p className={styles.editorialText}>
            Designer bridal lehengas and luxury couture shouldn’t spend 360 days a year in garment bags. Calculate your estimated annual yield while white-glove transit, dry cleaning, and deposit protection are completely handled.
          </p>
        </div>
        <LenderIncomeCalculator
          initialRetailPrice={85000}
          initialRentals={6}
          onListGarment={() => navigate('/listings/new')}
        />
      </section>

      {/* ── 10. RTR Comparison Matrix ("Why buy when you could rent?") in INR ── */}
      <MoleculeComparisonTable />

      {/* ── 11. Bottom Atelier & Circular Fashion Collective CTA ── */}
      <section className={styles.bottomCtaSection}>
        <div className={styles.bottomCtaContainer}>
          <span className={styles.ctaEyebrow}>CIRCULAR FASHION REVOLUTION</span>
          <h2 className={styles.ctaHeading}>Monetize Your Own Atelier Wardrobe</h2>
          <p className={styles.ctaText}>
            List your luxury lehengas, gowns, and designer occasion wear. Earn recurring rental income while verified courier delivery, dry cleaning, and deposit security are completely handled.
          </p>
          <div className={styles.ctaButtonGroup}>
            <Link to="/listings/new" className={styles.primaryCtaBtn}>Start Renting Out</Link>
            <Link to="/listings?rental=true" className={styles.secondaryCtaBtn}>Browse Collection</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

