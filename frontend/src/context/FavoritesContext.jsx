import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { favoritesApi } from '../api/favoritesApi.js';
import { useAuth } from './AuthContext.jsx';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { isAuthed } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const loadIds = useCallback(async () => {
    if (!isAuthed) {
      setFavoriteIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = await favoritesApi.getFavoriteIds();
      const ids = Array.isArray(res) ? res : (res?.data ?? []);
      setFavoriteIds(new Set(ids));
    } catch {
      // Degrade silently if unauthenticated
      setFavoriteIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    loadIds();
  }, [loadIds]);

  const isFavorite = useCallback(
    (listingId) => favoriteIds.has(listingId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (listingId) => {
      if (!isAuthed) {
        return false;
      }
      const willBeFav = !favoriteIds.has(listingId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (willBeFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });

      try {
        if (willBeFav) {
          await favoritesApi.addFavorite(listingId);
        } else {
          await favoritesApi.removeFavorite(listingId);
        }
        return true;
      } catch (err) {
        // Rollback on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (willBeFav) next.delete(listingId);
          else next.add(listingId);
          return next;
        });
        throw err;
      }
    },
    [favoriteIds, isAuthed],
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite, loading, reload: loadIds }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return ctx;
}
