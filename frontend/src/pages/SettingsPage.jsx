import React, { useState, useEffect, useMemo } from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, message, Alert, Select, Checkbox } from 'antd';
import { SettingOutlined, SaveOutlined, KeyOutlined, LinkOutlined, GlobalOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { configService, trendsService } from '../services';
import useAuthStore from '../stores/authStore';
import videosService from '../services/videosService';

const { Title, Paragraph, Text } = Typography;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [countriesForm] = Form.useForm();
  const user = useAuthStore((s) => s.user);

  // Helpers: namespace localStorage by user id
  const nsKey = (base) => `yt_user_${user?.id || 'anon'}_${base}`;
  const readLS = (base, def = '') => {
    try { return localStorage.getItem(nsKey(base)) || def; } catch { return def; }
  };
  const writeLS = (base, val) => {
    try {
      if (val === undefined || val === null || val === '') localStorage.removeItem(nsKey(base));
      else localStorage.setItem(nsKey(base), val);
    } catch {}
  };

  const [apiKey, setApiKey] = useState(() => readLS('youtube_api_key', ''));
  const [spreadsheetId, setSpreadsheetId] = useState(() => readLS('sheets_spreadsheet_id', ''));
  const [openaiApiKey, setOpenaiApiKey] = useState(() => readLS('openai_api_key', ''));

  // Dev server shared key (only in development) – fallback helper
  const { data: serverApiKey } = useQuery({
    queryKey: ['server-api-key'],
    queryFn: configService.getApiKey,
    retry: false,
    staleTime: Infinity,
  });

  // Per-user secrets from backend storage
  const { data: userKeysResp, refetch: refetchUserKeys } = useQuery({
    queryKey: ['user-keys', user?.id],
    queryFn: configService.getUserKeys,
    enabled: !!user?.id,
  });

  const { data: countriesResp } = useQuery({
    queryKey: ['countries-all'],
    queryFn: trendsService.getCountries,
    staleTime: Infinity,
  });
  const { data: trackedResp, refetch: refetchTracked } = useQuery({
    queryKey: ['tracked-countries'],
    queryFn: configService.getTrackedCountries,
  });

  const saveTrackedMutation = useMutation({
    mutationFn: (payload) => configService.saveTrackedCountries(payload),
    onSuccess: () => {
      message.success('✅ Списки отслеживаемых стран сохранены');
      refetchTracked();
    },
    onError: (e) => message.error(e?.error || 'Не удалось сохранить настройки стран'),
  });

  // Перенос из DB (user-keys) в локальное состояние при загрузке
  useEffect(() => {
    if (userKeysResp?.data) {
      const { youtubeApiKey: k = '', spreadsheetId: s = '', openaiApiKey: o = '' } = userKeysResp.data;
      // Сохраняем в localStorage namespace текущего пользователя для оффлайн-UX
      writeLS('youtube_api_key', k || '');
      writeLS('sheets_spreadsheet_id', s || '');
      writeLS('openai_api_key', o || '');
      setApiKey(k || '');
      setSpreadsheetId(s || '');
      setOpenaiApiKey(o || '');
      form.setFieldsValue({ apiKey: k || '', spreadsheetId: s || '', openaiApiKey: o || '' });
    } else if (serverApiKey?.apiKey && !apiKey) {
      // Fallback dev shared key (only when per-user нет и локально пусто)
      const key = serverApiKey.apiKey;
      writeLS('youtube_api_key', key);
      setApiKey(key);
      form.setFieldsValue({ apiKey: key });
      message.success('✅ API ключ автоматически загружен с сервера (dev)!');
    }
  }, [userKeysResp, serverApiKey, apiKey, form]);

  // При смене пользователя (включая имперсонацию) — перечитать локальные значения
  useEffect(() => {
    const k = readLS('youtube_api_key', '');
    const s = readLS('sheets_spreadsheet_id', '');
    const o = readLS('openai_api_key', '');
    setApiKey(k);
    setSpreadsheetId(s);
    setOpenaiApiKey(o);
    form.setFieldsValue({ apiKey: k, spreadsheetId: s, openaiApiKey: o });
  }, [user?.id]);

  const saveUserKeysMutation = useMutation({
    mutationFn: (payload) => configService.saveUserKeys(payload),
    onSuccess: () => {
      message.success('✅ Ключи сохранены на сервере');
      refetchUserKeys();
    },
    onError: (e) => message.error(e?.response?.data?.error || 'Не удалось сохранить ключи'),
  });

  const handleSave = (values) => {
    const payload = {
      youtubeApiKey: values.apiKey || '',
      spreadsheetId: values.spreadsheetId || '',
      openaiApiKey: values.openaiApiKey || '',
    };
    // Локально для UX
    writeLS('youtube_api_key', payload.youtubeApiKey);
    writeLS('sheets_spreadsheet_id', payload.spreadsheetId);
    writeLS('openai_api_key', payload.openaiApiKey);
    setApiKey(payload.youtubeApiKey);
    setSpreadsheetId(payload.spreadsheetId);
    setOpenaiApiKey(payload.openaiApiKey);
    saveUserKeysMutation.mutate(payload);
  };

  const handleClear = () => {
    writeLS('youtube_api_key', '');
    writeLS('sheets_spreadsheet_id', '');
    writeLS('openai_api_key', '');
    setApiKey('');
    setSpreadsheetId('');
    setOpenaiApiKey('');
    form.resetFields();
    // Отправляем пустые строки, чтобы удалить на сервере
    saveUserKeysMutation.mutate({ youtubeApiKey: '', spreadsheetId: '', openaiApiKey: '' });
    message.info('🗑️ Ключи очищены');
  };

  const handleUpdateSheetsHeaders = async () => {
    const id = form.getFieldValue('spreadsheetId') || spreadsheetId;
    if (!id) {
      message.warning('Укажите Spreadsheet ID');
      return;
    }
    try {
      await videosService.initSheetsTemplate(id, 'Videos');
      message.success('✅ Заголовки Google Sheets обновлены под новую схему');
    } catch (e) {
      message.error(`❌ Не удалось обновить заголовки: ${e?.message || 'ошибка запроса'}`);
    }
  };

  const renderCountryOption = (country) => ({
    label: (
      <Space>
        <span style={{ fontSize: 18 }}>{country.flag}</span>
        <span>{country.name}</span>
      </Space>
    ),
    value: country.code,
  });

  // Пресеты формируем из списка стран
  const { codesAll, codesTop10, codesEurope, codesAmerica } = useMemo(() => {
    const all = countriesResp?.countries || [];
    const allCodes = all.map((c) => c.code);
    return {
      codesAll: allCodes,
      codesTop10: allCodes.slice(0, 10),
      codesEurope: all.filter(c => ['Europe/','Atlantic/'].some(p => (c.timezone||'').startsWith(p))).map(c => c.code),
      codesAmerica: all.filter(c => (c.timezone||'').startsWith('America/')).map(c => c.code),
    };
  }, [countriesResp]);

  // Подставляем сохраненные списки в форму стран
  useEffect(() => {
    if (trackedResp?.trends || trackedResp?.topics) {
      countriesForm.setFieldsValue({
        trendsCountries: trackedResp?.trends,
        topicsCountries: trackedResp?.topics,
      });
    }
  }, [trackedResp, countriesForm]);

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

          {/* Отслеживаемые страны */}
          <Card title={<Space><GlobalOutlined /> <span>Отслеживаемые страны</span></Space>}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Form layout="vertical" form={countriesForm}
                onFinish={(vals) =>
                  saveTrackedMutation.mutate({ trends: vals.trendsCountries, topics: vals.topicsCountries })
                }
                initialValues={{
                  trendsCountries: trackedResp?.trends,
                  topicsCountries: trackedResp?.topics,
                }}
              >
                <Space wrap style={{ marginBottom: 8 }}>
                  <Button size="small" onClick={() => countriesForm.setFieldsValue({ trendsCountries: codesAll, topicsCountries: codesAll })}>Все</Button>
                  <Button size="small" onClick={() => countriesForm.setFieldsValue({ trendsCountries: codesTop10, topicsCountries: codesTop10 })}>Топ‑10</Button>
                  <Button size="small" onClick={() => countriesForm.setFieldsValue({ trendsCountries: codesEurope, topicsCountries: codesEurope })}>Европа</Button>
                  <Button size="small" onClick={() => countriesForm.setFieldsValue({ trendsCountries: codesAmerica, topicsCountries: codesAmerica })}>Америка</Button>
                </Space>

                <Form.Item
                  label={<Text strong>Тренды — отслеживаемые страны</Text>}
                  name="trendsCountries"
                  rules={[{ required: true, message: 'Выберите хотя бы одну страну' }]}
                >
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Выберите страны для сбора трендов"
                    options={countriesResp?.countries?.map(renderCountryOption)}
                    optionLabelProp="label"
                    menuItemSelectedIcon={(opt) => (
                      <Checkbox checked={opt?.selected} style={{ marginRight: 8 }} />
                    )}
                  />
                </Form.Item>

                <Form.Item
                  label={<Text strong>Темы — отслеживаемые страны</Text>}
                  name="topicsCountries"
                  rules={[{ required: true, message: 'Выберите хотя бы одну страну' }]}
                >
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Выберите страны по умолчанию для поиска по темам"
                    options={countriesResp?.countries?.map(renderCountryOption)}
                    optionLabelProp="label"
                    menuItemSelectedIcon={(opt) => (
                      <Checkbox checked={opt?.selected} style={{ marginRight: 8 }} />
                    )}
                  />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={saveTrackedMutation.isPending}>
                    Сохранить списки стран
                  </Button>
                </Form.Item>
              </Form>
            </Space>
          </Card>

          <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ apiKey, spreadsheetId }}>
            <Form.Item
              label={<Text strong>YouTube API Key</Text>}
              name="apiKey"
              rules={[{ required: true, message: 'Введите API ключ' }, { min: 20, message: 'API ключ слишком короткий' }]}
              extra="Ваш API ключ хранится локально в браузере"
            >
              <Input.Password prefix={<KeyOutlined />} placeholder="AIzaSy..." size="large" />
            </Form.Item>

            <Form.Item
              label={<Text strong>Google Sheets Spreadsheet ID</Text>}
              name="spreadsheetId"
              rules={[]}
              extra="Если указать ID таблицы и настроить credentials, результаты парсинга будут автоматически сохраняться."
            >
              <Input prefix={<LinkOutlined />} placeholder="1A2B3C... (ID документа)" size="large" />
            </Form.Item>

            <Form.Item
              label={<Text strong>OpenAI API Key (для Whisper AI)</Text>}
              name="openaiApiKey"
              rules={[]}
              extra="Для автоматической транскрибации видео без субтитров. Получите ключ на platform.openai.com"
            >
              <Input.Password prefix={<KeyOutlined />} placeholder="sk-..." size="large" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" loading={saveUserKeysMutation.isPending}>Сохранить</Button>
                <Button onClick={handleClear} danger size="large">Очистить</Button>
                <Button onClick={handleUpdateSheetsHeaders} size="large">Обновить заголовки Sheets</Button>
              </Space>
            </Form.Item>
          </Form>

          {apiKey && (
            <Alert message="API ключ установлен" description={`Текущий ключ: ${apiKey.substring(0, 10)}...`} type="success" showIcon />
          )}

          {openaiApiKey && (
            <Alert 
              message="OpenAI API ключ установлен" 
              description="Whisper AI будет автоматически транскрибировать видео без субтитров" 
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
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                <LinkOutlined /> OpenAI API Keys (для Whisper)
              </a>
              <a href="https://platform.openai.com/docs/guides/speech-to-text" target="_blank" rel="noopener noreferrer">
                <LinkOutlined /> Whisper API Documentation
              </a>
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default SettingsPage;
