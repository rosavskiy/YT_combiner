import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import useAuthStore from '../stores/authStore';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, requiresApproval, isAdmin, user } = useAuthStore();

  // Не авторизован - перенаправляем на логин
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Ожидает подтверждения - перенаправляем на страницу ожидания
  if (requiresApproval) {
    return <Navigate to="/login" replace />;
  }

  // Требуются права администратора, но их нет
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
