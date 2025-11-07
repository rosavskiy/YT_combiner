import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import ProtectedRoute from './ProtectedRoute';

const { Content } = Layout;

const ProtectedLayout = ({ children, requireAdmin = false }) => {
  return (
    <ProtectedRoute requireAdmin={requireAdmin}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <Content style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProtectedLayout;
