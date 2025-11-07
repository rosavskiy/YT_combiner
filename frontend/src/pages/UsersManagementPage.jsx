import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Avatar, 
  message, 
  Popconfirm,
  Statistic,
  Row,
  Col,
  Modal,
  Select
} from 'antd';
import { 
  UserOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  TeamOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  EditOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import useAuthStore from '../stores/authStore';

const { Option } = Select;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const UsersManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('user');
  const { token, impersonate } = useAuthStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, pendingRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/pending-users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (usersRes.data.success) setUsers(usersRes.data.data);
      if (pendingRes.data.success) setPendingUsers(pendingRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (error) {
      message.error('Ошибка загрузки данных');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (userId) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/approve/${userId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        message.success('Пользователь подтвержден');
        fetchData();
      }
    } catch (error) {
      message.error('Ошибка подтверждения пользователя');
      console.error(error);
    }
  };

  const handleReject = async (userId) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/reject/${userId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        message.success('Пользователь отклонен');
        fetchData();
      }
    } catch (error) {
      message.error('Ошибка отклонения пользователя');
      console.error(error);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    try {
      const response = await axios.post(
        `${API_URL}/auth/change-role/${selectedUser.id}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        message.success('Роль изменена');
        setRoleModalVisible(false);
        setSelectedUser(null);
        fetchData();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Ошибка изменения роли');
      console.error(error);
    }
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setRoleModalVisible(true);
  };

  const pendingColumns = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar src={record.photo_url} icon={<UserOutlined />} />
          <div>
            <div><strong>{record.first_name} {record.last_name}</strong></div>
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username || 'без username'}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Telegram ID',
      dataIndex: 'telegram_id',
      key: 'telegram_id'
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString('ru-RU')
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="Подтвердить пользователя?"
            onConfirm={() => handleApprove(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button type="primary" icon={<CheckOutlined />} size="small">
              Подтвердить
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Отклонить пользователя?"
            onConfirm={() => handleReject(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button danger icon={<CloseOutlined />} size="small">
              Отклонить
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const usersColumns = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar src={record.photo_url} icon={<UserOutlined />} />
          <div>
            <div><strong>{record.first_name} {record.last_name}</strong></div>
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username || 'без username'}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? 'Администратор' : 'Пользователь'}
        </Tag>
      )
    },
    {
      title: 'Статус',
      dataIndex: 'is_approved',
      key: 'is_approved',
      render: (approved) => (
        <Tag color={approved ? 'success' : 'warning'}>
          {approved ? 'Подтвержден' : 'Ожидает'}
        </Tag>
      )
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString('ru-RU')
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => openRoleModal(record)}
          >
            Роль
          </Button>
          <Button 
            icon={<LoginOutlined />} 
            size="small"
            onClick={async () => {
              const res = await impersonate(record.id);
              if (res.success) {
                message.success(`Вы вошли как ${record.first_name || record.username || record.login || record.id}`);
              } else {
                message.error(res.error || 'Не удалось войти как пользователь');
              }
            }}
          >
            Войти как
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h1>👥 Управление пользователями</h1>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic 
                title="Всего пользователей" 
                value={stats.total} 
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="Подтверждено" 
                value={stats.approved} 
                prefix={<CheckOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="Ожидают подтверждения" 
                value={stats.pending} 
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="Администраторы" 
                value={stats.admins} 
                prefix={<SafetyOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {pendingUsers.length > 0 && (
        <Card 
          title="⏳ Ожидают подтверждения" 
          style={{ marginBottom: 24 }}
          extra={<Tag color="warning">{pendingUsers.length}</Tag>}
        >
          <Table
            columns={pendingColumns}
            dataSource={pendingUsers}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      <Card title="📋 Все пользователи">
        <Table
          columns={usersColumns}
          dataSource={users}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="Изменить роль пользователя"
        open={roleModalVisible}
        onOk={handleChangeRole}
        onCancel={() => {
          setRoleModalVisible(false);
          setSelectedUser(null);
        }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        {selectedUser && (
          <div>
            <p>
              Пользователь: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
            </p>
            <p>Выберите новую роль:</p>
            <Select 
              value={newRole} 
              onChange={setNewRole} 
              style={{ width: '100%' }}
            >
              <Option value="user">Пользователь</Option>
              <Option value="admin">Администратор</Option>
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersManagementPage;
