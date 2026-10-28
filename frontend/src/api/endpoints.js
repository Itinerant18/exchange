/**
 * Central registry of all backend API endpoints.
 * Paths are relative to VITE_API_BASE_URL (http://127.0.0.1:5000/api/v1).
 */
export const endpoints = Object.freeze({
  health: '/health',
  healthReady: '/health/ready',

  // Authentication & Session
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },

  // User & Profiles
  users: {
    me: '/users/me',
    addresses: '/users/addresses',
    addressById: (id) => `/users/addresses/${id}`,
  },

  // Categories & Taxonomy
  categories: {
    list: '/categories',
    tree: '/categories/tree',
    bySlug: (slug) => `/categories/${slug}`,
    adminTree: '/admin/categories/tree',
  },

  // Listings & Catalog
  listings: {
    list: '/listings',
    byId: (id) => `/listings/${id}`,
    create: '/listings',
    update: (id) => `/listings/${id}`,
    delete: (id) => `/listings/${id}`,
    images: (id) => `/listings/${id}/images`,
    myListings: '/listings/mine',
  },

  // Inventory Items (physical garment units)
  inventory: {
    byListing: (listingId) => `/inventory/listings/${listingId}`,
    create: (listingId) => `/inventory/listings/${listingId}`,
    updateStatus: (id) => `/inventory/${id}/status`,
  },

  // Rentals & Availability
  rentals: {
    availability: '/rentals/availability',
    createBooking: '/rentals/bookings',
    myBookings: '/rentals/bookings',
    bookingById: (id) => `/rentals/bookings/${id}`,
    cancelBooking: (id) => `/rentals/bookings/${id}/cancel`,
    returnBooking: (id) => `/rentals/bookings/${id}/return`,
    requestExtension: (id) => `/rentals/bookings/${id}/extensions`,
  },

  // Sales Orders (pre-loved resale)
  orders: {
    create: '/orders',
    myOrders: '/orders',
    orderById: (id) => `/orders/${id}`,
  },

  // Payments & Deposits
  payments: {
    intent: '/payments/intent',
    history: '/payments',
  },
  deposits: {
    myDeposits: '/deposits',
    byId: (id) => `/deposits/${id}`,
  },

  // Reviews & Reputation
  reviews: {
    list: '/reviews',
    byId: (id) => `/reviews/${id}`,
    create: '/reviews',
  },

  // Delivery / Courier Quotes
  delivery: {
    quote: '/delivery/quote',
  },

  // Disputes & Resolution
  disputes: {
    list: '/disputes',
    byId: (id) => `/disputes/${id}`,
    create: '/disputes',
  },

  // Admin & Operational Backoffice
  admin: {
    auditLogs: '/admin/audit-logs',
    extensions: '/admin/extensions',
    inspectionQueue: '/admin/inspections',
    processInspection: (bookingId) => `/admin/inspections/${bookingId}`,
    settings: '/admin/settings',
    kycQueue: '/admin/kyc',
  },
});
