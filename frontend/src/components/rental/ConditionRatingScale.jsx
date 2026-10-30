import React, { useState } from 'react';
import styles from './infographics.module.css';

export const CONDITION_TIERS = [
  {
    grade: 'Pristine / Like New',
    score: '10 / 10',
    numericScore: 10,
    tag: 'Showroom Crisp',
    summary: 'Never worn with tags or rented once under white-glove supervision. Zero signs of wear.',
    description: 'Zero signs of wear, fabric has original showroom crispness, embroidery 100% intact.',
    inspectionItems: [
      'Flawless lining',
      'Zero thread pulls',
      'Mirror work 100% intact',
      'Original tags intact',
    ],
  },
  {
    grade: 'Excellent',
    score: '9 / 10',
    numericScore: 9,
    tag: 'Socially Indistinguishable',
    summary: 'Rented 2–3 times. Indistinguishable from new at social distance. Fabric has showroom crispness.',
    description: 'Impeccable condition. Minor handling marks on inner hook eyelets only.',
    inspectionItems: [
      '365nm UV stain-free',
      'Zari threads tight',
      'Zippers lubricated',
      'Freshly pressed pleats',
    ],
  },
  {
    grade: 'Very Good',
    score: '8 / 10',
    numericScore: 8,
    tag: 'Gentle Occasion Wear',
    summary: 'Gentle occasion wear. Minor micro-imperfections only visible upon close inspection.',
    description: 'Superb appearance when worn. Light softening of fabric hand-feel.',
    inspectionItems: [
      'Secured side seams',
      'Re-pressed pleats',
      'Zero exterior stains',
      'Fully functional hardware',
    ],
  },
  {
    grade: 'Good',
    score: '7 / 10',
    numericScore: 7,
    tag: 'Discounted Rental Tier',
    summary: 'Minor flaws present but invisible when photographed or worn at a social event.',
    description: 'Repaired seam (< 3"), tiny snag on inner kali hem, reinforced hook rows.',
    inspectionItems: [
      'Repaired seam (< 3")',
      'Tiny snag on inner kali hem',
      'Reinforced hook rows',
      'Sanitized & deodorized',
    ],
  },
  {
    grade: 'Fair / Archive',
    score: '6 / 10',
    numericScore: 6,
    tag: 'Vintage Collector',
    summary: 'Vintage or archived collector piece with visible patina. Listed for editorial shoots or heritage collections.',
    description: 'Visible wear on metallic zari, labeled "Vintage Heritage", fully cleaned lining.',
    inspectionItems: [
      'Visible wear on metallic zari',
      'Labeled "Vintage Heritage"',
      'Cleaned lining',
      'Intact structure',
    ],
  },
];

export const CORE_INSPECTION_CHECKPOINTS = [
  { id: 'seam', label: 'Seam Integrity', desc: 'No tears or fabric splitting; side basting stitches clean' },
  { id: 'zari', label: 'Zari Luster', desc: 'Metallic gold/silver zari unoxidized; zero thread unraveling' },
  { id: 'embroidery', label: 'Embroidery Retention', desc: 'Sequins, cutdana, and beads firmly anchored' },
  { id: 'lining', label: 'Lining Cleanliness', desc: 'Zero perspiration or cosmetics transfer; deodorized' },
  { id: 'aroma', label: 'Aroma Check', desc: 'Molecular ozone treatment verified; zero lingering fragrance' },
  { id: 'hardware', label: 'Hardware Function', desc: 'Heavy-duty metal zippers glide smoothly; hooks firmly stitched' },
  { id: 'uv', label: 'Optical UV Micro-Scan', desc: '365nm UV scan verifies zero invisible biological or chemical stains' },
];

export function ConditionRatingScale({
  selectedScore,
  onSelectScore,
  mode = 'view',
  compact = false,
  className = '',
}) {
  const getInitialIndex = () => {
    if (selectedScore !== undefined && selectedScore !== null) {
      const num = Number(selectedScore);
      if (num >= 6 && num <= 10) {
        // Map 10 -> 0, 9 -> 1, 8 -> 2, 7 -> 3, 6 -> 4
        return 10 - num;
      }
      if (num >= 0 && num < CONDITION_TIERS.length) {
        return num;
      }
    }
    return 0; // Default to Pristine
  };

  const [selectedTierIndex, setSelectedTierIndex] = useState(getInitialIndex);
  const [checkedCheckpoints, setCheckedCheckpoints] = useState({});

  const handleSelectTier = (index) => {
    const clamped = Math.max(0, Math.min(CONDITION_TIERS.length - 1, index));
    setSelectedTierIndex(clamped);
    if (typeof onSelectScore === 'function') {
      onSelectScore(CONDITION_TIERS[clamped].numericScore);
    }
  };

  const toggleCheckpoint = (id) => {
    setCheckedCheckpoints((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const currentTier = CONDITION_TIERS[selectedTierIndex] || CONDITION_TIERS[0];
  const isGradeMode = mode === 'grade';

  return (
    <section
      className={`${styles.container} ${compact ? styles.compactContainer : ''} ${className}`}
      aria-label="Condition Rating Scale & Verification Checklist"
    >
      <div className={`${styles.header} ${compact ? styles.compactHeader : ''}`}>
        <span className={styles.badge}>VESTIAIRE-INSPIRED INSPECTION STANDARD</span>
        <h2 className={`${styles.title} ${compact ? styles.compactTitle : ''}`}>
          10-Point Condition Rating &amp; Verification Scale
        </h2>
        <p className={styles.subtitle}>
          Every piece is physically verified by in-house fashion appraisers before approval to guarantee absolute authenticity and quality.
        </p>
      </div>

      {/* Tier Selector Tabs */}
      <div className={styles.tierTabsTrack} role="tablist" aria-label="Condition Tiers">
        {CONDITION_TIERS.map((tier, idx) => {
          const isActive = selectedTierIndex === idx;
          return (
            <button
              key={tier.grade}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`condition-panel-${tier.numericScore}`}
              id={`condition-tab-${tier.numericScore}`}
              className={`${styles.tierTab} ${isActive ? styles.tierTabActive : ''}`}
              onClick={() => handleSelectTier(idx)}
            >
              <span className={styles.tierScorePill}>{tier.score}</span>
              <span className={styles.tierTabName}>{tier.grade.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tier Callout & Inspection Checklist Card */}
      <div
        className={styles.conditionCard}
        id={`condition-panel-${currentTier.numericScore}`}
        role="tabpanel"
        aria-labelledby={`condition-tab-${currentTier.numericScore}`}
      >
        <div className={styles.conditionCardHeader}>
          <h3 className={styles.conditionGradeTitle}>
            Grade: {currentTier.grade} ({currentTier.score})
          </h3>
          <span className={styles.conditionBadgeTag}>
            {currentTier.tag}
          </span>
        </div>

        <p className={styles.conditionSummary}>{currentTier.summary}</p>
        <p className={styles.conditionDescription}>{currentTier.description}</p>

        {/* Tier Specific Verification Checklist */}
        <div className={styles.checklistSection}>
          <div className={styles.checklistTitle}>
            {isGradeMode ? 'Check All Applicable Inspection Standards:' : 'Tier Appraisal Verification Standards:'}
          </div>
          <div className={styles.checklistGrid}>
            {currentTier.inspectionItems.map((item, i) => (
              <div key={item} className={styles.checklistItem}>
                {isGradeMode ? (
                  <input
                    type="checkbox"
                    id={`check-tier-${currentTier.numericScore}-${i}`}
                    checked={Boolean(checkedCheckpoints[`${currentTier.numericScore}-${i}`])}
                    onChange={() => toggleCheckpoint(`${currentTier.numericScore}-${i}`)}
                    className={styles.checkboxInput}
                  />
                ) : (
                  <span className={styles.checkIcon} aria-hidden="true">✓</span>
                )}
                <label htmlFor={`check-tier-${currentTier.numericScore}-${i}`}>
                  {item}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* 7 Core Physical Verification Points (Shown in Grade Mode or Full Mode) */}
        {(!compact || isGradeMode) && (
          <div className={styles.checklistSection} style={{ marginTop: 'var(--space-5)' }}>
            <div className={styles.checklistTitle}>
              7-Point In-House Physical Verification Protocol:
            </div>
            <div className={styles.checklistGrid}>
              {CORE_INSPECTION_CHECKPOINTS.map((cp) => (
                <div key={cp.id} className={styles.checklistItem}>
                  {isGradeMode ? (
                    <input
                      type="checkbox"
                      id={`check-core-${cp.id}`}
                      checked={Boolean(checkedCheckpoints[cp.id])}
                      onChange={() => toggleCheckpoint(cp.id)}
                      className={styles.checkboxInput}
                    />
                  ) : (
                    <span className={styles.checkIcon} aria-hidden="true">✓</span>
                  )}
                  <div>
                    <strong>{cp.label}</strong>
                    <div style={{ fontSize: '0.9em', color: 'var(--color-ink-muted)' }}>{cp.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ConditionRatingScale;
