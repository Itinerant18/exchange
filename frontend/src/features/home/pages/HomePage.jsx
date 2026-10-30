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
import { CustomerFitGallery } from '../components/CustomerFitGallery.jsx';
import { MoleculeComparisonTable } from '../components/MoleculeComparisonTable.jsx';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHygieneModal, setShowHygieneModal] = useState(false);
  const [showLenderModal, setShowLenderModal] = useState(false);
  const [showEcoModal, setShowEcoModal] = useState(false);

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
      {/* ── 1. Editorial Hero Showcase ── */}
      <section className={styles.hero}>
        <HeroVideoShowcase />
      </section>

      {/* ── 2. Designer Brand Marquee Ticker ── */}
      <BrandTicker />

      {/* ── 3. Visual Occasions Carousel ── */}
      <MoleculeVisualNav />

      {/* ── 4. Trending Rental Looks Grid with INR Pricing ── */}
      <section className={styles.trendingSection}>
        <div className={styles.sectionHeader}>
          <div>
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

      {/* ── 5. Sleek 4-Pillar Luxury Trust Ribbon (Direct Trust Reassurance) ── */}
      <section className={styles.trustBarSection} aria-label="Luxury Rental Guarantees">
        <div className={styles.trustBarContainer}>
          <div className={styles.trustPill}>
            <span className={styles.trustIcon}>✦</span>
            <div>
              <h3 className={styles.trustTitle}>7-Stage Ozone Sterilization</h3>
              <p className={styles.trustDesc}>Hospital-grade sanitization &amp; sealed presentation before and after every rental.</p>
            </div>
          </div>
          <div className={styles.trustPill}>
            <span className={styles.trustIcon}>✦</span>
            <div>
              <h3 className={styles.trustTitle}>Complimentary 2nd Backup Size</h3>
              <p className={styles.trustDesc}>Reserve a secondary size for ₹0 to guarantee a flawless, stress-free event fit.</p>
            </div>
          </div>
          <div className={styles.trustPill}>
            <span className={styles.trustIcon}>✦</span>
            <div>
              <h3 className={styles.trustTitle}>Reversible Couture Basting</h3>
              <p className={styles.trustDesc}>Expert tailor alterations on lehenga waists and blouse side-margins.</p>
            </div>
          </div>
          <div className={styles.trustPill}>
            <span className={styles.trustIcon}>✦</span>
            <div>
              <h3 className={styles.trustTitle}>Zero-Deposit Verified Booking</h3>
              <p className={styles.trustDesc}>Instant KYC check with zero high-value cash holds locked on your card.</p>
            </div>
          </div>
        </div>
        <div className={styles.trustActionRow}>
          <button
            type="button"
            className={styles.trustModalLink}
            onClick={() => setShowHygieneModal(true)}
          >
            Explore our 7-Stage Clinical Hygiene Protocol &amp; Inspection Standards →
          </button>
        </div>
      </section>

      {/* ── 6. How It Works (3-Step Frictionless Sequence) ── */}
      <SlidingValueProps />

      {/* ── 7. "Our Runway" Customer Fit Gallery (Real UGC Social Proof) ── */}
      <CustomerFitGallery />

      {/* ── Curated Expandable Atelier Intel ("Our closet is your closet") ── */}
      <HeroWithExpandableTextPills />

      {/* ── Haute Couture in Motion: 9:16 Catwalk Showcase ── */}
      <section className={styles.catwalkShowcaseSection}>
        <div className={styles.editorialIntro}>
          <h2 className={styles.editorialHeading}>Haute Couture in Motion</h2>
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

      {/* ── Circular Sustainability Impact Statement ── */}
      <section className={styles.circularPledgeSection} aria-label="Circular Luxury Sustainability">
        <div className={styles.circularPledgeContainer}>
          <h2 className={styles.editorialHeading}>The Environmental Power of Renting</h2>
          <p className={styles.circularStatSummary}>
            Choosing circular fashion over single-wear manufacturing conserves up to <strong>3,450 liters of freshwater</strong> and prevents <strong>28.4 kg of CO₂e</strong> per ensemble. Together, our community has diverted thousands of kilograms of designer luxury from landfills.
          </p>
          <div className={styles.circularActions}>
            <button
              type="button"
              className={styles.editorialOutlineBtn}
              onClick={() => setShowEcoModal(true)}
            >
              Simulate Your Environmental Savings →
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. High-Fashion Editorial Atelier Wardrobe Monetization Banner ── */}
      <section className={styles.atelierBannerSection} aria-label="Monetize Your Atelier Closet">
        <div className={styles.atelierBannerCard}>
          <div className={styles.atelierContent}>
            <h2 className={styles.atelierHeading}>Turn Your Designer Closet Into Passive Income</h2>
            <p className={styles.atelierText}>
              Designer bridal lehengas and luxury couture shouldn’t sit idle in garment bags.
              Earn recurring rental income while verified courier transit, dry cleaning, and deposit security are completely handled.
            </p>
            <div className={styles.atelierButtonGroup}>
              <Link to="/listings/new" className={styles.atelierPrimaryBtn}>
                List Your Designer Piece →
              </Link>
              <button
                type="button"
                className={styles.atelierSecondaryBtn}
                onClick={() => setShowLenderModal(true)}
              >
                Estimate Your Wardrobe Yield
              </button>
              <Link to="/lend" className={styles.atelierSecondaryBtn}>
                Explore Lender Studio &amp; FAQs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── RTR Comparison Matrix ("Why buy when you could rent?") in INR ── */}
      <MoleculeComparisonTable />

      {/* ── Hygiene & Sterilization Protocol Modal Overlay ── */}
      {showHygieneModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowHygieneModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowHygieneModal(false)}
              aria-label="Close hygiene protocol modal"
            >
              ✕
            </button>
            <SterilizationGuaranteeInfographic compact={false} />
          </div>
        </div>
      )}

      {/* ── Sustainability Impact Simulation Modal Overlay ── */}
      {showEcoModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowEcoModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowEcoModal(false)}
              aria-label="Close sustainability calculator modal"
            >
              ✕
            </button>
            <SustainabilityImpactCalculator defaultCategory="Lehenga" initialRentals={1} />
          </div>
        </div>
      )}

      {/* ── Lender Monetization Studio Modal Overlay ── */}
      {showLenderModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowLenderModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowLenderModal(false)}
              aria-label="Close lender income calculator modal"
            >
              ✕
            </button>
            <LenderIncomeCalculator
              initialRetailPrice={85000}
              initialRentals={6}
              onListGarment={() => {
                setShowLenderModal(false);
                navigate('/listings/new');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

