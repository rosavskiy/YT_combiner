import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, message, Alert } from 'antd';
import { SettingOutlined, SaveOutlined, KeyOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { configService } from '../services';

const { Title, Paragraph, Text } = Typography;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('youtube_api_key') || '';
  });

  // Загрузка API ключа с сервера
  const { data: serverApiKey } = useQuery({
    queryKey: ['server-api-key'],
    queryFn: configService.getApiKey,
    retry: false,
    staleTime: Infinity,
  });

  // Автоматически сохраняем ключ с сервера при первой загрузке
  useEffect(() => {
    if (serverApiKey?.apiKey && !apiKey) {
      const key = serverApiKey.apiKey;
      localStorage.setItem('youtube_api_key', key);
      setApiKey(key);
      form.setFieldsValue({ apiKey: key });
      message.success('✅ API ключ автоматически загружен с сервера!');
    }
  }, [serverApiKey, apiKey, form]);

  const handleSave = (values) => {
    localStorage.setItem('youtube_api_key', values.apiKey);
    setApiKey(values.apiKey);
    message.success('✅ Настройки сохранены!');
  };

  const handleClear = () => {
    localStorage.removeItem('youtube_api_key');
    setApiKey('');
    form.resetFields();
    message.info('🗑️ API ключ удален');
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space>
            <SettingOutlined style={{ fontSize: 32 }} />
            <Title level={2} style={{ margin: 0 }}>Настройки</Title>
          </Space>

          <Alert
            message="YouTube Data API v3"
            description={
              <div>
                <Paragraph>
                  {serverApiKey?.apiKey ? (
                    <span>✅ API ключ автоматически загружен с сервера!</span>
                  ) : (
                    <span>Для работы приложения необходим API ключ от Google Cloud Console.</span>
                  )}
                </Paragraph>
                <Paragraph>
                  <strong>Как получить API ключ:</strong>
                </Paragraph>
                <ol style={{ paddingLeft: 20 }}>
                  <li>Перейдите в <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                  <li>Создайте новый проект или выберите существующий</li>
                  <li>Перейдите в "APIs & Services" → "Library"</li>
                  <li>Найдите и включите "YouTube Data API v3"</li>
                  <li>Перейдите в "Credentials" и создайте "API Key"</li>
                  <li>Скопируйте ключ и вставьте ниже</li>
                </ol>
              </div>
            }
            type="info"
            showIcon
            icon={<KeyOutlined />}
          />

          <Divider />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{ apiKey }}
          >
            <Form.Item
              label={<Text strong>YouTube API Key</Text>}
              name="apiKey"
              rules={[
                { required: true, message: 'Введите API ключ' },
                { min: 20, message: 'API ключ слишком короткий' }
              ]}
              extra="Ваш API ключ хранится локально в браузере"
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="AIzaSy..."
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  size="large"
                >
                  Сохранить
                </Button>
                <Button 
                  onClick={handleClear}
                  danger
                  size="large"
                >
                  Очистить
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {apiKey && (
            <Alert
              message="API ключ установлен"
              description={`Текущий ключ: ${apiKey.substring(0, 10)}...`}
              type="success"
              showIcon
            />
          )}

          <Divider />

          <Card size="small" title="📚 Полезные ссылки">
            <Space direction="vertical" style={{ width: '100%' }}>
              <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
                <LinkOutlined /> Google Cloud Console
              </a>
              <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer">
                <LinkOutlined /> YouTube Data API Documentation
              </a>
              <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" rel="noopener noreferrer">
                <LinkOutlined /> Getting Started Guide
              </a>
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default SettingsPage;
