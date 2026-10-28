import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const categoriesApi = {
  async getCategories() {
    return api.get(endpoints.categories.list);
  },

  async getCategoryTree() {
    return api.get(endpoints.categories.tree);
  },

  async getCategoryBySlug(slug) {
    return api.get(endpoints.categories.bySlug(slug));
  },
};
