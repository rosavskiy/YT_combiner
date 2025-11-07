import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Alert, Spin, Form, Input, Button, Tabs } from 'antd';
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
  const [activeTab, setActiveTab] = useState('password'); // отслеживаем активную вкладку

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

  // Встраиваем Telegram widget ТОЛЬКО когда активна вкладка "telegram" и контейнер уже присутствует в DOM
  useEffect(() => {
    if (activeTab !== 'telegram') return;
    const container = document.getElementById('telegram-login-container');
    if (!container) return; // контейнер еще не смонтирован

    // Очищаем контейнер (на случай повторного открытия вкладки)
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'yt_zavod_auth_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-lang', 'ru');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)'); // callback
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    // Глобальная функция для обработки авторизации
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
  }, [activeTab, login, navigate]);

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
      <Card style={{ maxWidth: 500, width: '90%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <SendOutlined style={{ fontSize: 64, color: '#0088cc' }} />
            <Title level={2} style={{ marginTop: 16 }}>YT Zavod</Title>
            <Paragraph type="secondary">
              Войдите для доступа к системе
            </Paragraph>
          </div>

          <Tabs 
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            items={[
              {
                key: 'password',
                label: (
                  <span>
                    <LockOutlined />
                    Логин и пароль
                  </span>
                ),
                children: (
                  <>
                    {loginError && (
                      <Alert
                        message="Ошибка"
                        description={loginError}
                        type="error"
                        closable
                        onClose={() => setLoginError(null)}
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}

                    <Form
                      form={loginForm}
                      onFinish={handlePasswordLogin}
                      layout="vertical"
                      size="large"
                    >
                      <Form.Item
                        name="login"
                        rules={[{ required: true, message: 'Введите логин' }]}
                      >
                        <Input 
                          prefix={<UserOutlined />} 
                          placeholder="Логин"
                        />
                      </Form.Item>

                      <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Введите пароль' }]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="Пароль"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          block
                          loading={loginLoading}
                        >
                          Войти
                        </Button>
                      </Form.Item>
                    </Form>
                  </>
                )
              },
              {
                key: 'telegram',
                label: (
                  <span>
                    <SendOutlined />
                    Telegram
                  </span>
                ),
                children: (
                  <>
                    {error && (
                      <Alert
                        message="Ошибка авторизации"
                        description={error}
                        type="error"
                        closable
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}

                    {isLoading ? (
                      <Spin size="large" />
                    ) : (
                      <div id="telegram-login-container" style={{ margin: '20px 0' }} />
                    )}

                    <Alert
                      message="Первый вход"
                      description="При первом входе ваш аккаунт должен быть подтвержден администратором"
                      type="info"
                      showIcon
                    />
                  </>
                )
              }
            ]}
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
