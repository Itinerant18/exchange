import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

/**
 * Facet keys the discovery filters support (mirrors the backend taxonomy in
 * backend/src/modules/listings/listingAttributes.js).
 */
export const FACET_KEYS = [
  'occasion', 'neckline', 'sleeve', 'length', 'print',
  'embellishment', 'stylePersona', 'seasonality', 'maternity',
];

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
    if (params.condition) searchParams.set('condition', params.condition);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.mode) searchParams.set('mode', params.mode);

    // Facet filters: { occasion: ['Cocktail', 'BlackTie'], ... } — each
    // dimension is a comma-separated multi-select in the backend grammar.
    if (params.attributes && typeof params.attributes === 'object') {
      for (const [key, values] of Object.entries(params.attributes)) {
        if (Array.isArray(values) && values.length > 0) {
          searchParams.set(key, values.join(','));
        }
      }
    }

    const query = searchParams.toString();
    const url = query ? `${endpoints.listings.list}?${query}` : endpoints.listings.list;
    return api.get(url);
  },

  /** Available inventory unit ids for a listing (rental booking + buy-now). */
  async getAvailableUnits(id) {
    return api.get(endpoints.listings.units(id));
  },

  /** Facet value counts for the FilterModal ({ occasion: [{ value, count }], ... }). */
  async getFacets(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params.q) searchParams.set('q', params.q);
    if (params.mode) searchParams.set('mode', params.mode);
    if (params.condition) searchParams.set('condition', params.condition);
    const query = searchParams.toString();
    const url = query ? `${endpoints.listings.facets}?${query}` : endpoints.listings.facets;
    return api.get(url);
  },

  async getListingById(id) {
    return api.get(endpoints.listings.byId(id));
  },

  async getAvailability(id, dates = {}) {
    const searchParams = new URLSearchParams({ listingId: id, ...dates });
    return api.get(`${endpoints.rentals.availability}?${searchParams.toString()}`);
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

  async uploadMediaFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await api.post(endpoints.uploads, {
            fileData: reader.result,
            fileName: file.name,
            mimeType: file.type || (file.name.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video/mp4' : 'image/jpeg'),
          });
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  async uploadImageFile(file) {
    return this.uploadMediaFile(file);
  },

  /** Attach uploaded media metadata to an existing listing */
  async addListingImage(id, { objectKey, mimeType, sizeBytes, isPrimary = false }) {
    return api.post(endpoints.listings.images(id), { objectKey, mimeType, sizeBytes, isPrimary });
  },

  async uploadImage(id, fileOrData) {
    if (typeof FormData !== 'undefined' && fileOrData instanceof FormData) {
      return api.post(endpoints.listings.images(id), fileOrData);
    }

    if (typeof File !== 'undefined' && (fileOrData instanceof File || fileOrData instanceof Blob)) {
      const upload = await this.uploadMediaFile(fileOrData);
      const data = upload?.data || upload;
      return this.addListingImage(id, {
        objectKey: data.url || data.fileName,
        mimeType: data.mimeType || 'image/jpeg',
        sizeBytes: data.sizeBytes || fileOrData.size || 250000,
      });
    }

    return api.post(endpoints.listings.images(id), fileOrData);
  },
};
