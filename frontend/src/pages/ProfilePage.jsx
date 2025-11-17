import React from 'react';
import { Card, Avatar, Descriptions, Tag, Space, Typography, Divider, Alert } from 'antd';
import { UserOutlined, MailOutlined, CalendarOutlined, KeyOutlined, IdcardOutlined } from '@ant-design/icons';
import useAuthStore from '../stores/authStore';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

const { Title, Text } = Typography;

dayjs.locale('ru');

const ProfilePage = () => {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <Alert
        message="Нет данных пользователя"
        description="Информация о пользователе недоступна"
        type="warning"
        showIcon
      />
    );
  }

  const getRoleLabel = (role) => {
    return role === 'admin' ? 'Администратор' : 'Пользователь';
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'red' : 'blue';
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>
        <UserOutlined /> Профиль пользователя
      </Title>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Аватар и основная информация */}
          <Space align="start" size="large">
            <Avatar 
              size={120} 
              src={user.photo_url}
              icon={<UserOutlined />}
              style={{ border: '4px solid #f0f0f0' }}
            />
            <div>
              <Title level={3} style={{ marginBottom: 8 }}>
                {user.first_name} {user.last_name || ''}
              </Title>
              <Space>
                <Tag color={getRoleColor(user.role)} icon={<IdcardOutlined />}>
                  {getRoleLabel(user.role)}
                </Tag>
                {user.telegram_id && (
                  <Tag color="blue" icon={<MailOutlined />}>
                    Telegram подключен
                  </Tag>
                )}
              </Space>
            </div>
          </Space>

          <Divider />

          {/* Детальная информация */}
          <Descriptions title="Информация об аккаунте" bordered column={1}>
            <Descriptions.Item label={<><UserOutlined /> Имя</>}>
              {user.first_name}
            </Descriptions.Item>
            
            {user.last_name && (
              <Descriptions.Item label="Фамилия">
                {user.last_name}
              </Descriptions.Item>
            )}

            {user.username && (
              <Descriptions.Item label={<><MailOutlined /> Username</>}>
                @{user.username}
              </Descriptions.Item>
            )}

            <Descriptions.Item label="ID пользователя">
              {user.id}
            </Descriptions.Item>

            {user.telegram_id && (
              <Descriptions.Item label="Telegram ID">
                {user.telegram_id}
              </Descriptions.Item>
            )}

            <Descriptions.Item label={<><IdcardOutlined /> Роль</>}>
              <Tag color={getRoleColor(user.role)}>
                {getRoleLabel(user.role)}
              </Tag>
            </Descriptions.Item>

            {user.created_at && (
              <Descriptions.Item label={<><CalendarOutlined /> Дата регистрации</>}>
                {dayjs(user.created_at).format('DD MMMM YYYY, HH:mm')}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider />

          {/* Информация об API ключах */}
          <div>
            <Title level={4}>
              <KeyOutlined /> API ключи и настройки
            </Title>
            <Text type="secondary">
              Для управления API ключами (YouTube API, Google Sheets, OpenAI) перейдите в раздел{' '}
              <a href="/settings">Настройки</a>.
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ProfilePage;
