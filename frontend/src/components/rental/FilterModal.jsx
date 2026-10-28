import { useEffect } from 'react';
import styles from './FilterModal.module.css';

/** Facet taxonomy mirrored from backend/src/modules/listings/listingAttributes.js */
export const FACET_TAXONOMY = [
  {
    key: 'occasion',
    label: 'Occasion',
    values: ['WeddingGuest', 'Cocktail', 'BlackTie', 'Gala', 'DateNight', 'Festive', 'Workwear', 'Casual', 'Vacation'],
  },
  {
    key: 'neckline',
    label: 'Neckline',
    values: ['VNeck', 'Crew', 'Sweetheart', 'Halter', 'OffShoulder', 'Turtleneck'],
  },
  {
    key: 'sleeve',
    label: 'Sleeve Length',
    values: ['Sleeveless', 'CapSleeve', 'ShortSleeve', 'ThreeQuarter', 'LongSleeve'],
  },
  {
    key: 'length',
    label: 'Dress Length',
    values: ['Mini', 'Midi', 'Maxi', 'FloorLength', 'HighLow'],
  },
  {
    key: 'print',
    label: 'Print & Pattern',
    values: ['Solid', 'Floral', 'Animal', 'PolkaDot', 'Striped', 'Embroidered'],
  },
  {
    key: 'embellishment',
    label: 'Embellishment',
    values: ['Sequins', 'Ruffles', 'Cutouts', 'Pleats', 'Beading'],
  },
  {
    key: 'stylePersona',
    label: 'Style',
    values: ['Classic', 'Bohemian', 'Minimalist', 'Romantic', 'Glamorous'],
  },
  {
    key: 'seasonality',
    label: 'Season',
    values: ['SpringSummer', 'FallWinter', 'Resort', 'YearRound'],
  },
  {
    key: 'maternity',
    label: 'Maternity',
    values: ['MaternityFriendly', 'NotMaternity'],
  },
];

const MAX_VISIBLE_VALUES = 8;

export function FilterModal({
  open,
  onClose,
  selected = {},         // { occasion: [...], neckline: [...] }
  onToggleValue,         // (facetKey, value) => void
  onClearFacet,         // (facetKey) => void
  onClearAll,           // () => void
  facetCounts = {},     // { occasion: [{ value, count }], ... }
  activeCount = 0,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const countFor = (facetKey, value) => {
    const rows = facetCounts[facetKey];
    if (!Array.isArray(rows)) return null;
    const found = rows.find((row) => row.value === value);
    return found ? found.count : 0;
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Filter outfits"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Filters</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close filters">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {activeCount > 0 && (
            <button type="button" className={styles.clearAllBtn} onClick={onClearAll}>
              Clear all filters ({activeCount})
            </button>
          )}

          {FACET_TAXONOMY.map((facet) => (
            <section key={facet.key} className={styles.facetSection}>
              <div className={styles.facetHeader}>
                <h3 className={styles.facetTitle}>{facet.label}</h3>
                {(selected[facet.key]?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    className={styles.facetClear}
                    onClick={() => onClearFacet(facet.key)}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className={styles.facetValues}>
                {facet.values.slice(0, MAX_VISIBLE_VALUES).map((value) => {
                  const isSelected = (selected[facet.key] ?? []).includes(value);
                  const count = countFor(facet.key, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.valuePill} ${isSelected ? styles.valuePillActive : ''}`}
                      onClick={() => onToggleValue(facet.key, value)}
                      aria-pressed={isSelected}
                    >
                      <span>
                        {value
                          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                          .replace(/_/g, ' ')}
                      </span>
                      {count !== null && (
                        <span className={styles.valueCount}>{count}</span>
                      )}
                    </button>
                  );
                })}
                {facet.values.length > MAX_VISIBLE_VALUES && selected[facet.key]?.some((value) => !facet.values.slice(0, MAX_VISIBLE_VALUES).includes(value)) && (
                  <p className={styles.moreNote}>Additional selected values remain hidden.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Show Results
          </button>
        </div>
      </div>
    </div>
  );
}
