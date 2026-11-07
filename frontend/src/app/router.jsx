import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary.jsx';

import { HomePage } from '../features/home/pages/HomePage.jsx';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from '../features/auth/index.js';
import { ListingsPage } from '../features/listings/pages/ListingsPage.jsx';
import { ListingDetailPage } from '../features/listings/pages/ListingDetailPage.jsx';
import {
  MyBookingsPage,
  BookingDetailPage,
} from '../features/rentals/index.js';
import { MyOrdersPage } from '../features/orders/index.js';
import { ProfilePage } from '../features/profile/index.js';
import { DisputesPage } from '../features/disputes/index.js';
import { FavoritesPage } from '../features/favorites/index.js';
import { BlogIndexPage, BlogDetailPage } from '../features/blog/index.js';

// Route-level code splitting for heavy routes (§7 budget)
const CreateListingPage = lazy(() => import('../features/listings/pages/CreateListingPage.jsx').then((m) => ({ default: m.CreateListingPage })));
const LendPage = lazy(() => import('../features/listings/pages/LendPage.jsx').then((m) => ({ default: m.LendPage })));
const AdminPage = lazy(() => import('../features/admin/pages/AdminPage.jsx').then((m) => ({ default: m.AdminPage })));

function LazyRoute({ children }) {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '60dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255, 255, 255, 0.2)', borderTopColor: '#C8A251', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#999', fontSize: '0.85rem' }}>Loading atelier view…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'listings', element: <ListingsPage /> },
      { path: 'blog', element: <BlogIndexPage /> },
      { path: 'blog/:slug', element: <BlogDetailPage /> },
      { path: 'lend', element: <LazyRoute><LendPage /></LazyRoute> },
      { path: 'listings/new', element: <ProtectedRoute><LazyRoute><CreateListingPage /></LazyRoute></ProtectedRoute> },
      { path: 'listings/:id', element: <ListingDetailPage /> },
      { path: 'favorites', element: <ProtectedRoute><FavoritesPage /></ProtectedRoute> },
      { path: 'bookings', element: <ProtectedRoute><MyBookingsPage /></ProtectedRoute> },
      { path: 'bookings/:id', element: <ProtectedRoute><BookingDetailPage /></ProtectedRoute> },
      { path: 'orders', element: <ProtectedRoute><MyOrdersPage /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'disputes', element: <ProtectedRoute><DisputesPage /></ProtectedRoute> },
      { path: 'admin', element: <ProtectedRoute adminOnly><LazyRoute><AdminPage /></LazyRoute></ProtectedRoute> },
    ],
  },
]);
