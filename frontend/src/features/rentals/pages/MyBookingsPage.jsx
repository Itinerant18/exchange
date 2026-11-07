import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rentalsApi } from '../../../api/rentalsApi.js';
import { formatPaiseToRupees } from '../../../utils/formatters.js';
import styles from './BookingsPage.module.css';

export function MyBookingsPage() {
  const [role, setRole] = useState('renter'); // 'renter' | 'provider'
  const [statusFilter, setStatusFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookings = () => {
    setLoading(true);
    setError('');
    rentalsApi.getMyBookings({ role })
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        setRows(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, [role]);

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const formatPrice = formatPaiseToRupees;

  const statusColors = {
    pending: 'warning',
    active: 'success',
    completed: 'neutral',
    cancelled: 'danger',
    expired: 'danger',
  };

  const displayedRows = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{role === 'renter' ? 'My rentals' : 'Garment rental bookings'}</h1>
          <p className={styles.pageSubtitle}>
            {role === 'renter'
              ? 'View and manage your active and upcoming rentals.'
              : 'View and manage incoming rental orders for your listed designer pieces.'}
          </p>
        </div>
        <Link to="/listings" className="btn btn-primary">
          Browse listings
        </Link>
      </div>

      {/* ── Role Segmented Control (Sticky on Mobile) ── */}
      <div className={styles.roleSegmentedControl} role="tablist" aria-label="Role selector">
        <button
          type="button"
          role="tab"
          aria-selected={role === 'renter'}
          className={`${styles.roleBtn} ${role === 'renter' ? styles.roleBtnActive : ''}`}
          onClick={() => setRole('renter')}
        >
          My Rentals (Renter)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === 'provider'}
          className={`${styles.roleBtn} ${role === 'provider' ? styles.roleBtnActive : ''}`}
          onClick={() => setRole('provider')}
        >
          Incoming Orders (Owner)
        </button>
      </div>

      {/* ── Status Filter Chips & Refresh Toolbar ── */}
      <div className={styles.filterToolbar}>
        <div className={styles.statusFilterBar}>
          {['all', 'pending', 'active', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.statusChip} ${statusFilter === status ? styles.statusChipActive : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All Bookings' : status}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={fetchBookings}
          title="Refresh bookings"
          aria-label="Refresh bookings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
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
      ) : displayedRows.length > 0 ? (
        <div className={styles.bookingsList}>
          {displayedRows.map((booking) => (
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
                    {(booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise)
                      ? formatPrice(booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise)
                      : '—'}
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
          <h3 className={styles.emptyTitle}>
            {role === 'renter' ? 'No bookings yet' : 'No incoming rental orders'}
          </h3>
          <p className={styles.emptyDesc}>
            {role === 'renter'
              ? "You haven't made any rental bookings. Browse listings to find something to rent."
              : "No incoming rental bookings yet. When clients reserve your atelier pieces, they will appear here."}
          </p>
          <Link
            to={role === 'renter' ? '/listings' : '/listings/new'}
            className="btn btn-primary"
          >
            {role === 'renter' ? 'Browse listings' : 'List a garment'}
          </Link>
        </div>
      )}
    </div>
  );
}
