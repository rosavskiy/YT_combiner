import React from 'react';
import { Card, Typography, Table, Button, Space, Alert, App as AntdApp, Modal, Input, Select, Tag } from 'antd';
import { VideoCameraOutlined, ReloadOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { generatorService } from '@/services';
import useAuthStore from '@/stores/authStore';

const { Title } = Typography;

const GeneratorPage = () => {
  const { message } = AntdApp.useApp();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  
  // Helpers: namespace localStorage by user id
  const nsKey = (base) => `yt_user_${user?.id || 'anon'}_${base}`;
  const readLS = (base, def = '') => {
    try { return localStorage.getItem(nsKey(base)) || def; } catch { return def; }
  };
  
  const [spreadsheetId, setSpreadsheetId] = React.useState(() => readLS('sheets_spreadsheet_id', ''));

  // Генерируем имя листа по пользователю (как в backend)
  const generateSheetName = React.useCallback(() => {
    if (!user) return 'Videos';
    
    const pieces = [];
    if (user.first_name) pieces.push(String(user.first_name));
    if (user.last_name) pieces.push(String(user.last_name));
    let base = pieces.join(' ').trim();
    if (!base && user.username) base = String(user.username);
    if (!base && user.login) base = String(user.login);
    if (!base && user.telegram_id) base = `tg-${user.telegram_id}`;
    
    const suffix = user.id || user.telegram_id || '';
    const title = base ? `${base}_${suffix}` : `User_${suffix}`;
    
    return title || 'Videos';
  }, [user]);

  const sheetName = React.useMemo(() => generateSheetName(), [generateSheetName]);

  // Обновляем spreadsheetId при смене пользователя
  React.useEffect(() => {
    const id = readLS('sheets_spreadsheet_id', '');
    setSpreadsheetId(id);
  }, [user?.id]);

  const queryKey = ['sheets-rows', { spreadsheetId, sheetName, page, pageSize }];
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey,
    enabled: !!spreadsheetId,
    queryFn: async () => {
      const res = await generatorService.getSheetRows({ spreadsheetId, sheet: sheetName, page, pageSize });
      return res;
    }
  });

  const rows = data?.rows || [];
  const headers = data?.headers || [];
  const total = data?.total || 0;
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([]);
  const [promptModalOpen, setPromptModalOpen] = React.useState(false);
  const [promptText, setPromptText] = React.useState('');
  const [provider, setProvider] = React.useState('stub');
  const [aiJob, setAiJob] = React.useState(null);

  const columns = React.useMemo(() => {
    const base = headers.map((h) => ({
      title: h,
      dataIndex: h,
      key: h,
      ellipsis: true,
      width: 200,
      render: (val) => {
        const v = val ?? '';
        if (/^https?:\/\//i.test(String(v))) {
          return <a href={String(v)} target="_blank" rel="noreferrer">{String(v)}</a>;
        }
        return String(v);
      }
    }));
    return base.length ? base : [{ title: 'Данных нет', dataIndex: 'empty', key: 'empty' }];
  }, [headers]);

  const onRefresh = () => {
    if (!spreadsheetId) {
      message.warning('Укажите Spreadsheet ID в настройках');
      return;
    }
    refetch();
  };

  const buildPromptFromRow = (row) => {
    const title = row['Название'] || row['Title'] || row['title'] || '';
    const desc = row['Описание'] || row['Description'] || '';
    const tags = row['Теги/Категории'] || row['Tags'] || '';
    const duration = row['Длительность (ЧЧ:ММ:СС)'] || row['Duration'] || '';
    return `Создай короткое видео на основе темы: "${title}".
Описание/подсказки: ${desc || 'нет'}.
Теги: ${tags || 'нет'}.
Длительность: ${duration || '00:30:00'} (ориентир). Стиль: новостной, динамичный, с крупными заголовками. Формат: 16:9, 1080p.`;
  };

  const onCreatePrompt = () => {
    if (!selectedRowKeys.length) {
      message.warning('Выберите хотя бы одну строку');
      return;
    }
    const first = rows[selectedRowKeys[0]];
    const p = buildPromptFromRow(first);
    setPromptText(p);
    setPromptModalOpen(true);
  };

  const onStartAIGeneration = async () => {
    try {
      const currentSpreadsheetId = readLS('sheets_spreadsheet_id', '');
      const currentSheetName = data?.sheet || sheetName;
      const selectedIdx = selectedRowKeys?.[0] ?? 0; // индекс в пределах текущей страницы
      const absoluteRowIndex = 2 + (page - 1) * pageSize + selectedIdx; // 1-based в таблице (учитываем заголовок)
      const res = await generatorService.aiGenerate({
        prompt: promptText,
        options: { provider, duration: 8, aspect: '1280x720' },
        spreadsheetId: currentSpreadsheetId,
        sheet: currentSheetName,
        rowIndex: absoluteRowIndex,
      });
      setAiJob(res);
      message.success('Задача генерации отправлена');
      setPromptModalOpen(false);
    } catch (e) {
      message.error(String(e?.error || e?.message || 'Ошибка запуска'));
    }
  };

  const pollingRef = React.useRef(null);
  React.useEffect(() => {
    if (!aiJob?.jobId) return;
    pollingRef.current && clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const s = await generatorService.aiStatus(aiJob.jobId);
        if (s?.data?.status === 'completed') {
          clearInterval(pollingRef.current);
          setAiJob(s.data);
          message.success('Видео готово!');
        }
      } catch {}
    }, 1500);
    return () => pollingRef.current && clearInterval(pollingRef.current);
  }, [aiJob?.jobId]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <VideoCameraOutlined style={{ fontSize: 28, color: '#722ed1' }} />
            <Title level={3} style={{ margin: 0 }}>Генератор — данные из Google Sheets</Title>
          </Space>
          <Space>
            <Button onClick={onCreatePrompt} icon={<ThunderboltOutlined />}>Сформировать ТЗ</Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh} loading={isFetching}>
              Обновить
            </Button>
          </Space>
        </Space>
      </Card>

      {!spreadsheetId && (
        <Alert
          type="warning"
          showIcon
          message="Не указан Spreadsheet ID"
          description="Укажите ID таблицы в настройках (ключ sheets_spreadsheet_id). После этого вернитесь сюда и нажмите 'Обновить'."
          style={{ marginBottom: 16 }}
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить данные из Google Sheets"
          description={String(error?.error || error?.message || 'Ошибка запроса')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card extra={aiJob?.jobId && (
        <Space>
          <Tag color={aiJob?.data?.status === 'completed' ? 'green' : 'blue'}>
            AI: {aiJob?.data?.status || aiJob?.status}
          </Tag>
          {aiJob?.data?.status === 'completed' && (
            <Button type="primary" icon={<PlayCircleOutlined />} href={generatorService.aiDownloadUrl(aiJob.data.jobId || aiJob.jobId)}>
              Скачать видео
            </Button>
          )}
        </Space>
      )}>
        <Table
          rowKey={(_, idx) => idx}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `Всего: ${t}`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: Math.max(1000, headers.length * 200) }}
          size="middle"
        />
      </Card>

      <Modal
        title={<Space><ThunderboltOutlined /> <span>Сформировать промпт</span></Space>}
        open={promptModalOpen}
        onCancel={() => setPromptModalOpen(false)}
        onOk={onStartAIGeneration}
        okText="Сгенерировать видео"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={provider} onChange={setProvider} style={{ width: 220 }}
            options={[{ label: 'Stub/ffmpeg (локально)', value: 'stub' }]} />
          <Input.TextArea rows={8} value={promptText} onChange={(e) => setPromptText(e.target.value)} />
        </Space>
      </Modal>
    </div>
  );
};

export default GeneratorPage;
