import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAuthed, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted">Loading…</p>;
  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && !isAdmin) return <p className="error">Admin access required.</p>;
  return children;
}
