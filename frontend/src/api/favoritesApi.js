import { apiRequest } from '../services/apiClient.js';

export const favoritesApi = {
  getFavoriteIds: () => apiRequest('/favorites/ids'),
  getFavorites: (params = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page);
    if (params.limit) q.set('limit', params.limit);
    const qs = q.toString();
    return apiRequest(`/favorites${qs ? `?${qs}` : ''}`);
  },
  addFavorite: (listingId) => apiRequest(`/favorites/${listingId}`, { method: 'POST' }),
  removeFavorite: (listingId) => apiRequest(`/favorites/${listingId}`, { method: 'DELETE' }),

  getShortlists: () => apiRequest('/favorites/shortlists'),
  createShortlist: (data) => apiRequest('/favorites/shortlists', { method: 'POST', body: data }),
  addToShortlist: (shortlistId, listingId) =>
    apiRequest(`/favorites/shortlists/${shortlistId}/items/${listingId}`, { method: 'POST' }),
  removeFromShortlist: (shortlistId, listingId) =>
    apiRequest(`/favorites/shortlists/${shortlistId}/items/${listingId}`, { method: 'DELETE' }),
};
