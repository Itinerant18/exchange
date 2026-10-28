import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { favoritesApi } from '../../../api/favoritesApi.js';
import { ListingCard } from '../../../components/rental/ListingCard.jsx';
import styles from './FavoritesPage.module.css';

export function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'shortlists'
  const [shortlists, setShortlists] = useState([]);
  const [newShortlistTitle, setNewShortlistTitle] = useState('');

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await favoritesApi.getFavorites();
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setItems(data);
      setTotal(res?.meta?.total ?? data.length);
    } catch (err) {
      setError(err.message || 'Could not load your saved pieces.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShortlists = useCallback(async () => {
    try {
      const res = await favoritesApi.getShortlists();
      setShortlists(Array.isArray(res) ? res : (res?.data ?? []));
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    loadShortlists();
  }, [loadFavorites, loadShortlists]);

  async function handleCreateShortlist(e) {
    e.preventDefault();
    if (!newShortlistTitle.trim()) return;
    try {
      await favoritesApi.createShortlist({ title: newShortlistTitle.trim() });
      setNewShortlistTitle('');
      loadShortlists();
    } catch {
      // Handled
    }
  }

  return (
    <div className={styles.favoritesPage}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>MY WARDROBE</span>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>All Saved Looks</h1>
          <span className={styles.count}>{total} {total === 1 ? 'Piece' : 'Pieces'}</span>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Hearts ({total})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'shortlists' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('shortlists')}
          >
            Curated Shortlists ({shortlists.length})
          </button>
        </div>
      </header>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {activeTab === 'shortlists' && (
        <section className={styles.shortlistsSection}>
          <form onSubmit={handleCreateShortlist} className={styles.createShortlistForm}>
            <input
              type="text"
              placeholder="Create a new shortlist (e.g. Summer Weddings 2026)"
              value={newShortlistTitle}
              onChange={(e) => setNewShortlistTitle(e.target.value)}
              className={styles.shortlistInput}
            />
            <button type="submit" className={styles.createBtn}>Create</button>
          </form>

          {shortlists.length === 0 ? (
            <p className={styles.emptyText}>No custom shortlists created yet. Create one above to organize your looks!</p>
          ) : (
            <div className={styles.shortlistGrid}>
              {shortlists.map((s) => (
                <div key={s.id} className={styles.shortlistCard}>
                  <h4>{s.title}</h4>
                  <p>{s.itemCount} items</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'all' && (
        <>
          {loading ? (
            <p className={styles.loadingText}>Loading your closet...</p>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>Your Wardrobe is Empty</h2>
              <p className={styles.emptyText}>
                Heart the designer dresses, occasion wear, and archive pieces you love while browsing to build your dream rental calendar.
              </p>
              <Link to="/listings" className={styles.browseBtn}>
                Explore Designer Collection
              </Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
