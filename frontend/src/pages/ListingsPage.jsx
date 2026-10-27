import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import styles from './ListingsPage.module.css';

export function ListingsPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (pageNum = page, query = q) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 12 });
      if (query) params.set('q', query);
      const res = await apiRequest(`/listings?${params}`);
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setItems(data);
      setPagination(res?.meta ?? null);
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    load(1, '');
  }, []);

  function handleSearch() {
    setPage(1);
    load(1, q);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <h1 className={styles.pageTitle}>Browse listings</h1>
          <p className={styles.pageSubtitle}>
            Find quality pieces from our community.
          </p>
        </div>

        <div className={styles.searchBar}>
          <div className={styles.searchInput}>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="form-input"
              placeholder="Search listings…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div className={styles.filters}>
          <Link
            to={`/listings/new`}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Create listing
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonBody}>
                <div className={styles.skeletonLine} style={{ width: '40%' }} />
                <div className={styles.skeletonLine} style={{ width: '85%' }} />
                <div className={styles.skeletonLine} style={{ width: '65%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <div className={styles.grid}>
            {items.map((listing) => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className={styles.listingCard}
              >
                <div className={styles.listingImageContainer}>
                  <div className={styles.listingImagePlaceholder}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <rect x="6" y="12" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 20h28" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="14" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  {(listing.isRental || listing.isSale) && (
                    <span className={`badge badge-${listing.isRental ? 'accent' : 'olive'} ${styles.badge}`}>
                      {listing.isRental ? 'Rent' : 'Buy'}
                    </span>
                  )}
                  {listing.deliveryAvailable && (
                    <span className={`badge badge-success ${styles.badge}`}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M1 5h8M5 1v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      Delivery
                    </span>
                  )}
                </div>

                <div className={styles.listingBody}>
                  <div className={styles.listingCondition}>
                    {listing.condition || 'Good condition'}
                  </div>
                  <h3 className={styles.listingTitle}>
                    {listing.title}
                  </h3>
                  <p className={styles.listingLocation}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1a4 4 0 100 8 4 4 0 000-8zM1 8a5 5 0 1110 0 5 5 0 01-10 0z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="6" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    {listing.city || 'Location not set'}
                  </p>
                </div>

                <div className={styles.listingFooter}>
                  {listing.isRental && listing.rentalPricePaise && (
                    <span className={styles.listingPrice}>
                      ₹{(listing.rentalPricePaise / 100).toFixed(0)}
                      <span className={styles.priceUnit}>/day</span>
                    </span>
                  )}
                  {listing.isSale && listing.salePricePaise && (
                    <span className={styles.listingPrice}>
                      ₹{(listing.salePricePaise / 100).toFixed(0)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className={styles.pagination}>
              <button
                className={`btn btn-secondary ${styles.pageBtn} ${page <= 1 ? styles.disabled : ''}`}
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); load(p, q); }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Previous
              </button >
              <span className={styles.pageInfo}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className={`btn btn-secondary ${styles.pageBtn} ${page >= pagination.pages ? styles.disabled : ''}`}
                disabled={page >= pagination.pages}
                onClick={() => { const p = page + 1; setPage(p); load(p, q); }}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No listings found</h3>
          <p className={styles.emptyDesc}>
            {q
              ? `We couldn\'t find anything matching "${q}". Try a different search.`
              : 'Be the first to list something on Exchnage!'}
          </p>
          {!q && (
            <Link to="/listings/new" className="btn btn-primary">
              Create your first listing
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
