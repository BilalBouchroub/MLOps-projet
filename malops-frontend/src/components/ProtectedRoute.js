import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ROLE_GROUPS = {
  data_scientist: ['data_scientist', 'mlops_engineer'],
};

const ProtectedRoute = ({ children, requireAdmin, requireRole }) => {
  const { isAuthenticated, role } = useContext(AuthContext);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requireAdmin && role !== 'admin') return <Navigate to="/map" replace />;

  if (requireRole && role !== 'admin') {
    const allowed = ROLE_GROUPS[requireRole] || [requireRole];
    if (!allowed.includes(role)) return <Navigate to="/map" replace />;
  }

  return children;
};

export default ProtectedRoute;
