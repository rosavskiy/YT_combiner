import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Tag, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  GlobalOutlined,
  FireOutlined,
  DownloadOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  YoutubeOutlined,
  EyeOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  ClockCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { KeyOutlined } from '@ant-design/icons';
import useAuthStore from '../stores/authStore';

const { Sider } = Layout;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, impersonating, revertImpersonation } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профиль',
    },
    ...(impersonating ? [{
      key: 'revert',
      icon: <LogoutOutlined />,
      label: 'Вернуться к администратору',
      onClick: () => revertImpersonation()
    }] : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выход',
      danger: true,
      onClick: handleLogout
    }
  ];

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
    },
    {
      key: '/employee',
      icon: <ClockCircleOutlined />,
      label: 'Рабочее время',
    },
    {
      key: '/trends',
      icon: <GlobalOutlined />,
      label: 'Тренды',
    },
    {
      key: '/topics',
      icon: <FireOutlined />,
      label: 'Темы',
    },
    {
      key: '/tracking',
      icon: <EyeOutlined />,
      label: 'Отслеживание',
    },
    {
      key: '/download',
      icon: <DownloadOutlined />,
      label: 'Скачать/Спарсить',
    },
    {
      key: '/generator',
      icon: <VideoCameraOutlined />,
      label: 'Генератор',
    },
    {
      key: '/ai-tasks',
      icon: <VideoCameraOutlined />,
      label: 'AI задачи',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

  // Добавляем пункт "Пользователи" для администраторов
  if (isAdmin()) {
    menuItems.push({
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Пользователи',
    });
    menuItems.push({
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Отчеты',
    });
    menuItems.push({
      key: '/admin/user-keys',
      icon: <KeyOutlined />,
      label: 'Ключи пользователей',
    });
  }

  return (
    <Sider
      breakpoint="lg"
      collapsedWidth="0"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div style={{ 
        height: 64, 
        margin: 16, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <YoutubeOutlined style={{ fontSize: 32, color: '#FF0000' }} />
        <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 'bold' }}>
          YT Zavod
        </span>
      </div>
      
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />

      {/* Информация о пользователе внизу */}
      {user && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <Dropdown 
            menu={{ items: userMenuItems }}
            placement="topLeft"
            trigger={['click']}
          >
            <Space style={{ cursor: 'pointer', width: '100%' }}>
              <Avatar 
                src={user.photo_url} 
                icon={<UserOutlined />}
                size="small"
              />
              <div style={{ 
                color: 'white', 
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.first_name}
              </div>
              {impersonating && <Tag color="gold" style={{ marginInlineStart: 'auto' }}>Имперсонация</Tag>}
            </Space>
          </Dropdown>
        </div>
      )}
    </Sider>
  );
};

export default Sidebar;
