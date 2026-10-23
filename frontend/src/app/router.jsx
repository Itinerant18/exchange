import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { HomePage } from '../features/home/pages/HomePage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.jsx';
import { ListingsPage } from '../pages/ListingsPage.jsx';
import { ListingDetailPage } from '../pages/ListingDetailPage.jsx';
import { CreateListingPage } from '../pages/CreateListingPage.jsx';
import { MyBookingsPage } from '../pages/MyBookingsPage.jsx';
import { BookingDetailPage } from '../pages/BookingDetailPage.jsx';
import { MyOrdersPage } from '../pages/MyOrdersPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { AdminPage } from '../pages/AdminPage.jsx';
import { DisputesPage } from '../pages/DisputesPage.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';

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
      { path: 'bookings', element: <ProtectedRoute><MyBookingsPage /></ProtectedRoute> },
      { path: 'bookings/:id', element: <ProtectedRoute><BookingDetailPage /></ProtectedRoute> },
      { path: 'orders', element: <ProtectedRoute><MyOrdersPage /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'disputes', element: <ProtectedRoute><DisputesPage /></ProtectedRoute> },
      { path: 'admin', element: <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute> },
    ],
  },
]);
