import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBag } from '../../context/BagContext.jsx';
import { rentalsApi } from '../../api/rentalsApi.js';
import { formatPaiseToRupees, formatDate } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './BagDrawer.module.css';

/**
 * Slide-out bag overlay (RTR `CEBagComponent` analogue): shows the draft
 * rental with delivery estimate framing, free backup-pair line, damage care,
 * a membership upsell banner, and a checkout hold note — while the shopper
 * keeps browsing underneath.
 */
export function BagDrawer() {
  const { draft, isOpen, closeBag, clearBag } = useBag();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [zipCode, setZipCode] = useState(() => {
    try {
      return localStorage.getItem('exchange_delivery_zip') || '';
    } catch {
      return '';
    }
  });
  const [zipConfirmed, setZipConfirmed] = useState(() => {
    try {
      return Boolean(localStorage.getItem('exchange_delivery_zip'));
    } catch {
      return false;
    }
  });

  function handleCheckZip(e) {
    if (e) e.preventDefault();
    if (zipCode.trim().length >= 4) {
      try {
        localStorage.setItem('exchange_delivery_zip', zipCode.trim());
      } catch {
        // localStorage unavailable
      }
      setZipConfirmed(true);
    }
  }

  async function handleConfirm() {
    setError('');
    if (!isAuthed) {
      closeBag();
      navigate('/login');
      return;
    }

    setSubmitting(true);
    try {
      const res = await rentalsApi.createBooking(draft.payload);
      clearBag();
      navigate(`/bookings/${res.id}`);
    } catch (err) {
      setError(err.message || 'Failed to reserve your look. Please try again.');
      setSubmitting(false);
    }
  }

  if (!isOpen || !draft) return null;
  const { payload, summary } = draft;

  return (
    <div className={styles.overlay} role="presentation" onClick={closeBag}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Your rental bag"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Your Bag</h2>
          <button type="button" className={styles.closeBtn} onClick={closeBag} aria-label="Close bag">
            ✕
          </button>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {/* ── Draft Rental Line ── */}
        <div className={styles.item}>
          {summary.image && (
            <img src={summary.image} alt={summary.title} className={styles.itemImage} />
          )}
          <div className={styles.itemBody}>
            <span className={styles.itemBrand}>{summary.brand}</span>
            <span className={styles.itemTitle}>{summary.title}</span>
            <span className={styles.itemMeta}>
              Size {summary.size}{summary.backupSize ? ` + free backup ${summary.backupSize}` : ''}
            </span>
            <span className={styles.itemMeta}>
              {formatDate(payload.startDate)} → {formatDate(payload.endDate)}
            </span>
          </div>
        </div>

        {/* ── Delivery ZIP & Transit Engine ── */}
        <div className={styles.zipSection}>
          <div className={styles.zipHeader}>
            <span className={styles.zipTitle}>Delivery ZIP / Postal Code</span>
            {zipConfirmed && (
              <button
                type="button"
                className={styles.zipChangeBtn}
                onClick={() => setZipConfirmed(false)}
              >
                Change
              </button>
            )}
          </div>
          {!zipConfirmed ? (
            <form onSubmit={handleCheckZip} className={styles.zipInputRow}>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.slice(0, 10))}
                placeholder="Enter ZIP (e.g. 560001)"
                className={styles.zipInput}
              />
              <button
                type="submit"
                className={styles.zipBtn}
                disabled={zipCode.trim().length < 4}
              >
                Check Transit
              </button>
            </form>
          ) : (
            <div className={styles.zipResult}>
              <div className={styles.zipCheckRow}>
                <span className={styles.zipIcon}>✓</span>
                <span className={styles.zipText}>
                  Guaranteed delivery to <strong>{zipCode}</strong> by 8:00 PM on{' '}
                  <strong>{formatDate(payload.startDate)}</strong>
                </span>
              </div>
              <p className={styles.zipSub}>
                Prepaid return garment bag and courier return pickup included.
              </p>
            </div>
          )}
        </div>

        {/* ── Pricing ── */}
        <div className={styles.pricing}>
          <div className={styles.row}>
            <span>Rental ({payload.durationDays ?? summary.durationDays} days)</span>
            <span>{formatPaiseToRupees(summary.subtotalPaise)}</span>
          </div>
          {payload.damageWaiver && (
            <div className={styles.row}>
              <span>Damage Care</span>
              <span>{formatPaiseToRupees(1250)}</span>
            </div>
          )}
          <div className={styles.row}>
            <span>Refundable Security Deposit (preview)</span>
            <span>{formatPaiseToRupees(summary.depositPaise)}</span>
          </div>
          <div className={`${styles.row} ${styles.totalRow}`}>
            <strong>Total</strong>
            <strong>{formatPaiseToRupees(summary.totalPaise)}</strong>
          </div>
          <p className={styles.deliveryNote}>
            Delivered before your event · Return by 12:00 PM on {formatDate(payload.endDate)}
          </p>
        </div>

        {/* ── Membership Upsell Banner ── */}
        <div className={styles.upsell}>
          <strong>Get this look — plus more every month</strong>
          <span>
            Members swap unlimited styles for one flat monthly rate. Pause or cancel anytime.
          </span>
          <button
            type="button"
            className={styles.upsellBtn}
            onClick={() => {
              closeBag();
              navigate('/listings');
            }}
          >
            Explore Membership
          </button>
        </div>

        {/* ── Checkout Hold Note ── */}
        <p className={styles.holdNote}>
          ✓ Your size is held while you check out. Bag items release automatically after 20 minutes.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.continueBtn} onClick={closeBag}>
            Continue Browsing
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Reserving…' : `Reserve Look — ${formatPaiseToRupees(summary.totalPaise)}`}
          </button>
        </div>
      </aside>
    </div>
  );
}
