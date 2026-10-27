import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import styles from './BookingsPage.module.css';

export function MyBookingsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/rentals/bookings?role=renter')
      .then((d) => setRows(Array.isArray(d) ? d : (d?.data ?? []))) // eslint-disable-line prefer-nullish-coalescing
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatPrice(paise) {
    if (!paise) return '—';
    return `₹${(Number(paise) / 100).toFixed(0)}`;
  }

  const statusColors = {
    pending: 'warning',
    active: 'success',
    completed: 'neutral',
    cancelled: 'danger',
    expired: 'danger',
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My rentals</h1>
          <p className={styles.pageSubtitle}>
            View and manage your rental bookings.
          </p>
        </div>
        <Link to="/listings" className="btn btn-primary">
          Browse listings
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Loading your bookings…</p>
        </div>
      ) : rows.length > 0 ? (
        <div className={styles.bookingsList}>
          {rows.map((booking) => (
            <Link
              key={booking.id}
              to={`/bookings/${booking.id}`}
              className={styles.bookingCard}
            >
              <div className={styles.bookingHeader}>
                <div className={styles.bookingInfo}>
                  <span className={styles.bookingId}>{booking.listingId?.slice(0, 8) || booking.id.slice(0, 8)}</span>
                  <h3 className={styles.bookingTitle}>
                    {booking.listingTitle || 'Rental booking'}
                  </h3>
                </div>
                <span className={`badge badge-${statusColors[booking.status] || 'neutral'} ${styles.statusBadge}`}>
                  {booking.status}
                </span>
              </div>

              <dl className={styles.bookingDetails}>
                <div>
                  <dt className={styles.detailLabel}>Dates</dt>
                  <dd className={styles.detailValue}>
                    {formatDate(booking.startDate)} — {formatDate(booking.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className={styles.detailLabel}>Total</dt>
                  <dd className={styles.detailValue}>{formatPrice(booking.totalAmountPaise)}</dd>
                </div>
                <div>
                  <dt className={styles.detailLabel}>Deposit</dt>
                  <dd className={styles.detailValue}>
                    {booking.depositPaise ? formatPrice(booking.depositPaise) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className={styles.detailLabel}>Status</dt>
                  <dd className={styles.detailValue}>
                    <span className={`badge badge-${statusColors[booking.status] || 'neutral'}`}>
                      {booking.status}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className={styles.bookingFooter}>
                <span className={styles.viewText}>View details</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="8" y="16" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 20h32" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M24 10c2-2 4-2 6 0s4 2 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No bookings yet</h3>
          <p className={styles.emptyDesc}>
            You haven\'t made any rental bookings. Browse listings to find something to rent.
          </p>
          <Link to="/listings" className="btn btn-primary">
            Browse listings
          </Link>
        </div>
      )}
    </div>
  );
}
