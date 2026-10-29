import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './HeroWithExpandableTextPills.module.css';

const PILLS = [
  {
    id: 'pill-1',
    hedText: 'Always have something new',
    dekText: 'Get all the thrills of a luxury designer shopping spree well within your budget. Rent bridal lehengas, occasion sarees, and cocktail dresses starting from ₹1,499 instead of spending ₹50,000+ to buy.',
    tag: 'BUDGET FREEDOM',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'pill-2',
    hedText: 'Take chances with your style',
    dekText: 'Sculpted corsets, hand-embroidered velvet, and experimental luxury silhouettes. Wear runway pieces you love on camera without having to store them in your closet forever.',
    tag: 'CREATIVE FREEDOM',
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'pill-3',
    hedText: 'Dress for everything on your calendar',
    dekText: 'From destination weddings in Udaipur to corporate galas and Diwali soirées. Book your 4 or 8 day reservation up to 4 months in advance with a complimentary backup size guaranteed.',
    tag: 'EVENT READY',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
  },
];

export function HeroWithExpandableTextPills() {
  const [activeId, setActiveId] = useState(PILLS[0].id);

  const activePill = PILLS.find((p) => p.id === activeId) || PILLS[0];

  return (
    <section className={styles.section} aria-label="Our closet is your closet">
      <div className={styles.container}>
        <div className={styles.contentGrid}>
          {/* Left Column: Interactive Expandable Pills */}
          <div className={styles.leftCol}>
            <span className={styles.eyebrow}>THE RUNWAY ADVANTAGE</span>
            <h2 className={styles.heading}>Our closet is your closet</h2>
            <p className={styles.subheading}>
              Elevate your personal style with unlimited access to India’s most coveted designer wardrobes.
            </p>

            <div className={styles.pillsList}>
              {PILLS.map((pill) => {
                const isActive = pill.id === activeId;
                return (
                  <div
                    key={pill.id}
                    className={`${styles.pillItem} ${isActive ? styles.pillItemActive : ''}`}
                    onClick={() => setActiveId(pill.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveId(pill.id);
                      }
                    }}
                  >
                    <div className={styles.pillHeader}>
                      <span className={styles.pillTag}>{pill.tag}</span>
                      <h3 className={styles.pillTitle}>{pill.hedText}</h3>
                      <span className={styles.pillArrow}>{isActive ? '↓' : '→'}</span>
                    </div>

                    {isActive && (
                      <div className={styles.pillBody}>
                        <p className={styles.pillText}>{pill.dekText}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.ctaWrapper}>
              <Link to="/listings?rental=true" className={styles.ctaButton}>
                Explore All Rental Looks →
              </Link>
            </div>
          </div>

          {/* Right Column: Visual Feature Imagery */}
          <div className={styles.rightCol}>
            <div className={styles.imageCard}>
              <img
                src={activePill.image}
                alt={activePill.hedText}
                className={styles.featureImage}
                loading="lazy"
              />
              <div className={styles.imageOverlay}>
                <span className={styles.overlayPill}>{activePill.tag}</span>
                <h4 className={styles.overlayHeading}>{activePill.hedText}</h4>
                <p className={styles.overlayPricing}>Rental pricing from ₹1,499 • Retail ₹45,000+</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
