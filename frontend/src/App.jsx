import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TrendsPage from './pages/TrendsPage';
import TopicsPage from './pages/TopicsPage';
import DownloadPage from './pages/DownloadPage';
import TrackingPage from './pages/TrackingPage';
import GeneratorPage from './pages/GeneratorPage';
import SettingsPage from './pages/SettingsPage';
import AITasksPage from './pages/AITasksPage';
import UsersManagementPage from './pages/UsersManagementPage';
import { useSocketStore } from './stores/socketStore';
import useAuthStore from './stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  const { connect } = useSocketStore();
  const { isAuthenticated, token, fetchCurrentUser } = useAuthStore();

  useEffect(() => {
    // Подключаем WebSocket
    connect();
  }, [connect]);

  useEffect(() => {
    // Проверяем текущего пользователя при загрузке, если есть токен
    if (token && isAuthenticated) {
      fetchCurrentUser();
    }
  }, [token]); // Только при изменении токена

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#FF0000',
            borderRadius: 8,
          },
          algorithm: theme.defaultAlgorithm,
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <Routes>
              {/* Публичный маршрут для авторизации */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Защищенные маршруты */}
              <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
              <Route path="/trends" element={<ProtectedLayout><TrendsPage /></ProtectedLayout>} />
              <Route path="/topics" element={<ProtectedLayout><TopicsPage /></ProtectedLayout>} />
              <Route path="/tracking" element={<ProtectedLayout><TrackingPage /></ProtectedLayout>} />
              <Route path="/download" element={<ProtectedLayout><DownloadPage /></ProtectedLayout>} />
              <Route path="/generator" element={<ProtectedLayout><GeneratorPage /></ProtectedLayout>} />
              <Route path="/ai-tasks" element={<ProtectedLayout><AITasksPage /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
              
              {/* Админ маршруты */}
              <Route path="/users" element={<ProtectedLayout requireAdmin><UsersManagementPage /></ProtectedLayout>} />

              {/* Редирект на главную для неизвестных маршрутов */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
