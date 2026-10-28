import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const listingsApi = {
  async getListings(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.q) searchParams.set('q', params.q);
    if (params.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params.isRental !== undefined) searchParams.set('isRental', params.isRental);
    if (params.isSale !== undefined) searchParams.set('isSale', params.isSale);
    if (params.city) searchParams.set('city', params.city);

    const query = searchParams.toString();
    const url = query ? `${endpoints.listings.list}?${query}` : endpoints.listings.list;
    return api.get(url);
  },

  async getListingById(id) {
    return api.get(endpoints.listings.byId(id));
  },

  async getAvailability(id) {
    return api.get(endpoints.rentals.availability(id));
  },

  async createListing(payload) {
    return api.post(endpoints.listings.create, payload);
  },

  async updateListing(id, payload) {
    return api.put(endpoints.listings.update(id), payload);
  },

  async deleteListing(id) {
    return api.delete(endpoints.listings.delete(id));
  },

  async uploadImage(id, formData) {
    // Note: multipart fetch handled directly
    const res = await fetch(`${endpoints.listings.images(id)}`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('exchnage.accessToken')}`,
      },
    });
    return res.json();
  },
};
