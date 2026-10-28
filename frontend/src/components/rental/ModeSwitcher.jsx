import styles from './ModeSwitcher.module.css';

const MODE_LABELS = {
  rent: 'Rent',
  buy: 'Buy Pre-Owned',
};

/**
 * RTR-style "Rent" vs "Buy Pre-Owned" mode switcher for the PDP buy-box.
 * Renders the pill pair; callers decide which modes to show (a listing may
 * support both rental and resale, or only one).
 */
export function ModeSwitcher({ mode, onModeChange, availableModes = ['rent', 'buy'] }) {
  if (availableModes.length < 2) return null;

  return (
    <div className={styles.container} role="radiogroup" aria-label="Purchase mode">
      {availableModes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={`${styles.modeBtn} ${mode === candidate ? styles.modeBtnActive : ''}`}
          onClick={() => onModeChange(candidate)}
          role="radio"
          aria-checked={mode === candidate}
        >
          {MODE_LABELS[candidate] ?? candidate}
        </button>
      ))}
    </div>
  );
}
