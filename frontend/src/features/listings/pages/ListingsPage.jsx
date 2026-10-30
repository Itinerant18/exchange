import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listingsApi, FACET_KEYS } from '../../../api/listingsApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
import { FilterModal } from '../../../components/rental/FilterModal.jsx';
import styles from './ListingsPage.module.css';

const OCCASIONS = [
  { label: 'All Occasions', value: '' },
  { label: 'Wedding Guest', value: 'WeddingGuest' },
  { label: 'Cocktail & Party', value: 'Cocktail' },
  { label: 'Black Tie Gala', value: 'BlackTie' },
  { label: 'Festive & Sangeet', value: 'Festive' },
  { label: 'Vacation & Resort', value: 'Vacation' },
];

const SILHOUETTES = [
  { label: 'All Silhouettes', value: '' },
  { label: 'Lehenga', value: 'Lehenga' },
  { label: 'Saree', value: 'Saree' },
  { label: 'Evening Gown', value: 'Gown' },
  { label: 'Anarkali', value: 'Anarkali' },
  { label: 'Sherwani', value: 'Sherwani' },
  { label: 'Indo-Western', value: 'Indo-Western' },
];

const ALL_FACET_KEYS = [...FACET_KEYS, 'silhouette'];

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = searchParams.get('q') || '';
  const currentSilhouette = searchParams.get('silhouette') || '';
  const rawType = searchParams.get('type')
    || (searchParams.get('rental') === 'true' || searchParams.get('mode') === 'rent' ? 'rental' : '')
    || (searchParams.get('sale') === 'true' || searchParams.get('mode') === 'sale' ? 'sale' : '')
    || 'all';
  const filterType = rawType === 'rent' ? 'rental' : rawType;
  const page = Number(searchParams.get('page')) || 1;

  // Derive facet selections directly from searchParams
  const selectedFacets = useMemo(() => {
    const initial = {};
    for (const [key, value] of searchParams.entries()) {
      if (ALL_FACET_KEYS.includes(key) && value) {
        initial[key] = value.split(',').filter(Boolean);
      }
    }
    return initial;
  }, [searchParams]);

  const [searchInput, setSearchInput] = useState(q);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [facetCounts, setFacetCounts] = useState({});

  const activeFacetCount = useMemo(() => {
    return Object.values(selectedFacets).reduce((sum, values) => sum + values.length, 0);
  }, [selectedFacets]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 12, attributes: selectedFacets };
      const effectiveSilhouette = currentSilhouette || (selectedFacets.silhouette?.length ? selectedFacets.silhouette[0] : '');
      const effectiveQ = q || effectiveSilhouette;
      if (effectiveQ) params.q = effectiveQ;
      if (effectiveSilhouette) params.silhouette = effectiveSilhouette;
      if (filterType === 'rental') params.mode = 'rent';
      if (filterType === 'sale') params.mode = 'sale';

      const res = await listingsApi.getListings(params);
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setItems(data);
    } catch (e) {
      setError(e.message || 'Failed to load listings');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, currentSilhouette, filterType, selectedFacets]);


  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Facet value counts refresh with the base context (not the facet filters).
  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (filterType === 'rental' || filterType === 'rent') params.mode = 'rent';
    if (filterType === 'sale') params.mode = 'sale';
    listingsApi.getFacets(params)
      .then((res) => setFacetCounts(res?.data ?? res ?? {}))
      .catch(() => setFacetCounts({}));
  }, [q, filterType]);

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
    newParams.delete('rental');
    newParams.delete('sale');
    newParams.delete('mode');
    newParams.set('page', '1');
    setSearchParams(newParams);
  }

  function syncFacetParams(next) {
    const newParams = new URLSearchParams(searchParams);
    for (const key of ALL_FACET_KEYS) {
      newParams.delete(key);
    }
    for (const [key, values] of Object.entries(next)) {
      if (ALL_FACET_KEYS.includes(key) && values.length > 0) {
        newParams.set(key, values.join(','));
      }
    }
    if (next.silhouette && next.silhouette.length > 0) {
      const sil = next.silhouette[0];
      if (!q || SILHOUETTES.some((s) => s.value && s.value === q)) {
        newParams.set('q', sil);
        setSearchInput(sil);
      }
    } else {
      if (SILHOUETTES.some((s) => s.value && s.value === q)) {
        newParams.delete('q');
        setSearchInput('');
      }
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }

  function handleOccasionChange(occ) {
    const next = occ ? { ...selectedFacets, occasion: [occ] } : { ...selectedFacets };
    if (!occ) delete next.occasion;
    syncFacetParams(next);
  }

  function handleSilhouetteChange(sil) {
    const next = sil ? { ...selectedFacets, silhouette: [sil] } : { ...selectedFacets };
    if (!sil) delete next.silhouette;
    syncFacetParams(next);
  }

  function handleToggleFacetValue(facetKey, value) {
    const current = selectedFacets[facetKey] ?? [];
    const nextValues = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    const next = { ...selectedFacets, [facetKey]: nextValues };
    if (nextValues.length === 0) delete next[facetKey];
    syncFacetParams(next);
  }

  function handleClearFacet(facetKey) {
    const next = { ...selectedFacets };
    delete next[facetKey];
    syncFacetParams(next);
  }

  function handleClearAllFacets() {
    syncFacetParams({});
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
        <div className={styles.filterPillGroup}>
          <span className={styles.filterSectionLabel}>Occasion:</span>
          <div className={styles.occasionPills}>
            {OCCASIONS.map((occ) => (
              <button
                key={occ.value}
                type="button"
                className={`${styles.occasionPill} ${(selectedFacets.occasion ?? []).join(',') === occ.value ? styles.occasionPillActive : ''}`}
                onClick={() => handleOccasionChange(occ.value)}
                disabled={occ.value === '' && (selectedFacets.occasion ?? []).length === 0}
              >
                {occ.label}
              </button>
            ))}
          </div>
        </div>

        {/* Silhouette Pills */}
        <div className={styles.filterPillGroup}>
          <span className={styles.filterSectionLabel}>Silhouette:</span>
          <div className={styles.occasionPills}>
            {SILHOUETTES.map((sil) => (
              <button
                key={sil.value}
                type="button"
                className={`${styles.occasionPill} ${(currentSilhouette === sil.value || (!currentSilhouette && sil.value === '')) ? styles.occasionPillActive : ''}`}
                onClick={() => handleSilhouetteChange(sil.value)}
              >
                {sil.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlsActions}>
          <button
            type="button"
            className={styles.filterModalBtn}
            onClick={() => setFilterModalOpen(true)}
          >
            Filters{activeFacetCount > 0 ? ` (${activeFacetCount})` : ''}
          </button>
          <Link to="/listings/new" className={styles.createListingBtn}>
            + List an Outfit
          </Link>
        </div>
      </div>

      {/* ── Results Count & Error ── */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <div className={styles.resultsMeta}>
        <span>Showing {items.length} designer {items.length === 1 ? 'style' : 'styles'}</span>
        {currentSilhouette && (
          <span className={styles.activeFilterTag}>
            silhouette: {currentSilhouette}
          </span>
        )}
        {Object.entries(selectedFacets).filter(([key]) => key !== 'silhouette').map(([key, values]) => (
          <span key={key} className={styles.activeFilterTag}>
            {key}: {values.join(', ')}
          </span>
        ))}
      </div>

      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        selected={selectedFacets}
        onToggleValue={handleToggleFacetValue}
        onClearFacet={handleClearFacet}
        onClearAll={handleClearAllFacets}
        facetCounts={facetCounts}
        activeCount={activeFacetCount}
        totalResults={items.length}
      />

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
          {(q || activeFacetCount > 0 || filterType !== 'all') && (
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
