import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const ordersApi = {
  async getMyOrders(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);

    const query = searchParams.toString();
    const url = query ? `${endpoints.orders.myOrders}?${query}` : endpoints.orders.myOrders;
    return api.get(url);
  },

  async getOrderById(id) {
    return api.get(endpoints.orders.orderById(id));
  },

  async createOrder(payload) {
    return api.post(endpoints.orders.create, payload);
  },

  async cancelOrder(id, reason = 'Buyer requested cancellation') {
    return api.post(endpoints.orders.cancel(id), { reason });
  },
};
