import React from 'react';
import { Card, Table, Space, Input, Select, Button, Tag, Row, Col, App as AntdApp, Tooltip } from 'antd';
import { ThunderboltOutlined, ReloadOutlined, DownloadOutlined, RedoOutlined } from '@ant-design/icons';
import { generatorService } from '@/services';

const statusOptions = [
  { value: '', label: 'Все' },
  { value: 'pending', label: 'В очереди' },
  { value: 'active', label: 'В процессе' },
  { value: 'completed', label: 'Готово' },
  { value: 'failed', label: 'Ошибка' },
];

const providerOptions = [
  { value: '', label: 'Все' },
  { value: 'stub', label: 'Stub/ffmpeg' },
];

const AITasksPage = () => {
  const { message } = AntdApp.useApp();
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState({ data: [], page: 1, limit: 20 });

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const resp = await generatorService.aiTasks({ q, status, provider, limit, page });
      setData(resp);
    } catch (e) {
      message.error(String(e?.error || e?.message || 'Ошибка загрузки'));
    } finally {
      setLoading(false);
    }
  }, [q, status, provider, page, limit, message]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const onRetry = async (jobId) => {
    try {
      await generatorService.aiRetry(jobId);
      message.success('Задача повторена');
      fetchList();
    } catch (e) {
      message.error(String(e?.error || e?.message || 'Ошибка повтора'));
    }
  };

  const columns = [
    {
      title: 'Статус', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => (
        <Tag color={s==='completed'?'green':s==='failed'?'red':s==='active'?'blue':'default'}>{s||'-'}</Tag>
      )
    },
    { title: 'Провайдер', dataIndex: 'provider', key: 'provider', width: 120 },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      key: 'prompt',
      // Перенос строк и длинных слов, сохраняем перевод строк
      render: (text) => (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 520 }}>{text}</div>
      ),
    },
    { title: 'Создано', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v)=> v ? new Date(v).toLocaleString() : '-' },
    { title: 'Завершено', dataIndex: 'finished_at', key: 'finished_at', width: 170, render: (v)=> v ? new Date(v).toLocaleString() : '-' },
    {
      title: 'Действия', key: 'actions', width: 200,
      render: (_, rec) => (
        <Space wrap>
          <Tooltip title="Обновить список">
            <Button icon={<ReloadOutlined />} onClick={fetchList} size="small" type="default">Обновить</Button>
          </Tooltip>
          <Tooltip title="Повторить задачу">
            <Button icon={<RedoOutlined />} onClick={() => onRetry(rec.job_id)} size="small">Повторить</Button>
          </Tooltip>
          {rec.result_path && (
            <Tooltip title="Скачать результат">
              <Button icon={<DownloadOutlined />} size="small" href={`/api/generator/ai/download/${rec.job_id}`}>Скачать</Button>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8} lg={10}>
            <Space>
              <ThunderboltOutlined style={{ fontSize: 28, color: '#722ed1' }} />
              <span style={{ fontSize: 20, fontWeight: 600 }}>AI задачи</span>
            </Space>
          </Col>
          <Col xs={24} md={16} lg={14}>
            <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Input placeholder="Поиск по prompt" value={q} onChange={(e)=> setQ(e.target.value)} style={{ width: 260, maxWidth: '100%' }} />
              <Select value={status} onChange={setStatus} options={statusOptions} style={{ width: 160 }} />
              <Select value={provider} onChange={setProvider} options={providerOptions} style={{ width: 180 }} />
              <Button type="primary" icon={<ReloadOutlined />} onClick={fetchList}>Обновить</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey={(r)=> r.job_id}
          columns={columns}
          dataSource={data?.data || []}
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            onChange: (p, ps) => { setPage(p); setLimit(ps); },
          }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default AITasksPage;
