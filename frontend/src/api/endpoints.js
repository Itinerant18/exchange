/**
 * Central registry of all backend API endpoints.
 * Paths are relative to VITE_API_BASE_URL (http://127.0.0.1:5000/api/v1).
 */
export const endpoints = Object.freeze({
  health: '/health',
  healthReady: '/health/ready',
  uploads: '/uploads',

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
    me: '/users/me/profile',
    addresses: '/users/me/addresses',
    addressById: (id) => `/users/me/addresses/${id}`,
  },

  // Categories & Taxonomy
  categories: {
    list: '/categories',
    tree: '/categories/tree',
    byId: (id) => `/categories/${id}`,
    bySlug: (slug) => `/categories/${slug}`,
    adminTree: '/admin/categories/tree',
  },

  // Listings & Catalog
  // Facet value counts for the discovery FilterModal.
  listings: {
    list: '/listings',
    facets: '/listings/facets',
    units: (id) => `/listings/${id}/units`,
    reviews: (id) => `/listings/${id}/reviews`,
    byId: (id) => `/listings/${id}`,
    create: '/listings',
    update: (id) => `/listings/${id}`,
    delete: (id) => `/listings/${id}`,
    images: (id) => `/listings/${id}/images`,
    myListings: '/listings/mine',
  },

  // Inventory Items (physical garment units)
  inventory: {
    items: '/inventory/items',
    itemById: (id) => `/inventory/items/${id}`,
    create: '/inventory/items',
    list: '/inventory/items',
  },

  // Rentals & Availability
  rentals: {
    availability: '/rentals/availability',
    createBooking: '/rentals/bookings',
    myBookings: '/rentals/bookings',
    bookingById: (id) => `/rentals/bookings/${id}`,
    cancelBooking: (id) => `/rentals/bookings/${id}/cancel`,
    returnBooking: (id) => `/rentals/bookings/${id}/return`,
    acceptBooking: (id) => `/rentals/bookings/${id}/accept`,
    rejectBooking: (id) => `/rentals/bookings/${id}/reject`,
    startBooking: (id) => `/rentals/bookings/${id}/start`,
    lateFeeQuote: (id) => `/rentals/bookings/${id}/late-fee`,
    requestExtension: (id) => `/rentals/bookings/${id}/extensions`,
    extensions: (id) => `/rentals/bookings/${id}/extensions`,
  },

  // Sales Orders (pre-loved resale)
  orders: {
    create: '/orders',
    myOrders: '/orders',
    orderById: (id) => `/orders/${id}`,
    cancel: (id) => `/orders/${id}/cancel`,
  },

  // Payments & Deposits
  payments: {
    create: '/payments',
    intent: '/payments',
    history: '/payments',
    byId: (id) => `/payments/${id}`,
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
    myReviews: '/reviews/mine',
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
    users: '/admin/users',
    userRoles: (id) => `/admin/users/${id}/roles`,
    userStatus: (id) => `/admin/users/${id}/status`,
    bookings: '/admin/bookings',
    payments: '/admin/payments',
    settlePayment: (id) => `/admin/payments/${id}/settle`,
    failPayment: (id) => `/admin/payments/${id}/fail`,
    deposits: '/admin/deposits',
    releaseDeposit: (id) => `/admin/deposits/${id}/release`,
    deductDeposit: (id) => `/admin/deposits/${id}/deduct`,
    categories: '/admin/categories',
    createCategory: '/categories',
    updateCategory: (id) => `/categories/${id}`,
    deactivateCategory: (id) => `/categories/${id}`,
    auditLogs: '/admin/audit-logs',
    extensions: '/admin/extensions',
    extensionDecision: (id) => `/admin/extensions/${id}/decision`,
    inspectionQueue: '/admin/inspections',
    processInspection: (bookingId) => `/admin/inspections/${bookingId}`,
    settings: '/admin/settings',
    kycQueue: '/admin/kyc',
    reconciliation: '/admin/reports/reconciliation',
  },
});
