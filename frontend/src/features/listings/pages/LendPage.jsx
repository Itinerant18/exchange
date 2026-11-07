import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LenderIncomeCalculator } from '../../../components/rental/LenderIncomeCalculator.jsx';
import styles from './LendPage.module.css';

export function LendPage() {
  const navigate = useNavigate();
  const [showStickyCta, setShowStickyCta] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      {/* ── 1. High-Fashion Editorial Hero ── */}
      <section ref={heroRef} className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <span className={styles.heroBadge}>✦ Monétize Your Atelier Wardrobe</span>
          <h1 className={styles.heroHeading}>Turn Unworn Couture Into Recurring Passive Income</h1>
          <p className={styles.heroSubheading}>
            Designer bridal lehengas, sherwanis, and luxury festive wear shouldn’t sit idle in garment bags.
            Earn up to 80% net payout while we handle white-glove ozone cleaning, verified courier transit, and deposit security.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/listings/new" className={styles.primaryCta}>
              List Your Designer Look →
            </Link>
            <a href="#calculator" className={styles.secondaryCta}>
              Simulate Your Earnings
            </a>
          </div>
        </div>
      </section>

      {/* ── 2. Full Interactive Lender Monetization Studio ── */}
      <section id="calculator" className={styles.studioSection}>
        <LenderIncomeCalculator
          initialRetailPrice={85000}
          initialRentals={6}
          compact={false}
          onListGarment={() => navigate('/listings/new')}
        />
      </section>

      {/* ── How It Works Timeline ── */}
      <section className={styles.timelineSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.timelineBadge}>CONCIERGE PROCESS</span>
          <h2 className={styles.sectionHeading}>How Lending Works</h2>
          <p className={styles.sectionSub}>Four simple steps from closet archive to recurring passive yield.</p>
        </div>

        <div className={styles.timelineList}>
          <div className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <span className={styles.timelineStepNumber}>01</span>
              <div className={styles.timelineLine} />
            </div>
            <div className={styles.timelineContent}>
              <h3 className={styles.timelineTitle}>List in Under 3 Minutes</h3>
              <p className={styles.timelineDesc}>
                Take photos or upload your outfit's photos and video. Set your custom rental fee or accept our algorithmic recommendation.
              </p>
            </div>
          </div>

          <div className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <span className={styles.timelineStepNumber}>02</span>
              <div className={styles.timelineLine} />
            </div>
            <div className={styles.timelineContent}>
              <h3 className={styles.timelineTitle}>White-Glove Courier Pickup</h3>
              <p className={styles.timelineDesc}>
                When booked, our insured courier collects the outfit in a custom garment box. We perform 365nm optical inspection before handover.
              </p>
            </div>
          </div>

          <div className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <span className={styles.timelineStepNumber}>03</span>
              <div className={styles.timelineLine} />
            </div>
            <div className={styles.timelineContent}>
              <h3 className={styles.timelineTitle}>Hospital-Grade Cleaning</h3>
              <p className={styles.timelineDesc}>
                After the event, we retrieve the piece and perform 7-stage eco-hydrocarbon dry cleaning and 140°C ozone sanitization.
              </p>
            </div>
          </div>

          <div className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <span className={styles.timelineStepNumber}>04</span>
            </div>
            <div className={styles.timelineContent}>
              <h3 className={styles.timelineTitle}>80% Direct Bank Payout</h3>
              <p className={styles.timelineDesc}>
                Payouts are transferred automatically to your verified bank account with 0% hassle. Full damage and replacement guarantee included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. 3-Pillar Value Proposition ── */}
      <section className={styles.pillarsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionHeading}>Why Top Wardrobe Owners Lend with Exchange</h2>
          <p className={styles.sectionSub}>A seamless, luxury-grade consignment experience designed for couture preservation.</p>
        </div>

        <div className={styles.pillarsGrid}>
          <div className={styles.pillarCard}>
            <span className={styles.pillarIcon}>✦</span>
            <h3 className={styles.pillarTitle}>80% Net Passive Payout</h3>
            <p className={styles.pillarDesc}>
              Keep full ownership of your archive. Receive automatic direct-to-bank payouts after each rental return with 20% platform care covering logistics.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <span className={styles.pillarIcon}>✦</span>
            <h3 className={styles.pillarTitle}>Hospital-Grade Sterilization</h3>
            <p className={styles.pillarDesc}>
              Every garment undergoes 7-stage eco-hydrocarbon dry cleaning and 140°C ozone sanitization. Your piece returns in showroom condition.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <span className={styles.pillarIcon}>✦</span>
            <h3 className={styles.pillarTitle}>Zero-Deposit KYC &amp; Insurance</h3>
            <p className={styles.pillarDesc}>
              Renters undergo strict biometric KYC verification. Every booking includes ₹299 Festive Care protection against accidental spills and seam stress.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Frequently Asked Questions ── */}
      <section className={styles.faqSection}>
        <div className={styles.faqContainer}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionHeading}>Lender Protection &amp; FAQs</h2>
            <p className={styles.sectionSub}>Everything you need to know about listing your couture on Exchange.</p>
          </div>

          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What happens if a renter damages my outfit?</h3>
              <p className={styles.faqAnswer}>
                Every rental booking is backed by our mandatory Damage Care policy and full replacement value guarantee.
                Minor issues (loose sequins, temporary hem basting) are restored in-house by our master tailors.
                In the rare event of major damage, you receive full replacement reimbursement.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need to clean the garment before or after lending?</h3>
              <p className={styles.faqAnswer}>
                Never. Our operations team manages professional hydrocarbon dry cleaning, optical UV inspection, and sealed garment bag packaging before and after every rental.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I block off dates if I want to wear my own outfit?</h3>
              <p className={styles.faqAnswer}>
                Yes, you have 100% calendar autonomy. You can pause or black-out your outfit's availability whenever you have an upcoming personal wedding or festival.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Bottom Atelier Call to Action ── */}
      <section className={styles.bottomCtaSection}>
        <div className={styles.bottomCtaCard}>
          <h2 className={styles.bottomCtaTitle}>Ready to Monetize Your Wardrobe?</h2>
          <p className={styles.bottomCtaText}>
            Join India’s premier luxury circular fashion collective. List your designer piece in under 3 minutes.
          </p>
          <Link to="/listings/new" className={styles.primaryCta}>
            List Your First Piece →
          </Link>
        </div>
      </section>

      {/* ── 6. Sticky Bottom CTA Bar on Mobile ── */}
      {showStickyCta && (
        <div className={styles.stickyBottomBar}>
          <div className={styles.stickyBottomInner}>
            <div className={styles.stickyBottomInfo}>
              <span className={styles.stickyBottomTitle}>Monetize Couture</span>
              <span className={styles.stickyBottomSub}>Earn up to 80% net payout</span>
            </div>
            <Link to="/listings/new" className={styles.stickyBottomBtn}>
              Start Listing →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
