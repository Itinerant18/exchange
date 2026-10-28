import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
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
      {/* ── Editorial Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>✦ THE CIRCULAR DESIGNER CLOSET</span>
          </div>

          <h1 className={styles.heroTitle}>
            Wear the Designer.<br />Skip the Retail.
          </h1>

          <p className={styles.heroSubtitle}>
            Rent luxury evening gowns, cocktail dresses, and festive occasion wear. Every booking includes a complimentary backup size and professional eco-friendly dry cleaning.
          </p>

          <div className={styles.heroCtas}>
            <Link to="/listings?rental=true" className={styles.primaryCta}>
              Explore Event Rentals
            </Link>
            <Link to="/listings?sale=true" className={styles.secondaryCta}>
              Shop Pre-Loved Sale
            </Link>
          </div>

          <div className={styles.heroMetrics}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>2 Sizes</span>
              <span className={styles.metricLabel}>Free backup size included in every order</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>100% Handled</span>
              <span className={styles.metricLabel}>Zero dry cleaning or laundry needed</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>Prepaid Return</span>
              <span className={styles.metricLabel}>Reusable garment bag with courier drop-off</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Occasion Curations ── */}
      <section className={styles.occasionsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>CURATED EDITS</span>
          <h2 className={styles.sectionHeading}>Rent by Occasion</h2>
          <p className={styles.sectionDesc}>Filter available designer pieces for your upcoming calendar events.</p>
        </div>

        <div className={styles.occasionGrid}>
          <Link to="/listings?q=Wedding" className={styles.occasionCard}>
            <div className={styles.occasionOverlay}>
              <span className={styles.occasionTitle}>Wedding Guest</span>
              <span className={styles.occasionSub}>Sarees, Lehengas & Gowns</span>
            </div>
          </Link>

          <Link to="/listings?q=Cocktail" className={styles.occasionCard}>
            <div className={styles.occasionOverlay}>
              <span className={styles.occasionTitle}>Cocktail & Party</span>
              <span className={styles.occasionSub}>Mini, Midi & Statement Silhouettes</span>
            </div>
          </Link>

          <Link to="/listings?q=Gown" className={styles.occasionCard}>
            <div className={styles.occasionOverlay}>
              <span className={styles.occasionTitle}>Black Tie Gala</span>
              <span className={styles.occasionSub}>Floor-Length Luxury & Couture</span>
            </div>
          </Link>

          <Link to="/listings?q=Dress" className={styles.occasionCard}>
            <div className={styles.occasionOverlay}>
              <span className={styles.occasionTitle}>Vacation & Resort</span>
              <span className={styles.occasionSub}>Breezy Linens & Floral Maxis</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── How It Works (Rent the Runway Standard) ── */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>HOW IT WORKS</span>
          <h2 className={styles.sectionHeading}>Four Simple Steps to Great Style</h2>
        </div>

        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNum}>01</div>
            <h3 className={styles.stepTitle}>Choose Your Dates</h3>
            <p className={styles.stepText}>
              Select a 4-day or 8-day rental duration. We recommend scheduling delivery 1–2 days before your event.
            </p>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNum}>02</div>
            <h3 className={styles.stepTitle}>Free Backup Size</h3>
            <p className={styles.stepText}>
              Pick your primary size plus a complimentary second backup size so you are guaranteed a flawless fit.
            </p>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNum}>03</div>
            <h3 className={styles.stepTitle}>Wear & Dazzle</h3>
            <p className={styles.stepText}>
              Step out in luxury without the retail price tag. Minor spills and routine wear are covered by our care policy.
            </p>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNum}>04</div>
            <h3 className={styles.stepTitle}>Effortless Return</h3>
            <p className={styles.stepText}>
              Slip both dresses into the pre-paid reusable garment bag. Drop off by noon on your return date. We handle dry cleaning!
            </p>
          </div>
        </div>
      </section>

      {/* ── Live Designer Rentals from Backend ── */}
      <section className={styles.trendingSection}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <span className={styles.sectionEyebrow}>AVAILABLE IN ATELIER</span>
            <h2 className={styles.sectionHeading}>Current Event Rentals</h2>
          </div>
          <Link to="/listings" className={styles.viewAllLink}>
            View Catalog ({listings.length}) →
          </Link>
        </div>

        {loading ? (
          <div className={styles.listingsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : listings.length > 0 ? (
          <div className={styles.listingsGrid}>
            {listings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No active rentals currently in the atelier.</p>
            <p className={styles.emptySub}>
              List your designer outfit or check back soon as our community adds new pieces.
            </p>
            <Link to="/listings/new" className={styles.primaryCta} style={{ marginTop: '1rem' }}>
              List an Outfit
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
