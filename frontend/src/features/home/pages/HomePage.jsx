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

const CATWALK_REELS = [
  {
    id: 'catwalk-1',
    category: 'bridal',
    designer: 'Sabyasachi Archive',
    title: 'Heritage Crimson Velvet Zardozi Lehenga',
    motionTag: '360° Kali Flare & Swish',
    videoSrc: '/videos/catwalk-bridal-lehenga.mp4',
    poster: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    rentalPrice: '₹6,500 / 4 days',
    retailAnchor: '₹2,85,000',
    link: '/listings?category=Lehenga',
  },
  {
    id: 'catwalk-2',
    category: 'gowns',
    designer: 'Badgley Mischka',
    title: 'Emerald Cascade Liquid Silk Pleated Gown',
    motionTag: 'Floor-Sweeping Train & Drape',
    videoSrc: '/videos/catwalk-evening-gown.mp4',
    poster: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
    rentalPrice: '₹4,200 / 4 days',
    retailAnchor: '₹1,45,000',
    link: '/listings?category=Gown',
  },
  {
    id: 'catwalk-3',
    category: 'drapes',
    designer: 'Tarun Tahiliani',
    title: 'Champagne Sheer Organza Concept Saree',
    motionTag: 'Airy Pallu Suspension & Flow',
    videoSrc: '/videos/catwalk-saree-drape.mp4',
    poster: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    rentalPrice: '₹5,100 / 4 days',
    retailAnchor: '₹1,95,000',
    link: '/listings?category=Saree',
  },
  {
    id: 'catwalk-4',
    category: 'gowns',
    designer: 'Manish Malhotra',
    title: 'Midnight Starry Sequined Runway Column',
    motionTag: 'Dynamic Runway Reflection',
    videoSrc: '/videos/hero-runway.mp4',
    poster: '/videos/hero-runway-poster.jpg',
    rentalPrice: '₹5,800 / 4 days',
    retailAnchor: '₹2,20,000',
    link: '/listings?occasion=BlackTie',
  },
];

const CATWALK_CATEGORIES = [
  { id: 'all', label: 'All Runway Looks (4)' },
  { id: 'bridal', label: 'Bridal Lehengas' },
  { id: 'gowns', label: 'Evening Gowns' },
  { id: 'drapes', label: 'Contemporary Drapes' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHygieneModal, setShowHygieneModal] = useState(false);
  const [showLenderModal, setShowLenderModal] = useState(false);
  const [showEcoModal, setShowEcoModal] = useState(false);
  const [activeCatwalkCategory, setActiveCatwalkCategory] = useState('all');

  const filteredCatwalkReels = activeCatwalkCategory === 'all'
    ? CATWALK_REELS
    : CATWALK_REELS.filter((item) => item.category === activeCatwalkCategory);

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

      {/* ── Haute Couture in Motion: 9:16 Catwalk Showcase (Multi-Video Runway) ── */}
      <section className={styles.catwalkShowcaseSection} aria-label="Haute Couture Runway Video Showcase">
        <div className={styles.catwalkHeader}>
          <span className={styles.catwalkEyebrow}>✦ 9:16 RUNWAY MOTION ENGINE</span>
          <h2 className={styles.catwalkHeading}>Haute Couture in Motion</h2>
          <p className={styles.catwalkSubtext}>
            Observe how master-crafted lehenga flares, liquid silk cascades, and hand-embroidered zari dupattas move on live runways before reserving your look.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className={styles.catwalkFilterTabs}>
          {CATWALK_CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.catwalkFilterBtn} ${activeCatwalkCategory === tab.id ? styles.catwalkFilterBtnActive : ''}`}
              onClick={() => setActiveCatwalkCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 4-Column Responsive Runway Video Grid */}
        <div className={styles.catwalkGrid}>
          {filteredCatwalkReels.map((reel) => (
            <div key={reel.id} className={styles.catwalkCard}>
              <div className={styles.catwalkPlayerWrapper}>
                <CatwalkVideoPlayer
                  src={reel.videoSrc}
                  poster={reel.poster}
                  title={reel.title}
                  aspectRatio="9:16"
                  autoPlayOnVisible={true}
                  mutedDefault={true}
                />
              </div>
              <div className={styles.catwalkCardMeta}>
                <span className={styles.catwalkMotionBadge}>✦ {reel.motionTag}</span>
                <span className={styles.catwalkDesigner}>{reel.designer}</span>
                <h3 className={styles.catwalkTitle}>{reel.title}</h3>
                <div className={styles.catwalkPricingRow}>
                  <span className={styles.catwalkRentalPrice}>{reel.rentalPrice}</span>
                  <span className={styles.catwalkRetailAnchor}>{reel.retailAnchor}</span>
                </div>
                <Link to={reel.link} className={styles.catwalkActionBtn}>
                  Reserve Look →
                </Link>
              </div>
            </div>
          ))}
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

