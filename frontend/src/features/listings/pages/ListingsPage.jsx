import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listingsApi } from '../../../api/listingsApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
import styles from './ListingsPage.module.css';

const OCCASIONS = [
  { label: 'All Occasions', value: '' },
  { label: 'Wedding Guest', value: 'wedding' },
  { label: 'Cocktail & Party', value: 'cocktail' },
  { label: 'Black Tie Gala', value: 'blacktie' },
  { label: 'Vacation & Resort', value: 'vacation' },
];

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = searchParams.get('q') || '';
  const occasion = searchParams.get('occasion') || '';
  const filterType = searchParams.get('type') || 'all'; // 'all', 'rental', 'sale'
  const page = Number(searchParams.get('page')) || 1;

  const [searchInput, setSearchInput] = useState(q);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 12 };
      if (q) params.q = q;
      if (filterType === 'rental') params.isRental = true;
      if (filterType === 'sale') params.isSale = true;

      const res = await listingsApi.getListings(params);
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setItems(data);
    } catch (e) {
      setError(e.message || 'Failed to load listings');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, filterType]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput) {
      newParams.set('q', searchInput);
    } else {
      newParams.delete('q');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }

  function handleTypeChange(type) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('type', type);
    newParams.set('page', '1');
    setSearchParams(newParams);
  }

  function handleOccasionChange(occ) {
    const newParams = new URLSearchParams(searchParams);
    if (occ) {
      newParams.set('occasion', occ);
    } else {
      newParams.delete('occasion');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitles}>
          <span className={styles.eyebrow}>CIRCULAR LUXURY ARCHIVE</span>
          <h1 className={styles.title}>Designer Rental Collection</h1>
          <p className={styles.subtitle}>
            Explore thousands of milestone dresses, evening gowns, and festive wear. Every rental includes a complimentary backup size.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <div className={styles.inputWrapper}>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search designer, silhouette, or occasion…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>
      </div>

      {/* ── Filter Controls ── */}
      <div className={styles.controlsRow}>
        {/* Type Tabs (Rent vs Buy) */}
        <div className={styles.typeTabs}>
          <button
            type="button"
            className={`${styles.typeBtn} ${filterType === 'all' ? styles.typeBtnActive : ''}`}
            onClick={() => handleTypeChange('all')}
          >
            All Pieces
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${filterType === 'rental' ? styles.typeBtnActive : ''}`}
            onClick={() => handleTypeChange('rental')}
          >
            Event Rentals
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${filterType === 'sale' ? styles.typeBtnActive : ''}`}
            onClick={() => handleTypeChange('sale')}
          >
            Pre-Loved Sale
          </button>
        </div>

        {/* Occasions Pills */}
        <div className={styles.occasionPills}>
          {OCCASIONS.map((occ) => (
            <button
              key={occ.value}
              type="button"
              className={`${styles.occasionPill} ${occasion === occ.value ? styles.occasionPillActive : ''}`}
              onClick={() => handleOccasionChange(occ.value)}
            >
              {occ.label}
            </button>
          ))}
        </div>

        <Link to="/listings/new" className={styles.createListingBtn}>
          + List an Outfit
        </Link>
      </div>

      {/* ── Results Count & Error ── */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <div className={styles.resultsMeta}>
        <span>Showing {items.length} designer {items.length === 1 ? 'style' : 'styles'}</span>
        {occasion && <span className={styles.activeFilterTag}>Occasion: {occasion}</span>}
      </div>

      {/* ── 3:4 Aspect Ratio Product Cards Grid ── */}
      {loading ? (
        <div className={styles.loadingGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No designer outfits found</h3>
          <p className={styles.emptyDesc}>
            We couldn't find any outfits currently matching your search or filters. Try adjusting your selections or check back soon.
          </p>
          {(q || occasion || filterType !== 'all') && (
            <button
              type="button"
              className={styles.clearFiltersBtn}
              onClick={() => {
                setSearchInput('');
                setSearchParams(new URLSearchParams());
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
