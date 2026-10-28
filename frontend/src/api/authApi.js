import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const authApi = {
  async login(credentials) {
    return api.post(endpoints.auth.login, credentials);
  },

  async register(payload) {
    return api.post(endpoints.auth.register, payload);
  },

  async me() {
    return api.get(endpoints.auth.me);
  },

  async logout() {
    return api.post(endpoints.auth.logout);
  },

  async forgotPassword(email) {
    return api.post(endpoints.auth.forgotPassword, { email });
  },

  async resetPassword({ token, password }) {
    return api.post(endpoints.auth.resetPassword, { token, password });
  },
};
