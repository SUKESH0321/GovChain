import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

// Restricts a route to authenticated users. When `roles` is provided, only
// users with one of the given roles are allowed through.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}