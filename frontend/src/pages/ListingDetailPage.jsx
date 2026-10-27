import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './ListingDetailPage.module.css';

export function ListingDetailPage() {
  const { id } = useParams();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState({
    startDate: '',
    endDate: '',
    transportMode: 'none',
    outboundDistanceKm: '',
    returnDistanceKm: '',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest(`/listings/${id}`)
      .then(setListing)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function book(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const body = {
        listingId: id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        transportMode: booking.transportMode,
      };
      if (booking.transportMode === 'outbound' || booking.transportMode === 'both') {
        body.outboundDistanceKm = Number(booking.outboundDistanceKm);
      }
      if (booking.transportMode === 'return' || booking.transportMode === 'both') {
        body.returnDistanceKm = Number(booking.returnDistanceKm);
      }
      const res = await apiRequest('/rentals/bookings', { method: 'POST', body });
      setMsg(`Booking created: ${res.id} (${res.status})`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>{error}</p>
          <Link to="/listings" className="btn btn-secondary">
            Back to listings
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !listing) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingBox}>
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p>Loading listing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/listings" className={styles.backLink}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to listings
      </Link>

      <div className={styles.listingHeader}>
        <div className={styles.listingBadges}>
          {listing.isRental && (
            <span className="badge badge-accent">Rent</span>
          )}
          {listing.isSale && (
            <span className="badge badge-olive">Buy</span>
          )}
          <span className={`badge badge-neutral ${styles.conditionBadge}`}>
            {listing.condition || 'Good'}
          </span>
        </div>
        <h1 className={styles.listingTitle}>{listing.title}</h1>
        {listing.city && (
          <p className={styles.listingLocation}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1a5 5 0 100 10 5 5 0 000-10zM1 8a6 6 0 1112 0 6 6 0 01-12 0z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {listing.city}
          </p>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.mainContent}>
          {listing.description && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About this listing</h2>
              <p className={styles.description}>{listing.description}</p>
            </div>
          )}

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Pricing</h2>
            <div className={styles.pricingGrid}>
              {listing.isRental && listing.rentalPricePaise && (
                <div className={styles.priceCard}>
                  <div className={styles.priceIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className={styles.priceInfo}>
                    <span className={styles.priceLabel}>Rental price</span>
                    <span className={styles.priceValue}>
                      ₹{(listing.rentalPricePaise / 100).toFixed(0)}
                      <span className={styles.priceUnit}>/day</span>
                    </span>
                  </div>
                </div>
              )}
              {listing.isSale && listing.salePricePaise && (
                <div className={styles.priceCard}>
                  <div className={styles.priceIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className={styles.priceInfo}>
                    <span className={styles.priceLabel}>Sale price</span>
                    <span className={styles.priceValue}>
                      ₹{(listing.salePricePaise / 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
              {listing.depositPaise && listing.isRental && (
                <div className={styles.priceCard}>
                  <div className={styles.priceIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className={styles.priceInfo}>
                    <span className={styles.priceLabel}>Security deposit</span>
                    <span className={styles.priceValue}>
                      ₹{((listing.depositPaise || 0) / 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <dl className={styles.detailsList}>
              <div>
                <dt>Condition</dt>
                <dd>{listing.condition || 'Not specified'}</dd>
              </div>
              <div>
                <dt>Delivery available</dt>
                <dd>{listing.deliveryAvailable ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Listing ID</dt>
                <dd className={styles.mono}>{listing.id}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className={styles.sideContent}>
          {isAuthed && listing.isRental && (
            <div className={styles.bookCard}>
              <h3 className={styles.bookTitle}>Book this rental</h3>
              <p className={styles.bookNote}>
                Pay at pickup. Return on time to avoid late fees.
              </p>

              <form onSubmit={book} className={styles.bookForm}>
                <div className={styles.dateFields}>
                  <div className={styles.field}>
                    <label className="form-label">Start date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={booking.startDate}
                      onChange={(e) => setBooking({ ...booking, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={booking.endDate}
                      onChange={(e) => setBooking({ ...booking, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className="form-label">Transport</label>
                  <select
                    className="form-input"
                    value={booking.transportMode}
                    onChange={(e) => setBooking({ ...booking, transportMode: e.target.value })}
                  >
                    <option value="none">Self pickup & return</option>
                    <option value="outbound">Delivery only</option>
                    <option value="return">Return only</option>
                    <option value="both">Both directions</option>
                  </select>
                </div>

                {(booking.transportMode === 'outbound' || booking.transportMode === 'both') && (
                  <div className={styles.field}>
                    <label className="form-label">Outbound distance (km)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="0.1"
                      value={booking.outboundDistanceKm}
                      onChange={(e) => setBooking({ ...booking, outboundDistanceKm: e.target.value })}
                    />
                  </div>
                )}

                {(booking.transportMode === 'return' || booking.transportMode === 'both') && (
                  <div className={styles.field}>
                    <label className="form-label">Return distance (km)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="0.1"
                      value={booking.returnDistanceKm}
                      onChange={(e) => setBooking({ ...booking, returnDistanceKm: e.target.value })}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className={`btn btn-primary ${styles.bookBtn}`}
                  disabled={!booking.startDate || !booking.endDate}
                >
                  Create booking
                </button>
              </form>

              {msg && (
                <div className="alert alert-success" role="status">
                  {msg}
                </div>
              )}
              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}
            </div>
          )}

          {!isAuthed && listing.isRental && (
            <div className={styles.bookCard}>
              <h3 className={styles.bookTitle}>Book this rental</h3>
              <p className={styles.bookNote}>
                Sign in to create a booking.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Sign in to book
              </Link>
            </div>
          )}

          {listing.isSale && (
            <div className={styles.buyCard}>
              <h3 className={styles.buyTitle}>Purchase this item</h3>
              <p className={styles.buyNote}>
                Contact the seller to arrange purchase.
              </p>
              <Link to="/listings" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Contact seller
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
