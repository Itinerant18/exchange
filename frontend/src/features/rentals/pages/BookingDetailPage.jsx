import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { rentalsApi } from '../../../api/rentalsApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatPaiseToRupees, formatDate } from '../../../utils/formatters.js';
import { ReviewFormModal } from '../../../components/rental/ReviewFormModal.jsx';
import styles from './BookingDetailPage.module.css';

const STATUS_CONFIG = {
  created:   { label: 'Draft', phase: 'badge-neutral' },
  pending:   { label: 'Pending Review', phase: 'badge-warning' },
  confirmed: { label: 'Confirmed', phase: 'badge-success' },
  active:    { label: 'Active Rental', phase: 'badge-success' },
  running:   { label: 'Running', phase: 'badge-success' },
  completed: { label: 'Completed', phase: 'badge-neutral' },
  cancelled: { label: 'Cancelled', phase: 'badge-danger' },
  declined:  { label: 'Declined', phase: 'badge-danger' },
  expired:   { label: 'Expired', phase: 'badge-danger' },
  refunded:  { label: 'Refunded', phase: 'badge-neutral' },
};

export function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionDate, setExtensionDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [lateFeeQuote, setLateFeeQuote] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');

    rentalsApi.getBookingById(id)
      .then((res) => {
        const data = res?.data ?? res;
        setBooking(data);
        if (data?.lateFee?.overdueDays > 0) {
          rentalsApi.getLateFeeQuote(id).then(setLateFeeQuote).catch(() => null);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load booking details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  async function handleAccept() {
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.acceptBooking(id);
      setActionSuccess('Booking confirmed! Garment reserved for the renter.');
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to accept booking');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt('Please enter the reason for declining this rental request:');
    if (reason === null) return;
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.rejectBooking(id, reason.trim() || undefined);
      setActionSuccess('Rental request declined.');
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to decline booking');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStart() {
    if (!window.confirm('Confirm that the garment has been handed over or dispatched for courier pickup?')) return;
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.startBooking(id);
      setActionSuccess('Rental period active! Garment is in transit or in the renter\'s possession.');
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to start rental');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSubmitExtension(e) {
    e.preventDefault();
    if (!extensionDate) {
      setError('Please select a new requested return date.');
      return;
    }
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.requestExtension(id, {
        newEndDate: extensionDate,
        reason: extensionReason.trim() || 'Rental extension requested via portal',
      });
      setActionSuccess('Extension request submitted! Our concierge will arbitrate availability.');
      setExtensionModalOpen(false);
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to submit extension request');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.cancelBooking(id, 'User cancelled via portal');
      setActionSuccess('Booking has been cancelled successfully.');
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReturn() {
    if (!window.confirm('Confirm that you are returning this rental in the prepaid garment bag?')) return;
    setActionBusy(true);
    setError('');
    setActionSuccess('');
    try {
      await rentalsApi.returnBooking(id);
      setActionSuccess('Return request registered. Handover to courier when scheduled.');
      const updated = await rentalsApi.getBookingById(id);
      setBooking(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to process return');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
          <p style={{ color: 'var(--color-muted)' }}>Loading booking details from atelier…</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className={styles.page}>
        <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-8)' }}>
          {error}
        </div>
        <Link to="/bookings" className={styles.backLink} style={{ marginTop: 'var(--space-4)' }}>
          ← Back to My Rentals
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
          <h2>Booking Not Found</h2>
          <p style={{ color: 'var(--color-muted)' }}>We couldn't locate the requested booking.</p>
          <Link to="/bookings" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            My Rentals
          </Link>
        </div>
      </div>
    );
  }

  const isRenter = booking.renterUserId === user?.id || booking.renter_user_id === user?.id;
  const isExplicitProvider = Boolean(
    (booking.listingOwnerId && booking.listingOwnerId === user?.id) ||
    (booking.listing_owner_id && booking.listing_owner_id === user?.id)
  );
  const isProvider = isExplicitProvider || Boolean(user?.isAdmin) || (Boolean(user?.id) && !isRenter);
  const statusMeta = STATUS_CONFIG[booking.status] || { label: booking.status, phase: 'badge-neutral' };
  const canCancel = (isRenter || Boolean(user?.isAdmin)) && ['created', 'pending', 'confirmed'].includes(booking.status);
  const canProviderAccept = isProvider && booking.status === 'pending';
  const canProviderReject = isProvider && booking.status === 'pending';
  const canProviderStart = isProvider && booking.status === 'confirmed';
  const canProviderReturn = isProvider && ['active', 'running'].includes(booking.status);
  const canRequestExtension = ['confirmed', 'active', 'running'].includes(booking.status);
  const isRenterActive = isRenter && ['active', 'running'].includes(booking.status);
  const hasActions = canCancel || canProviderAccept || canProviderReject || canProviderStart || canProviderReturn || canRequestExtension;

  return (
    <div className={styles.page}>
      {/* ── Top Navigation ── */}
      <Link to="/bookings" className={styles.backLink}>
        ← Back to My Rentals
      </Link>

      <header className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.bookingId}>Booking #{booking.id.slice(0, 8)}</span>
          <span className={`badge ${statusMeta.phase}`}>
            {statusMeta.label}
          </span>
        </div>
        <h1 className={styles.title}>
          {booking.listingTitle || 'Designer Rental'}
        </h1>
        <p className={styles.subtitle}>
          Reserved on {formatDate(booking.createdAt || booking.created_at)}
        </p>
      </header>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          {actionSuccess}
        </div>
      )}

      <div className={styles.content}>
        <main className={styles.main}>
          {/* ── Rental Schedule ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Rental Schedule</h2>
            <div className={styles.details}>
              <div>
                <dt>Delivery Date</dt>
                <dd>{formatDate(booking.startDate || booking.start_date)}</dd>
              </div>
              <div>
                <dt>Return by Noon</dt>
                <dd>{formatDate(booking.endDate || booking.end_date)}</dd>
              </div>
              <div>
                <dt>Care & Cleaning</dt>
                <dd style={{ color: 'var(--color-accent)' }}>Included (₹0 eco-friendly laundry)</dd>
              </div>
            </div>
          </section>

          {/* ── Pricing Breakdown ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Pricing Breakdown</h2>
            <div className={styles.details}>
              {booking.subtotalAmountPaise && (
                <div>
                  <dt>Rental Subtotal</dt>
                  <dd>{formatPaiseToRupees(booking.subtotalAmountPaise)}</dd>
                </div>
              )}
              <div>
                <dt>Security Deposit</dt>
                <dd>
                  {(booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise)
                    ? formatPaiseToRupees(booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise)
                    : '₹0'}
                </dd>
              </div>
              <div className={styles.totalRow}>
                <dt className={styles.totalValue}>Total Paid</dt>
                <dd className={styles.totalValue}>{formatPaiseToRupees(booking.totalAmountPaise)}</dd>
              </div>
            </div>
          </section>

          {/* ── Inventory Units & Items ── */}
          {booking.items && booking.items.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Reserved Garments</h2>
              <div className={styles.details}>
                {booking.items.map((item, idx) => (
                  <div key={item.id || idx}>
                    <dt>Piece #{idx + 1}</dt>
                    <dd>
                      Unit {item.inventoryItemId?.slice(0, 8)} · {item.itemStatus || 'Reserved'}
                    </dd>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Overdue & Late Fee Advisory ── */}
          {booking.lateFee?.overdueDays > 0 && (
            <section className={styles.section} style={{ borderLeft: '3px solid var(--color-danger, #e53e3e)' }}>
              <h2 className={styles.sectionTitle} style={{ color: 'var(--color-danger, #e53e3e)' }}>
                Rental Overdue ({booking.lateFee.overdueDays} {booking.lateFee.overdueDays === 1 ? 'day' : 'days'})
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-on-surface-muted)', margin: '0 0 var(--space-2) 0' }}>
                This garment was due on {formatDate(booking.endDate)}. Please return the outfit immediately in the prepaid garment bag to prevent late fees.
              </p>
              {lateFeeQuote && (
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  Estimated late-fee accrual: {formatPaiseToRupees(lateFeeQuote.quotePaise || lateFeeQuote.lateFeePaise || 0)}
                </p>
              )}
            </section>
          )}

          {/* ── Return Instructions for Renter ── */}
          {isRenterActive && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Return Instructions</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-on-surface-muted)', margin: '0 0 var(--space-3) 0' }}>
                Your designer rental is active! Pack both garments (including the backup size) into the prepaid garment return bag by <strong>{formatDate(booking.endDate || booking.end_date)}</strong> for scheduled courier pickup. No dry cleaning needed.
              </p>
            </section>
          )}

          {/* ── Lifecycle & Management Actions ── */}
          {hasActions && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Booking Actions</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {canProviderAccept && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionBusy}
                    onClick={handleAccept}
                  >
                    {actionBusy ? 'Accepting…' : '✓ Accept Rental Request'}
                  </button>
                )}
                {canProviderReject && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionBusy}
                    onClick={handleReject}
                  >
                    {actionBusy ? 'Declining…' : '✕ Decline Request'}
                  </button>
                )}
                {canProviderStart && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionBusy}
                    onClick={handleStart}
                  >
                    {actionBusy ? 'Starting…' : '📦 Hand Over / Dispatch Garment'}
                  </button>
                )}
                {canProviderReturn && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionBusy}
                    onClick={handleReturn}
                  >
                    {actionBusy ? 'Processing Return…' : 'Record Return & Inspection'}
                  </button>
                )}
                {canRequestExtension && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionBusy}
                    onClick={() => setExtensionModalOpen(true)}
                  >
                    Extend Rental Dates
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionBusy}
                    onClick={handleCancel}
                  >
                    {actionBusy ? 'Cancelling…' : 'Cancel Booking'}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ── Extension Request Modal ── */}
          {extensionModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onClick={() => setExtensionModalOpen(false)}
            >
              <div
                style={{
                  background: 'var(--color-surface, #fff)',
                  borderRadius: '8px',
                  padding: '2rem',
                  maxWidth: '480px',
                  width: '100%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0 }}>Request Rental Extension</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                  Need more time with your designer piece? Request a new return date. Our atelier will verify availability and confirm.
                </p>
                <form onSubmit={handleSubmitExtension}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      New Return Date *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={extensionDate}
                      min={booking.endDate || booking.end_date}
                      onChange={(e) => setExtensionDate(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Reason for Extension
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="e.g. Wedding events extended, second reception day added..."
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setExtensionModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={actionBusy}
                    >
                      {actionBusy ? 'Submitting…' : 'Submit Extension'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Our Runway Customer Review Section ── */}
          {booking.status === 'completed' && booking.renterUserId === user?.id && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Our Runway Review</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-on-surface-muted)', margin: '0 0 var(--space-4) 0' }}>
                Share your styling experience and sizing specs (height, weight, body type, fit rating) to help fellow members rent with confidence.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setReviewModalOpen(true)}
              >
                ★ Share Review & Fit Specs
              </button>
            </section>
          )}
        </main>

        <ReviewFormModal
          bookingId={booking.id}
          listingTitle={booking.listingTitle}
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={() => {
            setActionSuccess('Your review and fit metrics have been submitted to Our Runway!');
          }}
        />

        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.actionCard}>
            <h3 className={styles.actionTitle}>Atelier Outfit</h3>
            <p className={styles.actionNote}>
              {booking.listingTitle || 'Designer Piece'}
            </p>
            {booking.listingId && (
              <Link
                to={`/listings/${booking.listingId}`}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                View Atelier Listing
              </Link>
            )}
          </div>

          {booking.history && booking.history.length > 0 && (
            <div className={styles.historyCard}>
              <h3 className={styles.actionTitle}>Timeline</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {booking.history.map((h, i) => (
                  <li key={i} style={{ fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{h.toStatus}</span>
                    <span style={{ color: 'var(--color-muted)' }}>{formatDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
