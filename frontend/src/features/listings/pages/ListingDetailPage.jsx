import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { rentalsApi } from '../../../api/rentalsApi.js';
import { ordersApi } from '../../../api/ordersApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useBag } from '../../../context/BagContext.jsx';
import { useFavorites } from '../../../context/FavoritesContext.jsx';
import { formatPaiseToRupees, calculateReturnDate, formatDate } from '../../../utils/formatters.js';
import { RentalDatePicker } from '../../../components/rental/RentalDatePicker.jsx';
import { BackupSizeSelector } from '../../../components/rental/BackupSizeSelector.jsx';
import { FitInsights } from '../../../components/rental/FitInsights.jsx';
import { CustomerReviews } from '../../../components/rental/CustomerReviews.jsx';
import { DamageWaiverBadge } from '../../../components/rental/DamageWaiverBadge.jsx';
import { ModeSwitcher } from '../../../components/rental/ModeSwitcher.jsx';
import { CoutureFittingEngine } from '../../../components/rental/CoutureFittingEngine.jsx';
import { PincodeTransitCalculator } from '../../../components/rental/PincodeTransitCalculator.jsx';
import { SterilizationGuaranteeInfographic } from '../../../components/rental/SterilizationGuaranteeInfographic.jsx';
import { SustainabilityImpactCalculator } from '../../../components/rental/SustainabilityImpactCalculator.jsx';
import { CatwalkVideoPlayer } from '../../../components/rental/CatwalkVideoPlayer.jsx';
import styles from './ListingDetailPage.module.css';

export function ListingDetailPage() {
  const { id } = useParams();
  const { isAuthed } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [hygieneModalOpen, setHygieneModalOpen] = useState(false);

  // Rental parameters
  const [rentalDuration, setRentalDuration] = useState(4);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [primarySize, setPrimarySize] = useState('');
  const [backupSize, setBackupSize] = useState('');
  const [fittingSpecs, setFittingSpecs] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Slide-out bag (RTR CEBagComponent analogue): booking is started here and
  // confirmed inside the drawer so the shopper can keep browsing.
  const { addToBag } = useBag();

  // Rent vs Buy pre-owned mode (RTR-style buy box). Defaults to rent when the
  // listing supports rental, falling back to buy for resale-only listings.
  const [mode, setMode] = useState('rent');
  // Opt-in damage care flat fee; actual charge is computed by the backend.
  const [damageWaiver, setDamageWaiver] = useState(false);
  // Available units for buy mode.
  const [buyUnitIds, setBuyUnitIds] = useState([]);

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
        // Resale-only listings open in buy mode.
        if (data?.isSale && !data?.isRental) setMode('buy');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Buy mode needs an available inventory unit to purchase.
  useEffect(() => {
    if (!id || mode !== 'buy') return;
    listingsApi.getAvailableUnits(id)
      .then((res) => setBuyUnitIds(res?.unitIds ?? []))
      .catch(() => setBuyUnitIds([]));
  }, [id, mode]);

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
    if (!listing) return { dailyRate: 0, subtotal: 0, deposit: 0, waiverFee: 29900, total: 0, buyPrice: 0 };
    const dailyRate = Number(listing.rentalPricePaise || 0);
    const deposit = Number(listing.depositPaise || 0);
    const subtotal = dailyRate * rentalDuration;
    // Flat per-booking waiver: strictly ₹299 (29900 paise) per Blueprint §3.6
    const waiverFee = damageWaiver ? 29900 : 0;
    const total = subtotal + deposit + waiverFee;
    const buyPrice = Number(listing.salePricePaise || 0);
    return { dailyRate, subtotal, deposit, waiverFee, total, buyPrice };
  }, [listing, rentalDuration, damageWaiver]);

  function handleAddToBag(e) {
    e.preventDefault();
    setError('');

    if (!deliveryDate) {
      setError('Please select a delivery date for your event.');
      return;
    }

    if (availableUnitsCount === 0) {
      setError('This outfit is not available for the selected dates. Please choose another date range.');
      return;
    }

    const payload = {
      listingId: id,
      startDate: deliveryDate,
      endDate: returnDate,
      transportMode: 'none',
      durationDays: rentalDuration,
      // Free backup-size preference (second size rides along at ₹0).
      backupSize: backupSize || undefined,
      fittingSpecs: fittingSpecs || undefined,
      // Opt-in damage care waiver.
      damageWaiver,
      waiverFeePaise: pricing.waiverFee,
    };

    // If available units were returned by backend, select 1 unit so subtotal isn't multiplied
    if (availableUnitIds.length > 0) {
      payload.itemIds = [availableUnitIds[0]];
    }

    addToBag(payload, {
      title,
      brand,
      image: displayMedia[0]?.url || undefined,
      size: primarySize || listingSize,
      backupSize: backupSize || undefined,
      fittingSpecs: fittingSpecs || undefined,
      durationDays: rentalDuration,
      subtotalPaise: pricing.subtotal,
      waiverFeePaise: pricing.waiverFee,
      depositPaise: pricing.deposit,
      totalPaise: pricing.total,
    });
  }

  async function handleBuyNow(e) {
    e.preventDefault();
    setError('');

    if (!isAuthed) {
      navigate('/login');
      return;
    }

    if (buyUnitIds.length === 0) {
      setError('This pre-owned piece is currently sold. Browse similar looks in the catalog.');
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.createOrder({
        items: [{ inventoryItemId: buyUnitIds[0] }],
      });
      navigate('/orders');
    } catch (err) {
      setError(err.message || 'Failed to create purchase order.');
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

  const displayMedia = images
    .map((img) => {
      if (typeof img === 'string') {
        const isVideo = Boolean(img.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i));
        return { url: img, isVideo, mimeType: isVideo ? 'video/mp4' : 'image/jpeg' };
      }
      const url = img?.objectKey;
      if (!url) return null;
      const isVideo = Boolean(img.mimeType?.startsWith('video/') || url.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i));
      return {
        url,
        isVideo,
        mimeType: img.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        isPrimary: img.isPrimary,
      };
    })
    .filter(Boolean);

  const displayImages = displayMedia.map((m) => m.url);

  const estimatedRetail = replacementValuePaise;

  // Available sizing choices (standard atelier sizes plus custom listing size)
  const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const availableSizes = useMemo(() => {
    if (listing?.availableSizes && Array.isArray(listing.availableSizes) && listing.availableSizes.length > 0) {
      return listing.availableSizes;
    }
    if (listingSize && !STANDARD_SIZES.includes(listingSize)) {
      return [listingSize, ...STANDARD_SIZES];
    }
    return STANDARD_SIZES;
  }, [listing?.availableSizes, listingSize]);

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
              {displayMedia.length > 0 ? (
                displayMedia[activeImageIndex]?.isVideo ? (
                  <CatwalkVideoPlayer
                    key={displayMedia[activeImageIndex].url}
                    src={displayMedia[activeImageIndex].url}
                    poster={displayMedia.find((m) => !m.isVideo)?.url}
                    title={title}
                    aspectRatio="3:4"
                    autoPlayOnVisible={true}
                    mutedDefault={true}
                    className={styles.mainVideo}
                  />
                ) : (
                  <img
                    src={displayMedia[activeImageIndex]?.url}
                    alt={title}
                    className={styles.mainImage}
                  />
                )
              ) : (
                <div className={styles.noImagePlaceholder}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                  </svg>
                  <span>No imagery uploaded for this piece</span>
                </div>
              )}
            </div>

            {displayMedia.length > 1 && (
              <div className={styles.thumbnails}>
                {displayMedia.map((media, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.thumbBtn} ${activeImageIndex === idx ? styles.thumbBtnActive : ''}`}
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`View ${media.isVideo ? 'video' : 'photo'} ${idx + 1}`}
                  >
                    {media.isVideo ? (
                      <div className={styles.thumbVideoFrame}>
                        <video src={media.url} className={styles.thumbVideo} muted preload="metadata" />
                        <span className={styles.videoPlayBadge}>▶</span>
                      </div>
                    ) : (
                      <img src={media.url} alt={`Thumbnail ${idx + 1}`} className={styles.thumbImg} />
                    )}
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

          {/* ── Circular Sustainability Impact ── */}
          <div className={styles.sustainabilitySection}>
            <SustainabilityImpactCalculator
              garmentType={listing?.category?.name || listing?.category || 'Lehenga'}
              defaultCategory={listing?.category?.name || listing?.category || 'Lehenga'}
              initialRentals={1}
              compact={true}
            />
          </div>

          {/* Real Customer Photos & Reviews from Backend */}
          <CustomerReviews listingId={id} activeUserSize={primarySize} listingTitle={title} />
        </div>

        {/* ── Right Column: Sticky Booking & Sizing Console ── */}
        <div className={styles.consoleCol}>
          <div className={styles.stickyConsole}>
            <div className={styles.consoleHeader}>
              <div className={styles.designerAndWishlistRow}>
                <span className={styles.designerBrand}>{brand}</span>
                <button
                  type="button"
                  className={`${styles.pdpWishlistBtn} ${isFavorite(id) ? styles.pdpWishlistBtnActive : ''}`}
                  onClick={() => {
                    if (!isAuthed) { navigate('/login'); return; }
                    toggleFavorite(id);
                  }}
                  aria-label={isFavorite(id) ? 'Remove from saved' : 'Save to hearts'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite(id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
              <h1 className={styles.garmentTitle}>{title}</h1>

              {/* Price Anchoring */}
              <div className={styles.priceContainer}>
                {mode === 'buy' ? (
                  <div className={styles.priceRow}>
                    <span className={styles.rentalPrice}>
                      {formatPaiseToRupees(pricing.buyPrice)}
                    </span>
                    <span className={styles.rentalDurationTag}>
                      pre-owned purchase
                    </span>
                  </div>
                ) : isRental && rentalPricePaise ? (
                  <div className={styles.priceRow}>
                    <span className={styles.rentalPrice}>
                      {formatPaiseToRupees(pricing.dailyRate)}
                    </span>
                    <span className={styles.rentalDurationTag}>
                      / day ({formatPaiseToRupees(pricing.subtotal)} for {rentalDuration} days)
                    </span>
                  </div>
                ) : null}
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

            {isRental && isSale && (
              <ModeSwitcher
                mode={mode}
                onModeChange={setMode}
                availableModes={['rent', 'buy']}
              />
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

            {/* ── Couture In-House Basting & Alteration Engine ── */}
            {mode === 'rent' && (
              <CoutureFittingEngine onFittingChange={setFittingSpecs} />
            )}

            {/* ── Indian Pincode Transit & Delivery Estimator ── */}
            {mode === 'rent' && (
              <PincodeTransitCalculator
                deliveryDate={deliveryDate}
                returnDate={returnDate}
              />
            )}

            {mode === 'buy' ? (
              <>
                {/* ── Buy Pre-Owned Buy Box ── */}
                <div className={styles.pricingBreakdown}>
                  <div className={styles.breakdownRow}>
                    <span>Buy Pre-Owned ({condition || 'pre-loved'})</span>
                    <span>{formatPaiseToRupees(pricing.buyPrice)}</span>
                  </div>
                  {estimatedRetail && (
                    <div className={styles.breakdownRow}>
                      <span>Estimated retail</span>
                      <span>{formatPaiseToRupees(estimatedRetail)}</span>
                    </div>
                  )}
                  <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                    <strong>Total Amount</strong>
                    <strong>{formatPaiseToRupees(pricing.buyPrice)}</strong>
                  </div>
                </div>

                <div className={styles.actionBlock}>
                  <button
                    type="button"
                    className={styles.bookButton}
                    onClick={handleBuyNow}
                    disabled={submitting || buyUnitIds.length === 0}
                  >
                    {submitting
                      ? 'Placing Order…'
                      : buyUnitIds.length === 0
                      ? 'Sold — Browse Similar Looks'
                      : `Buy Yours Now — ${formatPaiseToRupees(pricing.buyPrice)}`}
                  </button>
                </div>
              </>
            ) : (
              <>
            {/* ── Real Pricing Breakdown (Direct from Backend Rates) ── */}
            <div className={styles.pricingBreakdown}>
              <div className={styles.breakdownRow}>
                <span>Rental ({rentalDuration} days @ {formatPaiseToRupees(pricing.dailyRate)}/day)</span>
                <span>{formatPaiseToRupees(pricing.subtotal)}</span>
              </div>
              {damageWaiver && (
                <div className={styles.breakdownRow}>
                  <span>Damage Care (opt-in)</span>
                  <span>{formatPaiseToRupees(pricing.waiverFee)}</span>
                </div>
              )}
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
                onClick={handleAddToBag}
                disabled={checkingAvailability || isSoldOutForDates || !isDateSelected}
              >
                {submitting
                  ? 'Adding…'
                  : !isDateSelected
                  ? 'Select Delivery Date to Add to Bag'
                  : isSoldOutForDates
                  ? 'Unavailable on Selected Dates'
                  : `Add to Bag — ${formatPaiseToRupees(pricing.total)}`}
              </button>

              <p className={styles.actionNote}>
                ✓ Includes primary size ({primarySize || listingSize}) + free backup size ({backupSize || 'None'})
              </p>
            </div>
              </>
            )}

            {/* ── Trust Perks (+ opt-in Damage Care waiver) ── */}
            {mode === 'rent' && (
              <DamageWaiverBadge
                checked={damageWaiver}
                onChange={setDamageWaiver}
                feePaise={29900}
              />
            )}

            {/* ── Hygiene Guarantee Trust Badge Trigger ── */}
            <div
              className={styles.hygieneTrustBadge}
              onClick={() => setHygieneModalOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setHygieneModalOpen(true);
                }
              }}
              aria-label="Open 7-Stage Sterilization & Hygiene Protocol"
            >
              <span className={styles.hygieneBadgeIcon}>🛡️</span>
              <div className={styles.hygieneBadgeContent}>
                <div className={styles.hygieneBadgeHeader}>
                  <span className={styles.hygieneBadgeTitle}>7-Stage Sterilization Guarantee</span>
                  <span className={styles.hygieneBadgeTag}>Hospital-Grade</span>
                </div>
                <p className={styles.hygieneBadgeSummary}>
                  Hydrocarbon eco-clean, 140°C thermal disinfection &amp; O3 molecular deodorization before tamper-evident seal.
                </p>
              </div>
              <span className={styles.hygieneBadgeAction}>Learn More →</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7-Stage Sterilization Guarantee Modal Overlay ── */}
      {hygieneModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setHygieneModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hygiene-modal-title"
        >
          <div className={styles.hygieneModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalKicker}>Hygiene &amp; Quality Protocol</span>
                <h2 id="hygiene-modal-title" className={styles.modalTitle}>
                  7-Stage Medical-Grade Sterilization Guarantee
                </h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setHygieneModalOpen(false)}
                aria-label="Close sterilization modal"
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <SterilizationGuaranteeInfographic compact={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
