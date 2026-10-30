import React, { useState } from 'react';
import styles from './infographics.module.css';

export const SUSTAINABILITY_CATEGORIES = {
  Lehenga: {
    name: 'Lehenga',
    label: 'Bridal & Festive Lehenga',
    co2kg: 28.4,
    waterLitres: 3450,
    wasteDivertedKg: 4.2,
    carFactor: 4.02,
  },
  Saree: {
    name: 'Saree',
    label: 'Kanjeevaram / Banarasi Saree',
    co2kg: 14.8,
    waterLitres: 1850,
    wasteDivertedKg: 2.1,
    carFactor: 4.02,
  },
  Sherwani: {
    name: 'Sherwani',
    label: 'Embroidered Sherwani',
    co2kg: 22.1,
    waterLitres: 2900,
    wasteDivertedKg: 3.6,
    carFactor: 4.02,
  },
  Gown: {
    name: 'Gown',
    label: 'Evening / Black Tie Gown',
    co2kg: 19.5,
    waterLitres: 2400,
    wasteDivertedKg: 2.8,
    carFactor: 4.02,
  },
  Anarkali: {
    name: 'Anarkali',
    label: 'Floor-Length Anarkali',
    co2kg: 21.0,
    waterLitres: 2600,
    wasteDivertedKg: 3.2,
    carFactor: 4.02,
  },
};

export function SustainabilityImpactCalculator({
  garmentType,
  defaultCategory,
  initialRentals = 1,
  compact = false,
  className = '',
}) {
  const initialCat = garmentType || defaultCategory || 'Lehenga';
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return SUSTAINABILITY_CATEGORIES[initialCat] ? initialCat : 'Lehenga';
  });

  const [rentalsCount, setRentalsCount] = useState(() => {
    const parsed = Number(initialRentals);
    return isFinite(parsed) && parsed >= 1 ? Math.min(10, Math.floor(parsed)) : 1;
  });

  // Gracefully fallback to Lehenga constants if category is unknown
  const data = SUSTAINABILITY_CATEGORIES[selectedCategory] || SUSTAINABILITY_CATEGORIES.Lehenga;

  const totalCO2 = (data.co2kg * rentalsCount).toFixed(1);
  const totalWater = (data.waterLitres * rentalsCount).toLocaleString('en-IN');
  const carKm = Math.round(data.co2kg * rentalsCount * data.carFactor);
  const bathtubs = Math.round((data.waterLitres * rentalsCount) / 80);
  const totalWaste = (data.wasteDivertedKg * rentalsCount).toFixed(1);

  const handleRentalsChange = (newVal) => {
    const clamped = Math.max(1, Math.min(10, newVal));
    setRentalsCount(clamped);
  };

  return (
    <section
      className={`${styles.container} ${compact ? styles.compactContainer : ''} ${className}`}
      aria-label="Sustainability Impact Calculator"
    >
      <div className={`${styles.header} ${compact ? styles.compactHeader : ''}`}>
        <span className={styles.badge}>CIRCULAR SUSTAINABILITY IMPACT</span>
        <h2 className={`${styles.title} ${compact ? styles.compactTitle : ''}`}>
          Your Environmental Savings by Renting
        </h2>
        <p className={styles.subtitle}>
          Buying a single couture piece requires enormous resources. By choosing circular rental, you directly prevent:
        </p>
      </div>

      {/* Interactive Controls */}
      <div className={styles.calcControlsRow}>
        <div className={styles.controlGroup}>
          <div className={styles.controlLabel}>
            <span>Select Garment Category</span>
            <span className={styles.controlValue}>{data.name}</span>
          </div>
          <div className={styles.pillSelector} role="radiogroup" aria-label="Garment Category">
            {Object.keys(SUSTAINABILITY_CATEGORIES).map((catKey) => {
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.categoryPill} ${isSelected ? styles.categoryPillActive : ''}`}
                  onClick={() => setSelectedCategory(catKey)}
                >
                  {catKey}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <div className={styles.controlLabel}>
            <span>Circulation Count (Rentals)</span>
            <span className={styles.controlValue}>{rentalsCount} {rentalsCount === 1 ? 'Wear' : 'Wears'}</span>
          </div>
          <div className={styles.counterRow}>
            <button
              type="button"
              className={styles.counterBtn}
              onClick={() => handleRentalsChange(rentalsCount - 1)}
              disabled={rentalsCount <= 1}
              aria-label="Decrease rentals"
            >
              −
            </button>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={rentalsCount}
              onChange={(e) => handleRentalsChange(Number(e.target.value))}
              className={styles.sliderInput}
              aria-label="Rentals count slider"
            />
            <button
              type="button"
              className={styles.counterBtn}
              onClick={() => handleRentalsChange(rentalsCount + 1)}
              disabled={rentalsCount >= 10}
              aria-label="Increase rentals"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Computed Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricIcon} aria-hidden="true">💨</span>
          <div className={styles.metricValue}>{totalCO2} kg</div>
          <div className={styles.metricTitle}>CO₂e Emissions Avoided</div>
          <div className={styles.metricSubtitle}>Equivalent to driving {carKm} km in an average vehicle</div>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricIcon} aria-hidden="true">💧</span>
          <div className={styles.metricValue}>{totalWater} L</div>
          <div className={styles.metricTitle}>Freshwater Conserved</div>
          <div className={styles.metricSubtitle}>Saves {bathtubs} standard home bathtubs of water</div>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricIcon} aria-hidden="true">♻️</span>
          <div className={styles.metricValue}>{totalWaste} kg</div>
          <div className={styles.metricTitle}>Textile Landfill Diverted</div>
          <div className={styles.metricSubtitle}>100% circular asset retention &amp; zero waste</div>
        </div>
      </div>

      <div className={styles.footnote}>
        Verified by European Circular Textile Standard &amp; India Clean Fashion Accord
      </div>
    </section>
  );
}

export default SustainabilityImpactCalculator;
