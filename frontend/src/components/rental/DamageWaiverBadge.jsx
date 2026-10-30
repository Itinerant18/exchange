import styles from './DamageWaiverBadge.module.css';
import { formatPaiseToRupees } from '../../utils/formatters.js';

const DEFAULT_WAIVER_FEE_PAISE = 29900; // ₹299 Festive Care Protection per blueprint §3.6

/**
 * Damage-waiver opt-in for the PDP buy box. Renters add a flat per-booking
 * fee that covers minor tears and spills; the actual charge is computed by
 * the backend at booking time from platform settings.
 */
export function DamageWaiverBadge({ checked = false, onChange, feePaise }) {
  const fee = feePaise ?? DEFAULT_WAIVER_FEE_PAISE;
  const interactive = typeof onChange === 'function';

  return (
    <div className={styles.container}>
      {interactive && (
        <label className={styles.waiverRow}>
          <input
            type="checkbox"
            className={styles.waiverCheckbox}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className={styles.waiverCopy}>
            <strong className={styles.waiverTitle}>Add Festive Care Protection — {formatPaiseToRupees(fee)}</strong>
            <span className={styles.waiverDesc}>Covers accidental food spills, seam tears &amp; loose embroidery. 100% deposit waiver.</span>
          </span>
        </label>
      )}

      <div className={styles.perk}>
        <div className={styles.iconCircle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className={styles.perkCopy}>
          <strong className={styles.perkTitle}>Damage Care Covered</strong>
          <span className={styles.perkDesc}>Minor spills, zipper snags, and routine wear covered</span>
        </div>
      </div>

      <div className={styles.perk}>
        <div className={styles.iconCircle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </div>
        <div className={styles.perkCopy}>
          <strong className={styles.perkTitle}>Professional Dry Cleaning</strong>
          <span className={styles.perkDesc}>Eco-friendly ozone sanitization handled by us upon return</span>
        </div>
      </div>

      <div className={styles.perk}>
        <div className={styles.iconCircle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div className={styles.perkCopy}>
          <strong className={styles.perkTitle}>Pre-Paid Reusable Garment Bag</strong>
          <span className={styles.perkDesc}>Just zip it up, flip the shipping label, and drop off</span>
        </div>
      </div>
    </div>
  );
}
