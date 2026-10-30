import { useEffect } from 'react';
import { calculateReturnDate, formatDate } from '../../utils/formatters.js';
import styles from './RentalDatePicker.module.css';

export function RentalDatePicker({
  duration = 4,
  onDurationChange,
  deliveryDate,
  onDeliveryDateChange,
  minDate,
}) {
  // Set minimum date to tomorrow by default
  const defaultMin = minDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const returnDate = calculateReturnDate(deliveryDate, duration);

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.label}>Rental Period</span>
        <div className={styles.durationPills} role="radiogroup" aria-label="Rental duration">
          <button
            type="button"
            className={`${styles.durationBtn} ${duration === 4 ? styles.durationBtnActive : ''}`}
            onClick={() => onDurationChange(4)}
            role="radio"
            aria-checked={duration === 4}
          >
            4 Days
          </button>
          <button
            type="button"
            className={`${styles.durationBtn} ${duration === 8 ? styles.durationBtnActive : ''}`}
            onClick={() => onDurationChange(8)}
            role="radio"
            aria-checked={duration === 8}
          >
            8 Days
          </button>
        </div>
      </div>

      <div className={styles.dateSelector}>
        <div className={styles.inputGroup}>
          <label htmlFor="delivery-date-input" className={styles.sublabel}>
            Delivery Date
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="delivery-date-input"
              type="date"
              className={styles.dateInput}
              value={deliveryDate}
              min={defaultMin}
              onChange={(e) => onDeliveryDateChange(e.target.value)}
              required
            />
            <svg className={styles.calendarIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <span className={styles.helperText}>
            Tip: Arrives 1–2 days before your event
          </span>
        </div>

        {deliveryDate && returnDate && (
          <div className={styles.returnPreview}>
            <span className={styles.returnLabel}>Return Schedule</span>
            <span className={styles.returnDate}>
              Return by <strong>12:00 PM on {formatDate(returnDate)}</strong>
            </span>
            <span className={styles.returnNote}>
              Pre-paid label &amp; reusable garment bag included
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
