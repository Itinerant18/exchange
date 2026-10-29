import { api } from './apiClient.js';
import { endpoints } from './endpoints.js';

export const rentalsApi = {
  async getMyBookings(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.status) searchParams.set('status', params.status);
    if (params.role) searchParams.set('role', params.role);

    const query = searchParams.toString();
    const url = query ? `${endpoints.rentals.myBookings}?${query}` : endpoints.rentals.myBookings;
    return api.get(url);
  },

  async getBookingById(id) {
    return api.get(endpoints.rentals.bookingById(id));
  },

  async getAvailability(listingId, { startDate, endDate }) {
    const searchParams = new URLSearchParams({ listingId, startDate, endDate });
    return api.get(`${endpoints.rentals.availability}?${searchParams.toString()}`);
  },

  async createBooking(payload) {
    return api.post(endpoints.rentals.createBooking, payload);
  },

  async cancelBooking(id, reason) {
    return api.post(endpoints.rentals.cancelBooking(id), { reason });
  },

  async returnBooking(id) {
    return api.post(endpoints.rentals.returnBooking(id));
  },

  async acceptBooking(id) {
    return api.post(endpoints.rentals.acceptBooking(id));
  },

  async rejectBooking(id, reason) {
    return api.post(endpoints.rentals.rejectBooking(id), { reason });
  },

  async startBooking(id) {
    return api.post(endpoints.rentals.startBooking(id));
  },

  async getLateFeeQuote(id) {
    return api.get(endpoints.rentals.lateFeeQuote(id));
  },

  async requestExtension(id, payload) {
    return api.post(endpoints.rentals.requestExtension(id), payload);
  },

  async getExtensions(id) {
    return api.get(endpoints.rentals.extensions(id));
  },

  async getDeliveryQuote(payload) {
    return api.post(endpoints.delivery.quote, payload);
  },
};
