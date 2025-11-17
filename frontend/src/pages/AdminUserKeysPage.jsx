import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Table, Button, Space, Modal, Form, Input, Tag, Typography, message, Tooltip } from 'antd';
import { configService } from '../services';
import useAuthStore from '../stores/authStore';
import { KeyOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const AdminUserKeysPage = () => {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const usersQuery = useQuery({
    queryKey: ['admin-user-keys-list'],
    queryFn: configService.adminListUserKeys,
    enabled: isAdmin,
  });

  const openEdit = async (record) => {
    try {
      const resp = await configService.adminGetUserKeys(record.id);
      const { youtubeApiKey = '', spreadsheetId = '', openaiApiKey = '' } = resp.data.data || {};
      form.setFieldsValue({ youtubeApiKey, spreadsheetId, openaiApiKey });
      setEditingUser(record);
      setModalOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить ключи пользователя');
    }
  };

  const saveMutation = useMutation({
    mutationFn: ({ userId, payload }) => configService.adminSaveUserKeys(userId, payload),
    onSuccess: () => {
      message.success('✅ Ключи обновлены');
      usersQuery.refetch();
      setModalOpen(false);
      setEditingUser(null);
    },
    onError: (e) => message.error(e?.response?.data?.error || 'Ошибка сохранения'),
  });

  const handleSave = () => {
    form.validateFields().then(values => {
      saveMutation.mutate({ userId: editingUser.id, payload: values });
    });
  };

  const handleClear = () => {
    saveMutation.mutate({ userId: editingUser.id, payload: { youtubeApiKey: '', spreadsheetId: '', openaiApiKey: '' } });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Логин', dataIndex: 'login' },
    { title: 'Имя', dataIndex: 'first_name', render: (_, r) => r.first_name || r.username || '-' },
    { title: 'Фамилия', dataIndex: 'last_name', render: (v) => v || '-' },
    { title: 'Роль', dataIndex: 'role', render: (role) => <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag> },
    {
      title: 'YouTube API',
      dataIndex: 'hasYoutubeKey',
      render: (v) => v ? <Tag color="green">Есть</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Sheets ID',
      dataIndex: 'hasSpreadsheetId',
      render: (v) => v ? <Tag color="green">Есть</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'OpenAI API',
      dataIndex: 'hasOpenaiKey',
      render: (v) => v ? <Tag color="green">Есть</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Редактировать ключи">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Space align="center">
          <KeyOutlined style={{ fontSize: 28 }} />
          <Title level={2} style={{ margin: 0 }}>Персональные ключи пользователей</Title>
        </Space>
        <Text type="secondary">Админ может установить или очистить YouTube API Key, Spreadsheet ID и OpenAI API Key для любого пользователя. Очистка удаляет сохранённые значения из серверной БД.</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => usersQuery.refetch()} loading={usersQuery.isFetching}>Обновить</Button>
        </Space>
        <Table
          rowKey="id"
          loading={usersQuery.isLoading}
          dataSource={usersQuery.data?.data || []}
          columns={columns}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Space>

      <Modal
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUser(null); }}
        title={editingUser ? `Редактирование ключей: ${editingUser.login}` : 'Редактирование'}
        okText="Сохранить"
        onOk={handleSave}
        confirmLoading={saveMutation.isPending}
        footer={[
          <Button key="clear" danger icon={<DeleteOutlined />} onClick={handleClear} disabled={!editingUser}>Очистить</Button>,
          <Button key="cancel" onClick={() => { setModalOpen(false); setEditingUser(null); }}>Отмена</Button>,
          <Button key="ok" type="primary" onClick={handleSave} loading={saveMutation.isPending}>Сохранить</Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="YouTube API Key" name="youtubeApiKey" rules={[{ validator(_, value) { if (value && value.length < 20) return Promise.reject('Слишком короткий ключ'); return Promise.resolve(); } }]}>
            <Input placeholder="AIzaSy..." autoComplete="off" allowClear />
          </Form.Item>
          <Form.Item label="Google Sheets Spreadsheet ID" name="spreadsheetId" rules={[{ validator(_, value) { if (value && value.length < 10) return Promise.reject('ID слишком короткий'); return Promise.resolve(); } }]}>
            <Input placeholder="1AbCDe..." autoComplete="off" allowClear />
          </Form.Item>
          <Form.Item label="OpenAI API Key (Whisper AI)" name="openaiApiKey" rules={[{ validator(_, value) { if (value && value.length < 20) return Promise.reject('Слишком короткий ключ'); return Promise.resolve(); } }]}>
            <Input.Password placeholder="sk-..." autoComplete="off" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUserKeysPage;