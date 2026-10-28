import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const reviewsApi = {
  async getReviews(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.revieweeId) searchParams.set('revieweeId', params.revieweeId);
    if (params.minRating) searchParams.set('minRating', params.minRating);
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);

    const query = searchParams.toString();
    const url = query ? `${endpoints.reviews.list}?${query}` : endpoints.reviews.list;
    return api.get(url);
  },

  async getReviewById(id) {
    return api.get(endpoints.reviews.byId(id));
  },

  async createReview(payload) {
    return api.post(endpoints.reviews.create, payload);
  },
};
