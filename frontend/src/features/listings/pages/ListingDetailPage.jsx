import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { rentalsApi } from '../../../api/rentalsApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatPaiseToRupees, calculateReturnDate, formatDate } from '../../../utils/formatters.js';
import { RentalDatePicker } from '../../../components/rental/RentalDatePicker.jsx';
import { BackupSizeSelector } from '../../../components/rental/BackupSizeSelector.jsx';
import { FitInsights } from '../../../components/rental/FitInsights.jsx';
import { CustomerReviews } from '../../../components/rental/CustomerReviews.jsx';
import { DamageWaiverBadge } from '../../../components/rental/DamageWaiverBadge.jsx';
import styles from './ListingDetailPage.module.css';

export function ListingDetailPage() {
  const { id } = useParams();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Rental parameters
  const [rentalDuration, setRentalDuration] = useState(4);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [primarySize, setPrimarySize] = useState('');
  const [backupSize, setBackupSize] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live Availability from Backend
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availableUnitsCount, setAvailableUnitsCount] = useState(null);
  const [availableUnitIds, setAvailableUnitIds] = useState([]);

  // Fetch listing details on mount
  useEffect(() => {
    setLoading(true);
    listingsApi.getListingById(id)
      .then((data) => {
        setListing(data);
        if (data?.size) {
          setPrimarySize(data.size);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Compute calculated return date based on delivery date & rental duration
  const returnDate = useMemo(() => {
    if (!deliveryDate) return '';
    return calculateReturnDate(deliveryDate, rentalDuration);
  }, [deliveryDate, rentalDuration]);

  // Real-time backend availability check
  useEffect(() => {
    if (!id || !deliveryDate || !returnDate) {
      setAvailableUnitsCount(null);
      setAvailableUnitIds([]);
      return;
    }

    setCheckingAvailability(true);
    rentalsApi.getAvailability(id, { startDate: deliveryDate, endDate: returnDate })
      .then((res) => {
        setAvailableUnitsCount(res?.availableUnits ?? 0);
        setAvailableUnitIds(res?.unitIds ?? []);
      })
      .catch(() => {
        setAvailableUnitsCount(0);
        setAvailableUnitIds([]);
      })
      .finally(() => setCheckingAvailability(false));
  }, [id, deliveryDate, returnDate]);

  // Exact pricing breakdown calculated from backend daily rental rate & duration
  const pricing = useMemo(() => {
    if (!listing) return { dailyRate: 0, subtotal: 0, deposit: 0, total: 0 };
    const dailyRate = Number(listing.rentalPricePaise || 0);
    const deposit = Number(listing.depositPaise || 0);
    const subtotal = dailyRate * rentalDuration;
    const total = subtotal + deposit;
    return { dailyRate, subtotal, deposit, total };
  }, [listing, rentalDuration]);

  async function handleBookRental(e) {
    e.preventDefault();
    setError('');

    if (!isAuthed) {
      navigate('/login');
      return;
    }

    if (!deliveryDate) {
      setError('Please select a delivery date for your event.');
      return;
    }

    if (availableUnitsCount === 0) {
      setError('This outfit is not available for the selected dates. Please choose another date range.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        listingId: id,
        startDate: deliveryDate,
        endDate: returnDate,
        transportMode: 'none',
      };

      // If available units were returned by backend, select 1 unit so subtotal isn't multiplied
      if (availableUnitIds.length > 0) {
        payload.itemIds = [availableUnitIds[0]];
      }

      const res = await rentalsApi.createBooking(payload);
      navigate(`/bookings/${res.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create booking reservation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
        <p>Loading designer garment…</p>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className={styles.errorPage}>
        <h2>Item not found</h2>
        <p>{error}</p>
        <Link to="/listings" className="btn btn-primary">Back to Catalog</Link>
      </div>
    );
  }

  const {
    title = '',
    brand = '',
    description = '',
    size: listingSize = '',
    colour = '',
    rentalPricePaise,
    salePricePaise,
    depositPaise,
    replacementValuePaise,
    isRental,
    isSale,
    condition = '',
    city,
    images = [],
    ownerId,
  } = listing || {};

  const displayImages = images.map((img) => img.objectKey).filter(Boolean);

  const estimatedRetail = replacementValuePaise;

  // Available sizing choices (based strictly on listing.size from database)
  const availableSizes = listingSize ? [listingSize] : [];

  const isDateSelected = Boolean(deliveryDate && returnDate);
  const isAvailable = availableUnitsCount !== null && availableUnitsCount > 0;
  const isSoldOutForDates = isDateSelected && availableUnitsCount === 0;

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ── */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/listings">Catalog</Link>
        <span className={styles.breadcrumbDivider}>/</span>
        <span>{brand || 'Designer'}</span>
        <span className={styles.breadcrumbDivider}>/</span>
        <span className={styles.breadcrumbCurrent}>{title}</span>
      </nav>

      {/* ── Two-Column High-Fashion Grid ── */}
      <div className={styles.pdpGrid}>
        {/* ── Left Column: Imagery & Fit Intel ── */}
        <div className={styles.visualCol}>
          <div className={styles.gallery}>
            <div className={styles.mainImageFrame}>
              {displayImages.length > 0 ? (
                <img
                  src={displayImages[activeImageIndex]}
                  alt={title}
                  className={styles.mainImage}
                />
              ) : (
                <div className={styles.noImagePlaceholder}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                  </svg>
                  <span>No imagery uploaded for this piece</span>
                </div>
              )}
            </div>

            {displayImages.length > 1 && (
              <div className={styles.thumbnails}>
                {displayImages.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.thumbBtn} ${activeImageIndex === idx ? styles.thumbBtnActive : ''}`}
                    onClick={() => setActiveImageIndex(idx)}
                  >
                    <img src={src} alt={`Thumbnail ${idx + 1}`} className={styles.thumbImg} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Garment Details & Description */}
          <div className={styles.garmentDetails}>
            <h3 className={styles.sectionTitle}>The Designer & Details</h3>
            {description && <p className={styles.descriptionText}>{description}</p>}

            <div className={styles.specsGrid}>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Designer / Brand</span>
                <span className={styles.specVal}>{brand || 'Designer Atelier'}</span>
              </div>
              {listingSize && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Size in Atelier</span>
                  <span className={styles.specVal}>{listingSize}</span>
                </div>
              )}
              {colour && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Color</span>
                  <span className={styles.specVal}>{colour}</span>
                </div>
              )}
              {condition && (
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Condition</span>
                  <span className={styles.specVal}>{condition}</span>
                </div>
              )}
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Location</span>
                <span className={styles.specVal}>{city || 'Express Courier Hub'}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Security Deposit</span>
                <span className={styles.specVal}>{depositPaise ? formatPaiseToRupees(depositPaise) : 'Zero Deposit'}</span>
              </div>
            </div>
          </div>

          {/* Sizing & Fit Insights Engine */}
          <FitInsights
            size={listingSize}
            colour={colour}
            condition={condition}
            brand={brand}
          />

          {/* Real Customer Photos & Reviews from Backend */}
          <CustomerReviews ownerId={ownerId} activeUserSize={primarySize} listingTitle={title} />
        </div>

        {/* ── Right Column: Sticky Booking & Sizing Console ── */}
        <div className={styles.consoleCol}>
          <div className={styles.stickyConsole}>
            <div className={styles.consoleHeader}>
              <span className={styles.designerBrand}>{brand}</span>
              <h1 className={styles.garmentTitle}>{title}</h1>

              {/* Price Anchoring */}
              <div className={styles.priceContainer}>
                {isRental && rentalPricePaise && (
                  <div className={styles.priceRow}>
                    <span className={styles.rentalPrice}>
                      {formatPaiseToRupees(pricing.dailyRate)}
                    </span>
                    <span className={styles.rentalDurationTag}>
                      / day (₹{formatPaiseToRupees(pricing.subtotal)} for {rentalDuration} days)
                    </span>
                  </div>
                )}
                {estimatedRetail && (
                  <span className={styles.retailCompare}>
                    {formatPaiseToRupees(estimatedRetail)} estimated retail
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className={styles.alertError} role="alert">
                {error}
              </div>
            )}

            {/* ── Interactive Date Picker (4 vs 8 Days) ── */}
            {isRental && (
              <RentalDatePicker
                duration={rentalDuration}
                onDurationChange={setRentalDuration}
                deliveryDate={deliveryDate}
                onDeliveryDateChange={setDeliveryDate}
              />
            )}

            {/* ── Live Backend Availability Status Indicator ── */}
            {isDateSelected && (
              <div className={styles.availabilityStatus}>
                {checkingAvailability ? (
                  <span className={styles.availChecking}>Checking atelier availability…</span>
                ) : isAvailable ? (
                  <span className={styles.availReady}>
                    ✓ Available for these dates ({availableUnitsCount} {availableUnitsCount === 1 ? 'unit' : 'units'} ready)
                  </span>
                ) : (
                  <span className={styles.availSoldOut}>
                    ✕ Unavailable for selected dates. Please select other days.
                  </span>
                )}
              </div>
            )}

            {/* ── Sizing + Complimentary Backup Size ── */}
            <BackupSizeSelector
              sizes={availableSizes}
              primarySize={primarySize || listingSize}
              onPrimarySizeChange={setPrimarySize}
              backupSize={backupSize}
              onBackupSizeChange={setBackupSize}
            />

            {/* ── Real Pricing Breakdown (Direct from Backend Rates) ── */}
            <div className={styles.pricingBreakdown}>
              <div className={styles.breakdownRow}>
                <span>Rental ({rentalDuration} days @ {formatPaiseToRupees(pricing.dailyRate)}/day)</span>
                <span>{formatPaiseToRupees(pricing.subtotal)}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Security Deposit (100% refundable upon return)</span>
                <span>{formatPaiseToRupees(pricing.deposit)}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Professional Dry Cleaning</span>
                <span className={styles.freeHighlight}>Included (₹0)</span>
              </div>
              <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                <strong>Total Amount</strong>
                <strong>{formatPaiseToRupees(pricing.total)}</strong>
              </div>
            </div>

            {/* ── Primary Action Button ── */}
            <div className={styles.actionBlock}>
              <button
                type="button"
                className={styles.bookButton}
                onClick={handleBookRental}
                disabled={submitting || checkingAvailability || isSoldOutForDates || !isDateSelected}
              >
                {submitting
                  ? 'Reserving Look…'
                  : !isDateSelected
                  ? 'Select Delivery Date to Reserve'
                  : isSoldOutForDates
                  ? 'Unavailable on Selected Dates'
                  : `Reserve Look — ${formatPaiseToRupees(pricing.total)}`}
              </button>

              <p className={styles.actionNote}>
                ✓ Includes primary size ({primarySize || listingSize}) + free backup size ({backupSize || 'None'})
              </p>
            </div>

            {/* ── Trust Perks (Damage waiver & cleaning) ── */}
            <DamageWaiverBadge />
          </div>
        </div>
      </div>
    </div>
  );
}
