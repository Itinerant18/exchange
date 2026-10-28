import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';

import { HomePage } from '../features/home/pages/HomePage.jsx';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from '../features/auth/index.js';
import {
  ListingsPage,
  ListingDetailPage,
  CreateListingPage,
} from '../features/listings/index.js';
import {
  MyBookingsPage,
  BookingDetailPage,
} from '../features/rentals/index.js';
import { MyOrdersPage } from '../features/orders/index.js';
import { ProfilePage } from '../features/profile/index.js';
import { DisputesPage } from '../features/disputes/index.js';
import { AdminPage } from '../features/admin/index.js';
import { FavoritesPage } from '../features/favorites/index.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'listings', element: <ListingsPage /> },
      { path: 'listings/new', element: <ProtectedRoute><CreateListingPage /></ProtectedRoute> },
      { path: 'listings/:id', element: <ListingDetailPage /> },
      { path: 'favorites', element: <ProtectedRoute><FavoritesPage /></ProtectedRoute> },
      { path: 'bookings', element: <ProtectedRoute><MyBookingsPage /></ProtectedRoute> },
      { path: 'bookings/:id', element: <ProtectedRoute><BookingDetailPage /></ProtectedRoute> },
      { path: 'orders', element: <ProtectedRoute><MyOrdersPage /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'disputes', element: <ProtectedRoute><DisputesPage /></ProtectedRoute> },
      { path: 'admin', element: <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute> },
    ],
  },
]);
