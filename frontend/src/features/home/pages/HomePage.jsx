import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appConfig } from '../../../config/appConfig.js';
import { apiRequest } from '../../../services/apiClient.js';
import styles from './HomePage.module.css';

export function HomePage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/listings?limit=6')
      .then((data) => setListings(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero} aria-labelledby="home-heading">
        <div className={styles.heroBg} aria-hidden="true">
          <div className={styles.heroGradient} />
          <div className={styles.heroPattern} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Circular fashion marketplace
            </p>

            <h1 id="home-heading" className={styles.heading}>
              Wear more.
              <br />
              Own less.
            </h1>

            <p className={styles.lede}>
              Rent, resell, and discover fashion that moves with you —
              not the other way around.
            </p>

            <div className={styles.heroActions}>
              <Link to="/listings" className="btn btn-primary">
                Browse listings
                <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link to="/register" className="btn btn-secondary">
                Start selling
              </Link>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>Quality-first</span>
                <span className={styles.heroStatLabel}>Curated listings & verified sellers</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>Circular by design</span>
                <span className={styles.heroStatLabel}>Rent, resell, repeat</span>
              </div>
            </div>
          </div>

          <div className={styles.heroPanel} aria-label="Platform information">
            <div className={styles.panelBadge}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4v3M7 9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Live platform
            </div>
            <h2 className={styles.panelTitle}>Foundations first.</h2>
            <ul className={styles.panelList}>
              <li>React 19 + Vite 8</li>
              <li>Express REST API</li>
              <li>PostgreSQL in Docker</li>
              <li>Full auth flow ready</li>
            </ul>
            <p className={styles.panelMeta}>
              Health check{' '}
              <code className={styles.panelCode}>
                {appConfig.apiBaseUrl}/health
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="section container">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Shop by category</h2>
          <p className={styles.sectionSubtitle}>
            Find what fits your season, your style, your budget.
          </p>
        </div>

        <div className={styles.categories}>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/listings?category=${cat.slug}`}
              className={styles.categoryCard}
            >
              <span className={styles.categoryIcon} aria-hidden="true">
                {cat.icon}
              </span>
              <span className={styles.categoryName}>{cat.name}</span>
              <span className={styles.categoryCount}>Explore →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured listings ── */}
      {listings.length > 0 && (
        <section className="section container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Featured listings</h2>
            <p className={styles.sectionSubtitle}>
              Fresh from our community, sorted for you.
            </p>
            <Link to="/listings" className="btn btn-ghost" style={{ marginTop: 'var(--space-4)' }}>
              View all listings
            </Link>
          </div>

          <div className={styles.listingsGrid}>
            {loading ? (
              <div className={styles.listingsSkeleton}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={styles.skeletonCard}>
                    <div className={styles.skeletonImage} />
                    <div className={styles.skeletonBody}>
                      <div className={styles.skeletonLine} style={{ width: '60%' }} />
                      <div className={styles.skeletonLine} style={{ width: '80%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              listings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listings/${listing.id}`}
                  className={styles.listingCard}
                >
                  <div className={styles.listingImage}>
                    <div className={styles.listingImagePlaceholder}>
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                        <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M4 16h24" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    {(listing.isRental || listing.isSale) && (
                      <span className={`badge badge-${listing.isRental ? 'accent' : 'olive'} ${styles.badgeOverlay}`}>
                        {listing.isRental ? 'Rent' : 'Buy'}
                      </span>
                    )}
                  </div>

                  <div className={styles.listingBody}>
                    <div className={styles.listingCondition}>
                      {listing.condition || 'good'}
                    </div>
                    <h3 className={styles.listingTitle}>
                      {listing.title}
                    </h3>
                    <p className={styles.listingLocation}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M6 1a4 4 0 100 8 4 4 0 000-8zM1 8a5 5 0 1110 0 5 5 0 01-10 0z" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="6" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      {listing.city || 'Location not set'}
                    </p>
                  </div>

                  <div className={styles.listingFooter}>
                    {listing.isRental && listing.rentalPricePaise && (
                      <span className={styles.listingPrice}>
                        ₹{(listing.rentalPricePaise / 100).toFixed(0)}
                        <span className={styles.listingPriceUnit}>/day</span>
                      </span>
                    )}
                    {listing.isSale && listing.salePricePaise && (
                      <span className={styles.listingPrice}>
                        ₹{(listing.salePricePaise / 100).toFixed(0)}
                      </span>
                    )}
                    {listing.deliveryAvailable && (
                      <span className="badge badge-success">
                        Delivery
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      )}

      {/* ── Value props ── */}
      <section className={styles.valueProps}>
        <div className="container">
          <div className={styles.valuePropsInner}>
            {valueProps.map((prop, i) => (
              <div key={i} className={styles.valueProp}>
                <div className={styles.valuePropIcon} aria-hidden="true">
                  {prop.icon}
                </div>
                <h3 className={styles.valuePropTitle}>{prop.title}</h3>
                <p className={styles.valuePropDesc}>{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

const categories = [
  { slug: 'tops', name: 'Tops & T-shirts', icon: '👕' },
  { slug: 'bottoms', name: 'Bottoms & Denim', icon: '👖' },
  { slug: 'dresses', name: 'Dresses & Jumpsuits', icon: '👗' },
  { slug: 'outerwear', name: 'Jackets & Outerwear', icon: '🧥' },
  { slug: 'shoes', name: 'Footwear', icon: '👟' },
  { slug: 'bags', name: 'Bags & Accessories', icon: '👜' },
];

const valueProps = [
  {
    title: 'Rent, don\'t buy',
    description: 'Access premium pieces for a fraction of the cost. Perfect for events, travel, or experimenting with new styles.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 8v8l6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Sell what you don\'t wear',
    description: 'Turn your closet surplus into cash. List once, sell to the right person.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 24V8a4 4 0 014-4h12a4 4 0 014 4v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 12v8M12 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Verified quality',
    description: 'Every listing is inspected and described honestly. Know exactly what you\'re getting.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4L4 20h6v8h8v-8h6L16 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

