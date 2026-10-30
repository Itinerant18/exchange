import React, { useState } from 'react';
import styles from './infographics.module.css';

export function LenderIncomeCalculator({
  initialRetailPrice = 85000,
  initialRentals = 6,
  compact = false,
  onListGarment,
  className = '',
}) {
  const [retailPrice, setRetailPrice] = useState(() => {
    const val = Number(initialRetailPrice);
    return isFinite(val) && val >= 25000 ? val : 85000;
  });

  const [rentalsPerYear, setRentalsPerYear] = useState(() => {
    const val = Number(initialRentals);
    if (!isFinite(val)) return 6;
    return Math.min(15, Math.max(2, Math.floor(val)));
  });

  // Rental price formula: ~6.5% of retail price for 4 days rounded to nearest ₹100
  const rentalFee = Math.round((retailPrice * 0.065) / 100) * 100;
  const grossAnnual = rentalFee * rentalsPerYear;
  const platformFee = Math.round(grossAnnual * 0.20); // 20% platform share covers insurance, courier, dry cleaning
  const netEarnings = grossAnnual - platformFee;
  const monthlyNet = Math.round(netEarnings / 12);
  const paybackYears = netEarnings > 0 ? (retailPrice / netEarnings).toFixed(1) : 'N/A';
  const roi3Year = netEarnings > 0 ? Math.round(((netEarnings * 3) / retailPrice) * 100) : 0;

  const handleCtaClick = () => {
    if (typeof onListGarment === 'function') {
      onListGarment();
    } else {
      // Default navigation to seller creation / wardrobe studio
      window.location.href = '/listings/new';
    }
  };

  return (
    <section
      className={`${styles.container} ${compact ? styles.compactContainer : ''} ${className}`}
      aria-label="Lender Passive Income Calculator"
    >
      <div className={`${styles.header} ${compact ? styles.compactHeader : ''}`}>
        <span className={`${styles.badge} ${styles.badgeGold}`}>WARDROBE MONETIZATION STUDIO</span>
        <h2 className={`${styles.title} ${compact ? styles.compactTitle : ''}`}>
          How Much Can Your Designer Wardrobe Earn?
        </h2>
        <p className={styles.subtitle}>
          Turn your wedding lehengas, sarees, and couture gowns sitting idle in closets into recurring passive income.
        </p>
      </div>

      <div className={styles.lenderCalcGrid}>
        {/* Sliders Column */}
        <div className={styles.slidersColumn}>
          <div>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderTitle}>Original Designer Retail Price</span>
              <span className={styles.sliderValueTag}>
                ₹{retailPrice.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min="25000"
              max="300000"
              step="5000"
              value={retailPrice}
              onChange={(e) => setRetailPrice(Number(e.target.value))}
              className={styles.sliderInput}
              aria-label="Original Retail Price"
            />
            <div className={styles.sliderRangeMeta}>
              <span>₹25,000</span>
              <span>₹3,00,000</span>
            </div>
          </div>

          <div>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderTitle}>Estimated Times Rented Per Year</span>
              <span className={styles.sliderValueTag}>
                {rentalsPerYear} Rentals / Year
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              step="1"
              value={rentalsPerYear}
              onChange={(e) => setRentalsPerYear(Number(e.target.value))}
              className={styles.sliderInput}
              aria-label="Estimated Rentals per year"
            />
            <div className={styles.sliderRangeMeta}>
              <span>2 rentals</span>
              <span>15 rentals</span>
            </div>
          </div>
        </div>

        {/* Real-Time Earnings Readout */}
        <div className={styles.summaryBox}>
          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>Recommended 4-Day Rental:</span>
            <span className={styles.breakdownValue}>
              ₹{rentalFee.toLocaleString('en-IN')}
            </span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>Logistics, Cleaning &amp; Insurance:</span>
            <span className={styles.breakdownValue} style={{ color: 'var(--color-ink-muted)' }}>
              -20% (Exchange handles everything)
            </span>
          </div>

          <div className={styles.netHighlightRow}>
            <span className={styles.netLabel}>Your Net Passive Income</span>
            <div className={styles.netAmount}>
              ₹{netEarnings.toLocaleString('en-IN')} <span style={{ fontSize: '0.6em', fontWeight: 500 }}>/ Year</span>
            </div>
            <div className={styles.netMonthly}>
              (Approx. ₹{monthlyNet.toLocaleString('en-IN')} / month in recurring passive yield)
            </div>
          </div>

          <div className={styles.paybackCallout}>
            ⚡ <strong>Full Investment Payback in {paybackYears} Years</strong> while retaining full ownership of your luxury asset.
            <span className={styles.roiBadge}>{roi3Year}% 3-Yr ROI</span>
          </div>

          <button
            type="button"
            className={styles.ctaButton}
            onClick={handleCtaClick}
          >
            List Your Designer Piece with White-Glove Concierge →
          </button>
        </div>
      </div>
    </section>
  );
}

export default LenderIncomeCalculator;
