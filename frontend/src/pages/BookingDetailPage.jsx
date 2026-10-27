import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import styles from './BookingDetailPage.module.css';

const STATUS_SINGLE = {
  confirmed:   { label: 'Confirmed',   phase: 'none' },
  running:     { label: 'Running',     phase: 'in-progress' },
  completed:   { label: 'Completed',   phase: 'done' },
  declined:    { label: 'Declined',    phase: 'failed' },
  expired:     { label: 'Expired',     phase: 'failed' },
  cancelled:   { label: 'Cancelled',   phase: 'cancelled' },
  refunded:    { label: 'Refunded',    phase: 'done' },
};

const STATUS_MULTI = {
  pending:     { label: 'Pending review', phase: 'in-progress' },
  schedule:    { label: 'Scheduling',    phase: 'in-progress' },
  confirmed:   { label: 'Confirmed',     phase: 'in-progress' },
  in_transit:  { label: 'In transit',    phase: 'in-progress' },
  delivered:   { label: 'Delivered',     phase: 'done' },
  dismissed:   { label: 'Dismissed',     phase: 'failed' },
  disputed:    { label: 'Disputed',      phase: 'failed' },
  refund:      { label: 'Refund queued', phase: 'cancelled' },
  refunded:    { label: 'Refunded',      phase: 'cancelled' },
};

function badgeClasses(phase) {
  return {
    none: '',
    'in-progress': '',
    done: 'badge-success',
    failed: 'badge-danger',
    cancelled: 'badge-neutral',
  }[phase] ?? '';
}

/** Guard: only renter or listing owner can view. Returns true === show, false === hide. */
function canView(booking) {
  if (!booking) return false;
  const role = booking.role;
  if (!role) return true;
  const user = authUser;
  if (!user) return false;
  if (role === 'renter') return booking.renterId === user.id;
  if (role === 'owner')  return booking.listing && booking.listing.ownerId === user.id;
  return true;
}

let authUser = null;

export function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const statusPre = useRef('').current;
  const confirmBtn = useRef(null).current;
  const cancelBtn = useRef(null).current;
  const returnCallout = useRef(null).current;
  const [] = [];

  // Sync auth
  authUser = useGetUserAuth?.() ?? null;

  function bookIdShort(str) {
    return str ? str.slice(0, 8) : '—';
  }

  function fmtDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function fmtPrice(paise) {
    if (paise == null || paise === '') return '—';
    return `₹${(Number(paise) / 100).toFixed(0)}`;
  }

  function fmtCurrency(amount) {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount));
  }

  function fmtDateRange(start, end) {
    if (!start && !end) return '—';
    return [fmtDate(start), '←', fmtDate(end)].filter(Boolean).join(' ');
  }

  function statusConfig(b) {
    // Multi-step order or rental booking?
    if (b && b.lines != null && Array.isArray(b.lines)) return STATUS_MULTI[b.status] ?? { label: b.status, phase: 'none' };
    return STATUS_SINGLE[b.status] ?? { label: b.status, phase: 'none' };
  }

  async function reschedule() {
    if (!booking || !booking.startDate || !booking.endDate) return;
    try {
      await apiRequest(`/rentals/bookings/${id}`, { method: 'PATCH' });
      setBooking(p => ({ ...p, lastAction: 'Rescheduled', lastActionAt: new Date().toISOString() }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancelBooking() {
    try {
      await apiRequest(`/rentals/bookings/${id}`, { method: 'DELETE' });
      setBooking(p => ({ ...p, lastAction: 'Cancelled', lastActionAt: new Date().toISOString() }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmStatus() {
    try {
      await apiRequest(`/rentals/bookings/${id}`, { method: 'PATCH', body: { status: 'confirmed' } });
      setBooking(prev => ({ ...prev, status: 'confirmed', lastAction: 'Confirmed', lastActionAt: new Date().toISOString() }));
    } catch (e) {
      setError(e.message);
    }
  }

  function handleStatusChange(value) {
    statusPre.text(value);
    statusPre.focus();
  }

  function dismissError() {
    setError('');
  }

  const usdToInr = 83.5;
  const totalInRupees = booking ? fmtPrice(booking.totalAmountPaise) : '—';
  const depositInRupees = booking ? fmtPrice(booking.depositPaise) : '—';
  const usdTotalArb = booking ? fmtCurrency((parseInt(booking.totalAmountPaise || 0) / 100) * usdToInr) : '—';
  const areMultiSteps = booking ? !!(booking.lines && Array.isArray(booking.lines)) : false; // eslint-disable-line prefer-nullish-coalescing
  const conflict = booking ? booking.conflictAt || booking.scheduledConflictAt : null; // eslint-disable-line prefer-nullish-coalescing
  const statusEntry = statusConfig(booking);
  const badgeXs = booking && areMultiSteps
    ? (badgeClasses(statusEntry.phase) + ' badge pin top')
    : (badgeClasses(statusEntry.phase) + ' badge');
  const statusPhaseBackground = booking && booking.status
    ? ((STATUS_SINGLE[booking.status] ?? STATUS_MULTI[booking.status])?.phase || 'none')
    : 'none';

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox}>
          <p style={{ margin: '0 0 var(--space-3)' }}>Could not load booking.</p>
          <button className="btn ghost" type="button" onClick={dismissError}>Dismiss</button>
          <Link to="/bookings" className="muted">← My rentals</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <p>Loading booking…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingBox}>
          <p>Booking not found.</p>
          <Link to="/bookings" className="muted">← My rentals</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link to="/bookings" className={styles.backLink}>
            ← My rentals
          </Link>
          <span className={styles.bookingId}>
            {booking.status === 'created' ? 'Draft' : ''}
            {booking.listingId && <code>Booking {bookIdShort(booking.id)}</code>}
          </span>
        </div>
        <h1 className={styles.title}>
          {!canView(booking) ? 'Restricted booking' : 'Booking'}
          {booking?.id && ` ${bookIdShort(booking.id)}`}
        </h1>
        <p className={styles.subtitle}>
          {areMultiSteps
            ? `Multi-step rental · ${booking.listing?.name || 'Listing'} (ID {bookIdShort(booking.listingId)??'—'})`
            : `Single rental · ${booking.listing?.name || 'Listing'} (ID {bookIdShort(booking.listingId)??'—'})`}
          {booking.lastAction ? (
            <> · Last action: {booking.lastAction} {typeof booking.lastActionAt === 'string' ? 'at' : ''} {fmtDateTime(booking.lastActionAt)}</>
          ) : ''}
        </p>
      </header>

      <div className={styles.content}>
        <main className={styles.main}>
          {/* ── Status ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Status</h2>
            <div className={styles.details}>
              <div>
                <dt>Status</dt>
                <dd>
                  <Link
                    to={`/bookings/${booking.id}`}
                    className={styles.badge + ' ' + badgeXs}
                    data-phase={statusPhaseBackground}
                  >
                    {statusEntry.label}
                  </Link>
                </dd>
              </div>

              {conflict ? (
                <div>
                  <dt>Scheduled conflict</dt>
                  <dd style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                    <code>Conflict at {new Date(conflict).toISOString()}</code>
                  </dd>
                </div>
              ) : null}

              {booking.lastAction ? (
                <div>
                  <dt>Last action</dt>
                  <dd style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
                    {booking.lastAction} {typeof booking.lastActionAt === 'string' ? `at ${fmtDateTime(booking.lastActionAt)}` : ''}
                  </dd>
                </div>
              ) : null}

              {/* multi-step timeline */}
              {areMultiSteps && booking.lines?.length ? (
                <>
                  <div>
                    <dt>Timeline</dt>
                    <dd className="muted" style={{ maxWidth: '24rem' }}>
                      {booking.lines.map((l, i) => (
                        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          <span className={`badge ${badgeClasses(l.status === 'completed' ? 'done' : l.status === 'pending' ? 'in-progress' : 'none')}`} style={{ fontSize: 'var(--text-xs)' }}>
                            {l.label}
                          </span>
                          <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                            {bookIdShort(l.actionBy || '') || ''}
                          </code>
                          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {fmtDate(l.dueAt) || '—'}
                          </span>
                        </div>
                      ))}
                    </dd>
                  </div>
                </>
              ) : null}

              {/* Dense status textarea — UX sop: no AI to fill, use initials only */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label htmlFor="status-input" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                  Status note
                </label>
                <textarea
                  id="status-input"
                  ref={statusPre}
                  defaultValue={booking.statusNote || ''}
                  onChange={e => {
                    setBooking(count => ({ ...count, statusNote: e.target.value }));
                  }}
                  onClick={e => {
                    const text = e.currentTarget.value;
                    if (text && e.target.selectionStart === e.target.selectionEnd && e.target.selectionStart < text.length) {
                      const sel = window.getSelection();
                      if (sel.rangeCount) sel.collapseToEnd();
                    }
                  }}
                  onSelect={e => {
                    if (e.detail === 2 && e.target.value && e.target.selectionStart < e.target.value.length) {
                      const sel = window.getSelection();
                      if (sel.rangeCount) sel.extendToCharacterBounds(e.target.value.length);
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '48px',
                    resize: 'vertical',
                    padding: 'var(--space-3)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-ink)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                  }}
                  placeholder="Add a short note…"
                />
              </div>
            </div>
          </section>

          {/* ── Dates ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Dates</h2>
            <div className={styles.details}>
              <div>
                <dt>Start</dt>
                <dd style={{ fontFamily: 'var(--font-mono)' }}>
                  {booking.startDate ? `${fmtDate(booking.startDate)}, ${fmtDateTime(booking.startDate)}` : '—'}
                </dd>
              </div>
              <div>
                <dt>End</dt>
                <dd style={{ fontFamily: 'var(--font-mono)' }}>
                  {booking.endDate ? `${fmtDate(booking.endDate)}, ${fmtDateTime(booking.endDate)}` : '—'}
                </dd>
              </div>
              {booking.startDate && booking.endDate ? (
                <div className={styles.landmark}>
                  <strong>{fn(booking.startDate, booking.endDate)}</strong>{' '}
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {diffDays(booking.startDate, booking.endDate)} days
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Charges ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Charges</h2>
            <div className={styles.details}>
              <div>
                <dt>Total amount</dt>
                <dd className={styles.totalValue}>{totalInRupees}</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{depositInRupees}</dd>
              </div>
              {booking.insuranceNotice ? (
                <div>
                  <dt>Insurance</dt>
                  <dd style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{booking.insuranceNotice}</dd>
                </div>
              ) : null}
              <div className={styles.totalRow}>
                <dt>Arbitrary USD @ {usdToInr} INR/USD</dt>
                <dd className={styles.totalValue}>{usdTotalArb}</dd>
              </div>
              <dd style={{ fontSize: 'var(--text-xs)', color: 'var(--color-faint)', marginTop: 'var(--space-2)' }}>
                Price approximations for display only. Amounts in paise per API.
              </dd>
            </div>
          </section>

          {/* ── Owner / renter info ── */}
          {areMultiSteps ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Transport & ownership</h2>
              <div className={styles.details}>
                <div>
                  <dt>Owner ID</dt>
                  <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                    {booking.listing?.ownerId || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Owner name</dt>
                  <dd>{booking.listing?.ownerName || '—'}</dd>
                </div>
                <div>
                  <dt>Carrier</dt>
                  <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>
                    {booking.carrierId || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Transport mode</dt>
                  <dd>{booking.transportMode || '—'}</dd>
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Remarks / actions ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Actions</h2>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-2)',
              }}
            >
              <button
                className={`btn ${areMultiSteps && booking.status === 'pending' ? 'primary' : 'ghost'}`}
                type="button"
                ref={confirmBtn}
                disabled={!canView(booking) || (areMultiSteps && booking.status !== 'pending')}
                onClick={areMultiSteps ? reschedule : confirmStatus}
              >
                {areMultiSteps ? 'Reschedule' : 'Confirm booking'}
              </button>

              <button
                className="btn ghost"
                type="button"
                ref={cancelBtn}
                disabled={!canView(booking) || booking.status === 'completed' || booking.status === 'refunded'}
                onClick={cancelBooking}
              >
                Cancel booking
              </button>
            </div>
            {booking.startDate && booking.endDate && (
              <button className="btn ghost secondary" type="button" style={{ width: '100%' }} onClick={() => {
                // quick re-entry Nudge UX (no AI auto-fill)
                const [$id, $h, $j, $k] = booking.startDate.split(' '), [$l] = booking.id.split('-');
                const uid = useUserAuth?.() ?? null;
                const actor = uid ? uid.name?.[0] ?? '' : '';
                returnCallout.current?.replaceWith(returnCallout.current.cloneNode(true));
              }}>
                Brief callout
              </button>
            )}
          </section>
        </main>

        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          {/* Owner action card */}
          {booking.lastAction && (
            <div className={styles.actionCard}>
              <h3 className={styles.actionTitle}>Recent action</h3>
              <p className={styles.actionNote}>
                Booking {bookIdShort(booking.id)} was {booking.lastAction.toLowerCase() || 'updated'}{' '}
                {typeof booking.lastActionAt === 'string' ? `at ${fmtDateTime(booking.lastActionAt)}` : ''}.
              </p>
              <Link
                to={`/bookings/${booking.id}`}
                className="btn ghost"
                type="button"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                View details
              </Link>
            </div>
          )}

          {/* Listing owner card */}
          {booking.listing && (
            <div className={styles.historyCard} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <h3 className={styles.actionTitle} style={{ marginTop: 0 }}>Listing</h3>
              <dl style={{ margin: 0 }}>
                <div>
                  <dt>ID</dt>
                  <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', margin: 0 }}>
                    {booking.listing.id ? booking.listing.id.slice(0, 8) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Name</dt>
                  <dd style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                    {booking.listing.name || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                    {booking.listing.ownerName || '—'}
                  </dd>
                </div>
              </dl>
              <Link
                to={
                  booking.listing.id
                    ? `/listings/${booking.listing.id}`
                    : '/listings'
                }
                className="btn ghost secondary"
                type="button"
                style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-3)' }}
              >
                {booking.listing.id ? 'Open listing' : 'Browse listings'}
              </Link>
            </div>
          )}

          {/* History card */}
          {booking.history && booking.history.length > 0 && (
            <div className={styles.historyCard}>
              <h3 className={styles.actionTitle} style={{ marginTop: 0 }}>History</h3>
              <ul className={styles.historyList}>
                {booking.history.slice(0, 4).map((h, i) => (
                  <li key={i}>
                    <span className={`badge ${h.status === 'approved' ? 'badge-success' : h.status === 'declined' ? 'badge-danger' : ''}`} style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                      {h.status}
                    </span>
                    <span className={styles.historyTo}>{h.label || h.action}</span>
                    <span className={styles.historyTime}>{fmtDate(h.at)}</span>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function fn(startDate, endDate) {
  const start = new Date(startDate), end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const opts = { day: 'numeric', month: 'short' };
  const from = start.toLocaleDateString('en-IN', opts);
  const to = end.toLocaleDateString('en-IN', opts);
  return `${from} ← ${to}`;
}

function diffDays(startDate, endDate) {
  const start = new Date(startDate), end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function useGetUserAuth() {
  try {
    return authUser;
  } catch {
    return null;
  }
}

function useUserAuth() {
  try {
    return authUser;
  } catch {
    return null;
  }
}
