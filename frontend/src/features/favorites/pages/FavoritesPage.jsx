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
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'shortlists'
  const [shortlists, setShortlists] = useState([]);
  const [newShortlistTitle, setNewShortlistTitle] = useState('');

  // Active shortlist detail view
  const [activeShortlist, setActiveShortlist] = useState(null);
  const [shortlistItems, setShortlistItems] = useState([]);
  const [shortlistItemsLoading, setShortlistItemsLoading] = useState(false);

  // Shortlist assignment modal
  const [assignListing, setAssignListing] = useState(null); // listing object or null

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

  const openShortlistDetail = async (shortlist) => {
    setActiveShortlist(shortlist);
    setShortlistItemsLoading(true);
    setError('');
    try {
      const res = await favoritesApi.getShortlistItems(shortlist.id);
      setShortlistItems(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) {
      setError(err.message || 'Could not load shortlist pieces.');
    } finally {
      setShortlistItemsLoading(false);
    }
  };

  async function handleCreateShortlist(e) {
    e.preventDefault();
    if (!newShortlistTitle.trim()) return;
    try {
      await favoritesApi.createShortlist({ title: newShortlistTitle.trim() });
      setNewShortlistTitle('');
      await loadShortlists();
      setSuccessMsg('Shortlist created successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create shortlist.');
    }
  }

  async function handleAssignToShortlist(shortlistId) {
    if (!assignListing) return;
    try {
      await favoritesApi.addToShortlist(shortlistId, assignListing.id);
      setSuccessMsg(`Added "${assignListing.title}" to shortlist.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setAssignListing(null);
      await loadShortlists();
    } catch (err) {
      setError(err.message || 'Failed to add piece to shortlist.');
    }
  }

  async function handleRemoveFromShortlist(shortlistId, listingId) {
    try {
      await favoritesApi.removeFromShortlist(shortlistId, listingId);
      setShortlistItems((prev) => prev.filter((i) => i.id !== listingId));
      await loadShortlists();
    } catch (err) {
      setError(err.message || 'Failed to remove piece from shortlist.');
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
            className={`${styles.tab} ${activeTab === 'all' && !activeShortlist ? styles.tabActive : ''}`}
            onClick={() => {
              setActiveTab('all');
              setActiveShortlist(null);
            }}
          >
            All Hearts ({total})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'shortlists' || activeShortlist ? styles.tabActive : ''}`}
            onClick={() => {
              setActiveTab('shortlists');
              setActiveShortlist(null);
            }}
          >
            Curated Shortlists ({shortlists.length})
          </button>
        </div>
      </header>

      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {successMsg && <p style={{ color: '#2E7D32', fontWeight: 600, marginBottom: '1.5rem' }}>{successMsg}</p>}

      {/* Shortlist Detail View */}
      {activeShortlist && (
        <section>
          <div className={styles.shortlistDetailHeader}>
            <div>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setActiveShortlist(null)}
              >
                ← Back to All Shortlists
              </button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
                {activeShortlist.title}
              </h2>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {shortlistItems.length} {shortlistItems.length === 1 ? 'Piece' : 'Pieces'}
            </span>
          </div>

          {shortlistItemsLoading ? (
            <p className={styles.loadingText}>Loading pieces in this shortlist…</p>
          ) : shortlistItems.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>This Shortlist is Empty</h3>
              <p className={styles.emptyText}>
                Go to "All Hearts" to select and organize your saved designer looks into this shortlist.
              </p>
              <button
                type="button"
                className={styles.browseBtn}
                onClick={() => {
                  setActiveTab('all');
                  setActiveShortlist(null);
                }}
              >
                Browse All Saved Looks
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {shortlistItems.map((listing) => (
                <div key={listing.id} className={styles.cardContainer}>
                  <ListingCard listing={listing} />
                  <button
                    type="button"
                    className={styles.removeFromShortlistBtn}
                    onClick={() => handleRemoveFromShortlist(activeShortlist.id, listing.id)}
                  >
                    ✕ Remove from Shortlist
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Shortlists Overview Tab */}
      {activeTab === 'shortlists' && !activeShortlist && (
        <section className={styles.shortlistsSection}>
          <form onSubmit={handleCreateShortlist} className={styles.createShortlistForm}>
            <input
              type="text"
              placeholder="Create a new shortlist (e.g. Summer Weddings 2026)"
              value={newShortlistTitle}
              onChange={(e) => setNewShortlistTitle(e.target.value)}
              className={styles.shortlistInput}
            />
            <button type="submit" className={styles.createBtn}>Create Shortlist</button>
          </form>

          {shortlists.length === 0 ? (
            <p className={styles.emptyText}>No custom shortlists created yet. Create one above to organize your looks!</p>
          ) : (
            <div className={styles.shortlistGrid}>
              {shortlists.map((s) => (
                <div key={s.id} className={styles.shortlistCard} onClick={() => openShortlistDetail(s)}>
                  <h4 className={styles.shortlistCardTitle}>{s.title}</h4>
                  <p className={styles.shortlistCardCount}>{s.itemCount ?? 0} {s.itemCount === 1 ? 'piece' : 'pieces'}</p>
                  <span style={{ fontSize: '0.78rem', color: '#111', fontWeight: 600, textDecoration: 'underline' }}>
                    View Shortlist →
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* All Hearts Tab */}
      {activeTab === 'all' && !activeShortlist && (
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
                <div key={listing.id} className={styles.cardContainer}>
                  <ListingCard listing={listing} />
                  {shortlists.length > 0 && (
                    <button
                      type="button"
                      className={styles.addToShortlistBtn}
                      onClick={() => setAssignListing(listing)}
                    >
                      + Save to Shortlist
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal to assign piece to a shortlist */}
      {assignListing && (
        <div className={styles.modalOverlay} onClick={() => setAssignListing(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>Add to Shortlist</h3>
              <button type="button" className={styles.closeIcon} onClick={() => setAssignListing(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
              Select a shortlist for <strong>{assignListing.title}</strong>:
            </p>

            <div className={styles.shortlistSelectList}>
              {shortlists.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.shortlistSelectItem}
                  onClick={() => handleAssignToShortlist(s.id)}
                >
                  <span>{s.title}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{s.itemCount ?? 0} pieces</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
