import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  GlobalOutlined,
  FireOutlined,
  DownloadOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  YoutubeOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
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
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

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
    </Sider>
  );
};

export default Sidebar;
