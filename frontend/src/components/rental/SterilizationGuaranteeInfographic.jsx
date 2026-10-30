import React, { useState, useEffect } from 'react';
import styles from './infographics.module.css';

export const STERILIZATION_STAGES = [
  {
    number: 1,
    title: '365nm UV Inspection',
    subtitle: 'Optical Micro-Scan',
    details: 'Full spectrum optical inspection detects hidden thread stress, micro-abrasions, invisible bodily blemishes, and fabric thinning under 365nm ultraviolet radiation.',
    icon: '🔬',
    metric: '100% Optical Scan',
  },
  {
    number: 2,
    title: 'Hydrocarbon Eco-Clean',
    subtitle: 'Perc-Free Solvent Wash',
    details: 'Zero harsh perchloroethylene chemicals; natural organic hydrocarbon solvents preserve delicate 24k gold zari, gota patti embroidery, and raw silk natural luster.',
    icon: '🌿',
    metric: 'Zero Perc Residue',
  },
  {
    number: 3,
    title: '140°C High-Pressure Steam',
    subtitle: 'Thermal Disinfection Tunnel',
    details: 'Hospital-grade steam tunnel eliminates 99.99% of bacteria, pathogens, and allergens while restoring fabric fiber loft, drape, and voluminous silhouette.',
    icon: '💨',
    metric: '99.99% Pathogen Elimination',
  },
  {
    number: 4,
    title: 'Enclosed Ozonation Chamber',
    subtitle: 'Molecular Deodorization',
    details: 'Active O3 ozone gas safely neutralizes all perfume notes, food aromas, and organic volatile compounds down to the molecular level without water contact.',
    icon: '⚡',
    metric: 'Molecular Deodorization',
  },
  {
    number: 5,
    title: 'Artisan Zari Restoration',
    subtitle: 'Hand-Embroidery Check & Zip Lube',
    details: 'Specialized master craftsmen tighten loose pearls, secure raw-edge threads, realign mirror work, and lubricate high-tension YKK metallic zippers.',
    icon: '🪡',
    metric: 'Artisan Hand Restoration',
  },
  {
    number: 6,
    title: 'Reversible Basting Fitting',
    subtitle: 'Bespoke Non-Cut Alteration',
    details: 'In-house master tailors apply temporary bespoke basting stitches according to the customer\'s exact bust, waist, and heel measurements using internal 2.5" margins.',
    icon: '📏',
    metric: '2.5" Non-Cut Seam Margins',
  },
  {
    number: 7,
    title: 'Hermetic Pod Sealing',
    subtitle: 'Tamper-Evident Delivery Pod',
    details: 'Hermetically sealed inside a dust-proof, breathable organic cotton-linen garment pod with a serialized tamper-evident security seal tag.',
    icon: '🛡️',
    metric: 'Tamper-Evident Security Seal',
  },
];

export function SterilizationGuaranteeInfographic({
  compact = false,
  onSelectStage,
  initialStage = 1,
  className = '',
}) {
  const [activeStage, setActiveStage] = useState(() => {
    const clamped = Math.max(1, Math.min(7, Number(initialStage) || 1));
    return clamped;
  });

  const handleSelect = (stageNum) => {
    const clamped = Math.max(1, Math.min(7, stageNum));
    setActiveStage(clamped);
    if (typeof onSelectStage === 'function') {
      onSelectStage(clamped);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleSelect(activeStage > 1 ? activeStage - 1 : 7);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleSelect(activeStage < 7 ? activeStage + 1 : 1);
    }
  };

  const currentStage = STERILIZATION_STAGES[activeStage - 1] || STERILIZATION_STAGES[0];

  return (
    <section
      className={`${styles.container} ${compact ? styles.compactContainer : ''} ${className}`}
      aria-label="Sterilization & Hygiene Guarantee"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className={`${styles.header} ${compact ? styles.compactHeader : ''}`}>
        <span className={styles.badge}>HOSPITAL-GRADE PROTOCOL</span>
        <h2 className={`${styles.title} ${compact ? styles.compactTitle : ''}`}>
          The 7-Stage Hygiene &amp; Sterilization Guarantee
        </h2>
        <p className={styles.subtitle}>
          Every piece arrives in certified showroom condition. Safer and cleaner than buying off-the-rack.
        </p>
      </div>

      {/* Interactive Horizontal Stage Timeline */}
      <div className={styles.stepperTrack} role="tablist" aria-label="Sterilization Stages">
        {STERILIZATION_STAGES.map((s) => {
          const isActive = activeStage === s.number;
          return (
            <button
              key={s.number}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`stage-panel-${s.number}`}
              id={`stage-tab-${s.number}`}
              className={`${styles.stepButton} ${isActive ? styles.stepButtonActive : ''}`}
              onClick={() => handleSelect(s.number)}
            >
              <span className={styles.stepIcon} aria-hidden="true">{s.icon}</span>
              <span className={styles.stepNumber}>Stage 0{s.number}</span>
              <span className={styles.stepLabel}>{s.title.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Active Stage Callout Card */}
      <div
        className={styles.stageDetailCard}
        id={`stage-panel-${currentStage.number}`}
        role="tabpanel"
        aria-labelledby={`stage-tab-${currentStage.number}`}
      >
        <div className={styles.stageHeaderRow}>
          <div>
            <div className={styles.stageSubtitle}>{currentStage.subtitle}</div>
            <h3 className={styles.stageTitle}>
              Stage 0{currentStage.number}: {currentStage.title}
            </h3>
          </div>
          <span className={styles.stageCounter}>
            0{currentStage.number} / 07
          </span>
        </div>

        <p className={styles.stageDescription}>{currentStage.details}</p>

        <div className={styles.stageMetaRow}>
          <span className={styles.stageMetricBadge}>
            ✓ {currentStage.metric}
          </span>
          <span className={styles.certificationTag}>
            ✓ Verified by CleanFashion India &amp; Certified Green Dry Cleaners Accord
          </span>
        </div>

        {!compact && (
          <div className={styles.stageNavControls}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => handleSelect(activeStage - 1)}
              disabled={activeStage <= 1}
              aria-label="Previous sterilization stage"
            >
              ← Previous Stage
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => handleSelect(activeStage + 1)}
              disabled={activeStage >= 7}
              aria-label="Next sterilization stage"
            >
              Next Stage →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default SterilizationGuaranteeInfographic;
