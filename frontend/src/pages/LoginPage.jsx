import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Alert, Spin, Form, Input, Button, Divider } from 'antd';
import { SendOutlined, CheckCircleOutlined, ClockCircleOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import useAuthStore from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const LoginPage = () => {
  const { login, isLoading, error, isAuthenticated, requiresApproval, user } = useAuthStore();
  const navigate = useNavigate();
  const [loginForm] = Form.useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  // Одна страница без вкладок: форма логина + Telegram widget ниже

  useEffect(() => {
    // Если пользователь уже авторизован и подтвержден, перенаправляем на главную
    if (isAuthenticated && !requiresApproval) {
      navigate('/');
    }
  }, [isAuthenticated, requiresApproval, navigate]);

  const handlePasswordLogin = async (values) => {
    setLoginLoading(true);
    setLoginError(null);

    try {
      const result = await login({ login: values.login, password: values.password }, 'password');
      
      if (result.success) {
        if (result.requiresApproval) {
          // Пользователь ожидает подтверждения
          console.log('Awaiting approval');
        } else {
          // Успешная авторизация
          navigate('/');
        }
      } else {
        setLoginError(result.error || 'Неверный логин или пароль');
      }
    } catch (err) {
      setLoginError('Ошибка авторизации');
    } finally {
      setLoginLoading(false);
    }
  };

  // Встраиваем Telegram widget при монтировании страницы (контейнер находится в разметке сразу)
  useEffect(() => {
    const container = document.getElementById('telegram-login-container');
    if (!container) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'yt_zavod_auth_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-lang', 'ru');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    window.onTelegramAuth = async (tgUser) => {
      try {
        const result = await login(tgUser, 'telegram');
        if (result.success && !result.requiresApproval) {
          navigate('/');
        }
      } catch (e) {
        console.error('Telegram auth error:', e);
      }
    };

    container.appendChild(script);
    return () => {
      delete window.onTelegramAuth;
    };
  }, [login, navigate]);

  if (isAuthenticated && requiresApproval) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Card style={{ maxWidth: 500, width: '90%', textAlign: 'center' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ClockCircleOutlined style={{ fontSize: 64, color: '#faad14' }} />
            <Title level={3}>Ожидание подтверждения</Title>
            <Paragraph>
              Здравствуйте, <strong>{user?.first_name}</strong>!
            </Paragraph>
            <Paragraph>
              Ваш аккаунт зарегистрирован и ожидает подтверждения администратором. 
              Вы получите доступ к системе после проверки.
            </Paragraph>
            <Alert
              message="Проверьте статус позже"
              description="Обычно подтверждение занимает несколько минут"
              type="warning"
              showIcon
            />
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ maxWidth: 520, width: '90%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>Вход в систему</Title>
          </div>

          {loginError && (
            <Alert
              message="Ошибка"
              description={loginError}
              type="error"
              closable
              onClose={() => setLoginError(null)}
              showIcon
            />
          )}

          <Form
            form={loginForm}
            onFinish={handlePasswordLogin}
            layout="vertical"
            size="large"
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="login"
              label="Логин"
              rules={[{ required: true, message: 'Введите логин' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Логин" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>

            <Form.Item style={{ marginTop: 8 }}>
              <Button type="primary" htmlType="submit" block loading={loginLoading}>
                Войти
              </Button>
            </Form.Item>
          </Form>

          <Paragraph type="secondary" style={{ marginTop: -8 }}>
            Новые пользователи входят только через Telegram ниже.
          </Paragraph>

          <Divider plain>или</Divider>

          {error && (
            <Alert
              message="Ошибка авторизации"
              description={error}
              type="error"
              closable
              showIcon
            />
          )}

          <Text strong>Войти через Telegram</Text>

          {isLoading ? (
            <Spin size="large" />
          ) : (
            <div id="telegram-login-container" style={{ margin: '8px 0 0 0' }} />
          )}

          <Alert
            message="Первый вход"
            description="При первом входе ваш аккаунт должен быть подтвержден администратором"
            type="info"
            showIcon
          />

          <div style={{ marginTop: 20, fontSize: 12, color: '#999' }}>
            <Text type="secondary">
              🔒 Безопасная авторизация
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
