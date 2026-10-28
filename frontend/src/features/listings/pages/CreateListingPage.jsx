import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { categoriesApi } from '../../../api/categoriesApi.js';
import { api } from '../../../api/apiClient.js';
import { formatPaiseToRupees } from '../../../utils/formatters.js';
import { FACET_TAXONOMY } from '../../../components/rental/FilterModal.jsx';
import styles from './CreateListingPage.module.css';

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2', '4', '6', '8', '10', '12'];

export function CreateListingPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [form, setForm] = useState({
    title: '',
    brand: '',
    categoryId: '',
    size: 'M',
    colour: '',
    condition: 'good',
    description: '',
    city: '',
    isRental: true,
    isSale: false,
    rentalPriceRupees: '',
    depositRupees: '',
    replacementValueRupees: '',
    salePriceRupees: '',
    imageUrl: '',
    deliveryAvailable: true,
  });

  // Structured style attributes ({ occasion: [...], length: [...] }).
  const [attributes, setAttributes] = useState({});

  function toggleFacetValue(facetKey, value) {
    setAttributes((current) => {
      const values = current[facetKey] ?? [];
      const next = { ...current, [facetKey]: values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value] };
      if (next[facetKey].length === 0) delete next[facetKey];
      return next;
    });
  }

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Fetch active categories on mount
  useEffect(() => {
    categoriesApi.getCategories()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setCategories(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, categoryId: prev.categoryId || list[0].id }));
        }
      })
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || form.title.trim().length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }

    if (!form.categoryId) {
      setError('Please select a category for this outfit.');
      return;
    }

    if (!form.isRental && !form.isSale) {
      setError('Please select at least one offer type (Rent or Sell).');
      return;
    }

    setBusy(true);

    try {
      // 1. Build listing payload with integer paise conversion
      const payload = {
        title: form.title.trim(),
        brand: form.brand.trim() || 'DESIGNER ARCHIVE',
        categoryId: form.categoryId,
        size: form.size,
        colour: form.colour.trim() || null,
        condition: form.condition,
        description: form.description.trim() || null,
        city: form.city.trim() || null,
        isRental: Boolean(form.isRental),
        isSale: Boolean(form.isSale),
        deliveryAvailable: Boolean(form.deliveryAvailable),
      };

      if (form.isRental) {
        payload.rentalPricePaise = Math.round(Number(form.rentalPriceRupees) * 100);
        payload.depositPaise = Math.round(Number(form.depositRupees) * 100);
      }

      if (form.replacementValueRupees) {
        payload.replacementValuePaise = Math.round(Number(form.replacementValueRupees) * 100);
      }

      if (form.isSale && form.salePriceRupees !== '') {
        payload.salePricePaise = Math.round(Number(form.salePriceRupees) * 100);
      }

      if (Object.keys(attributes).length > 0) {
        payload.attributes = attributes;
      }

      // 2. Create listing row
      const listing = await listingsApi.createListing(payload);

      // 3. Attach primary image (with unique key tracking)
      if (form.imageUrl) {
        try {
          const uniqueKey = form.imageUrl.includes('?')
            ? `${form.imageUrl}&v=${Date.now()}`
            : `${form.imageUrl}?v=${Date.now()}`;

          await api.post(`/listings/${listing.id}/images`, {
            objectKey: uniqueKey,
            mimeType: 'image/jpeg',
            sizeBytes: 250000,
            isPrimary: true,
          });
        } catch (imgErr) {
          console.warn('Image attachment notice:', imgErr.message);
        }
      }

      // 4. Create initial physical inventory unit so the dress is ready for bookings
      try {
        await api.post('/inventory/items', {
          listingId: listing.id,
          condition: form.condition,
        });
      } catch (invErr) {
        console.warn('Inventory unit notice:', invErr.message);
      }

      // 5. Navigate to the newly created listing
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError(err.message || 'Failed to publish listing. Please check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Breadcrumb & Header ── */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/listings">Catalog</Link>
          <span className={styles.divider}>/</span>
          <span>List Outfit</span>
        </nav>

        <div className={styles.header}>
          <span className={styles.eyebrow}>CURATE THE CLOSET</span>
          <h1 className={styles.title}>List a Designer Outfit</h1>
          <p className={styles.subtitle}>
            Offer your luxury pieces to our verified circular fashion community for event rental or pre-loved resale.
          </p>
        </div>

        {error && (
          <div className={styles.alertError} role="alert">
            {error}
          </div>
        )}

        {/* ── 2-Column Layout: Form (Left) & Live Preview (Right) ── */}
        <div className={styles.layoutGrid}>
          {/* ── Form Column ── */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Section 1: Garment & Designer Intel */}
            <div className={styles.section}>
              <h2 className={styles.sectionHeading}>1. Garment & Designer Details</h2>

              <div className={styles.formGroup}>
                <label htmlFor="designer-brand" className={styles.label}>
                  Designer / Brand *
                </label>
                <input
                  id="designer-brand"
                  type="text"
                  placeholder="e.g. REFORMATION, BADGLEY MISCHKA, SABYASACHI"
                  className={styles.input}
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="listing-title" className={styles.label}>
                  Outfit Title *
                </label>
                <input
                  id="listing-title"
                  type="text"
                  placeholder="e.g. Emerald Cascade Pleated Gown"
                  className={styles.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="category-select" className={styles.label}>
                    Category *
                  </label>
                  <select
                    id="category-select"
                    className={styles.select}
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    required
                    disabled={loadingCategories}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="size-select" className={styles.label}>
                    Size *
                  </label>
                  <select
                    id="size-select"
                    className={styles.select}
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                  >
                    {STANDARD_SIZES.map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="condition-select" className={styles.label}>
                    Condition *
                  </label>
                  <select
                    id="condition-select"
                    className={styles.select}
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    <option value="new">New with tags (Never worn)</option>
                    <option value="like_new">Like new (Worn once / Pristine)</option>
                    <option value="good">Good (Gentle wear, flawless)</option>
                    <option value="fair">Fair (Minor signs of wear)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="colour-input" className={styles.label}>
                    Color / Shade
                  </label>
                  <input
                    id="colour-input"
                    type="text"
                    placeholder="e.g. Emerald Green, Midnight Navy"
                    className={styles.input}
                    value={form.colour}
                    onChange={(e) => setForm({ ...form, colour: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description-input" className={styles.label}>
                  Description & Styling Notes
                </label>
                <textarea
                  id="description-input"
                  className={styles.textarea}
                  rows={4}
                  placeholder="Describe the fabric, silhouette, lining, cup fit, recommended heels, and occasion suitability…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="city-input" className={styles.label}>
                  Location / City *
                </label>
                <input
                  id="city-input"
                  type="text"
                  placeholder="e.g. Mumbai, Delhi, Bengaluru"
                  className={styles.input}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Section 1b: Style Attributes (facet taxonomy) */}
            <div className={styles.section}>
              <h2 className={styles.sectionHeading}>1b. Style Attributes</h2>
              <p className={styles.sectionNote}>
                These attributes power discovery filters. Pick every value that applies.
              </p>
              {FACET_TAXONOMY.map((facet) => (
                <div key={facet.key} className={styles.formGroup}>
                  <span className={styles.label}>{facet.label}</span>
                  <div className={styles.chipRow}>
                    {facet.values.map((value) => {
                      const isSelected = (attributes[facet.key] ?? []).includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`${styles.chip} ${isSelected ? styles.chipActive : ''}`}
                          onClick={() => toggleFacetValue(facet.key, value)}
                          aria-pressed={isSelected}
                        >
                          {value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Section 2: Imagery */}
            <div className={styles.section}>
              <h2 className={styles.sectionHeading}>2. Photography & Imagery</h2>
              <div className={styles.formGroup}>
                <label htmlFor="image-url" className={styles.label}>
                  Image URL *
                </label>
                <input
                  id="image-url"
                  type="url"
                  className={styles.input}
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  required
                />
                <span className={styles.hint}>
                  Enter a direct high-resolution image URL (PNG, JPG, or WebP) of your designer garment.
                </span>
              </div>
            </div>

            {/* Section 3: Offer Type & Pricing */}
            <div className={styles.section}>
              <h2 className={styles.sectionHeading}>3. Pricing & Rental Terms</h2>

              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.isRental}
                    onChange={(e) => setForm({ ...form, isRental: e.target.checked })}
                  />
                  <span>Offer for Event Rental (Recommended)</span>
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.isSale}
                    onChange={(e) => setForm({ ...form, isSale: e.target.checked })}
                  />
                  <span>Offer for Pre-Loved Purchase</span>
                </label>
              </div>

              {form.isRental && (
                <div className={styles.pricingSubgrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="rental-price" className={styles.label}>
                      Daily Rental Rate (₹) *
                    </label>
                    <input
                      id="rental-price"
                      type="number"
                      min="100"
                      step="50"
                      className={styles.input}
                      value={form.rentalPriceRupees}
                      onChange={(e) => setForm({ ...form, rentalPriceRupees: Number(e.target.value) })}
                      required
                    />
                    <span className={styles.hint}>4-day rental will subtotal: ₹{form.rentalPriceRupees * 4}</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="deposit-price" className={styles.label}>
                      Security Deposit (₹) *
                    </label>
                    <input
                      id="deposit-price"
                      type="number"
                      min="0"
                      step="100"
                      className={styles.input}
                      value={form.depositRupees}
                      onChange={(e) => setForm({ ...form, depositRupees: Number(e.target.value) })}
                      required
                    />
                    <span className={styles.hint}>Refunded to renter upon return inspection</span>
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="retail-price" className={styles.label}>
                  Original Retail Value (₹) *
                </label>
                <input
                  id="retail-price"
                  type="number"
                  min="500"
                  step="500"
                  className={styles.input}
                  value={form.replacementValueRupees}
                  onChange={(e) => setForm({ ...form, replacementValueRupees: Number(e.target.value) })}
                  required
                />
                <span className={styles.hint}>Used as the anchor value to show customer savings</span>
              </div>

              {form.isSale && (
                <div className={styles.formGroup}>
                  <label htmlFor="sale-price" className={styles.label}>
                    Sale Price (₹) *
                  </label>
                  <input
                    id="sale-price"
                    type="number"
                    min="500"
                    step="100"
                    className={styles.input}
                    value={form.salePriceRupees}
                    onChange={(e) => setForm({ ...form, salePriceRupees: e.target.value })}
                    required={form.isSale}
                  />
                  <span className={styles.hint}>One-time permanent purchase price</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <Link to="/listings" className={styles.cancelBtn}>
                Cancel
              </Link>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={busy || !form.title}
              >
                {busy ? 'Publishing Outfit…' : 'Publish to Atelier'}
              </button>
            </div>
          </form>

          {/* ── Right Column: Live Card Preview ── */}
          <div className={styles.previewCol}>
            <div className={styles.stickyPreview}>
              <span className={styles.previewBadge}>✦ LIVE CATALOG PREVIEW</span>

              <article className={styles.previewCard}>
                <div className={styles.previewImgFrame}>
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt={form.title || 'Outfit Preview'}
                      className={styles.previewImg}
                    />
                  ) : (
                    <div className={styles.previewNoImg}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                      </svg>
                      <span>Image Preview</span>
                    </div>
                  )}
                  <div className={styles.cardBadges}>
                    {form.isRental && <span className={styles.badgeRental}>Rent</span>}
                    {form.isSale && <span className={styles.badgeSale}>Pre-Loved</span>}
                  </div>
                  {form.size && (
                    <div className={styles.sizeIndicator}>
                      Size: {form.size}
                    </div>
                  )}
                </div>

                <div className={styles.previewCardContent}>
                  <div className={styles.previewBrandRow}>
                    <span className={styles.previewBrand}>{form.brand || 'Brand'}</span>
                    {form.city && <span className={styles.previewCity}>{form.city}</span>}
                  </div>

                  <h3 className={styles.previewTitle}>
                    {form.title || 'Outfit Title Preview'}
                  </h3>

                  <div className={styles.previewPricing}>
                    {form.isRental && (
                      <span className={styles.previewRental}>
                        ₹{form.rentalPriceRupees || 0} <small>/ day</small>
                      </span>
                    )}
                    {form.replacementValueRupees && (
                      <span className={styles.previewRetail}>
                        ₹{form.replacementValueRupees} retail
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
