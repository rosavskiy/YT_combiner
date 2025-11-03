import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, Layout, theme, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TrendsPage from './pages/TrendsPage';
import TopicsPage from './pages/TopicsPage';
import DownloadPage from './pages/DownloadPage';
import TrackingPage from './pages/TrackingPage';
import GeneratorPage from './pages/GeneratorPage';
import SettingsPage from './pages/SettingsPage';
import { useSocketStore } from './stores/socketStore';

const { Content } = Layout;

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

  useEffect(() => {
    connect();
    
    return () => {
      // Cleanup on unmount
    };
  }, [connect]);

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
            <Layout style={{ minHeight: '100vh' }}>
              <Sidebar />
              <Layout>
                <Content style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/trends" element={<TrendsPage />} />
                    <Route path="/topics" element={<TopicsPage />} />
                    <Route path="/tracking" element={<TrackingPage />} />
                    <Route path="/download" element={<DownloadPage />} />
                    <Route path="/generator" element={<GeneratorPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Content>
              </Layout>
            </Layout>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
