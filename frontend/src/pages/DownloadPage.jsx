import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Table, Space, Tag, Progress, 
  Row, Col, Statistic, Empty, Alert, Tooltip, Input, Select, Popconfirm, Steps, App as AntdApp 
} from 'antd';
import { 
  DownloadOutlined, CheckCircleOutlined, LoadingOutlined, 
  DeleteOutlined, PlayCircleOutlined, FileTextOutlined, SyncOutlined 
} from '@ant-design/icons';
import StatusTag from '@/components/StatusTag';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import videosService from '../services/videosService';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

const { Search } = Input;
const { Option } = Select;

const DownloadPage = () => {
  const { message } = AntdApp.useApp();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const nsKey = (base) => `yt_user_${user?.id || 'anon'}_${base}`;
  const readLS = (base, def = '') => {
    try { return localStorage.getItem(nsKey(base)) || def; } catch { return def; }
  };
  const [quality, setQuality] = useState('highest');
  const [inputValue, setInputValue] = useState('');
  const [parseInputValue, setParseInputValue] = useState('');

  // Получить videoId из URL параметра
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const videoId = params.get('videoId');
    if (videoId) {
      handleDownload(videoId);
    }
  }, [location]);

  // Получить очередь загрузок
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['download-queue'],
    queryFn: async () => {
      const result = await videosService.getQueue('download');
      return result.data;
    },
    refetchInterval: 3000, // Обновление каждые 3 секунды
  });

  // Получить статистику
  const { data: statsData } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const result = await videosService.getQueueStats('download');
      return result.data;
    },
    refetchInterval: 5000,
  });

  // Мутация для скачивания видео
  const downloadMutation = useMutation({
    mutationFn: ({ videoId, quality }) => videosService.downloadVideo(videoId, quality),
    onSuccess: (data) => {
      message.success('✅ Видео добавлено в очередь скачивания!');
      queryClient.invalidateQueries(['download-queue']);
      queryClient.invalidateQueries(['queue-stats']);
    },
    onError: (error) => {
      message.error(`❌ Ошибка: ${error.message || 'Не удалось начать скачивание'}`);
    }
  });

  // Мутация для парсинга
  const parseMutation = useMutation({
    mutationFn: (videoId) => {
      const spreadsheetId = readLS('sheets_spreadsheet_id') || undefined;
      return videosService.parseVideo(videoId, { spreadsheetId });
    },
    onSuccess: () => {
      message.success('✅ Видео добавлено в очередь парсинга!');
      queryClient.invalidateQueries(['parse-queue']);
      queryClient.invalidateQueries(['parse-stats']);
    },
    onError: (error) => {
      message.error(`❌ Ошибка парсинга: ${error.message}`);
    }
  });

  // Мутация для повтора
  const retryMutation = useMutation({
    mutationFn: ({ jobId, queueType }) => videosService.retryJob(jobId, queueType || 'download'),
    onSuccess: (_data, variables) => {
      message.success('✅ Задача перезапущена');
      if ((variables?.queueType || 'download') === 'parse') {
        queryClient.invalidateQueries(['parse-queue']);
        queryClient.invalidateQueries(['download-queue']);
        queryClient.invalidateQueries(['queue-stats']);
      } else {
        queryClient.invalidateQueries(['download-queue']);
        queryClient.invalidateQueries(['queue-stats']);
      }
    },
    onError: (error) => {
      message.error(`❌ Не удалось удалить: ${error.message}`);
    }
  });

  // Мутация для удаления задачи
  const deleteMutation = useMutation({
    mutationFn: ({ jobId, queueType }) => videosService.deleteJob(jobId, queueType || 'download'),
    onSuccess: (_data, variables) => {
      message.success('✅ Задача удалена');
      const qt = variables?.queueType || 'download';
      if (qt === 'parse') {
        queryClient.invalidateQueries(['parse-queue']);
        queryClient.invalidateQueries(['parse-stats']);
      } else {
        queryClient.invalidateQueries(['download-queue']);
        queryClient.invalidateQueries(['queue-stats']);
      }
    },
    onError: (error) => {
      message.error(`❌ Не удалось удалить: ${error.message}`);
    },
  });

  const extractVideoId = (value) => {
    if (!value) return '';
    if (value.includes('youtube.com') || value.includes('youtu.be')) {
      const match = value.match(/(?:v=|\/)([\w-]{11})/);
      return match ? match[1] : value;
    }
    return value;
  };

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      try {
        const res = await videosService.getSystemHealth();
        return res.data;
      } catch (e) {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const handleDownload = async (videoId) => {
    if (!videoId) {
      message.warning('Введите YouTube Video ID или URL');
      return;
    }
    const cleanVideoId = extractVideoId(videoId);
    // Возвращаем скачивание на сервер — добавляем задачу в очередь
    downloadMutation.mutate({ videoId: cleanVideoId, quality });
  };

  const handleParse = (videoId) => {
    const cleanVideoId = extractVideoId(videoId);
    if (!cleanVideoId) {
      message.warning('Введите корректный YouTube Video ID или URL');
      return;
    }
    parseMutation.mutate(cleanVideoId);
  };

  const handleRetry = (jobId, queueType = 'download') => {
    retryMutation.mutate({ jobId, queueType });
  };

  const handleDelete = (jobId, queueType = 'download') => {
    deleteMutation.mutate({ jobId, queueType });
  };

  const handleDownloadTranscript = async (videoId) => {
    try {
      const response = await videosService.downloadTranscript(videoId);
      
      // Создать blob и скачать файл
      const blob = new Blob([response], { type: 'text/plain; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoId}_transcript.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('✅ Транскрипт скачан!');
    } catch (error) {
      message.error(`❌ Ошибка скачивания: ${error.message}`);
    }
  };

  // Объединить все задачи
  const allJobs = queueData 
    ? [...queueData.active, ...queueData.waiting, ...queueData.completed.slice(0, 10), ...queueData.failed]
    : [];

  // Очередь парсинга
  const { data: parseQueue, isLoading: isParseLoading } = useQuery({
    queryKey: ['parse-queue'],
    queryFn: async () => {
      const result = await videosService.getQueue('parse');
      return result.data;
    },
    refetchInterval: 3000,
  });

  const { data: parseStats } = useQuery({
    queryKey: ['parse-stats'],
    queryFn: async () => {
      const result = await videosService.getQueueStats('parse');
      return result.data;
    },
    refetchInterval: 5000,
  });

  const parseJobs = parseQueue
    ? [...parseQueue.active, ...parseQueue.waiting, ...parseQueue.completed.slice(0, 10), ...parseQueue.failed]
    : [];

  const columns = [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} type="download" />,
    },
    {
      title: 'Создано',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: 'Видео',
      dataIndex: 'videoId',
      key: 'videoId',
      ellipsis: true,
      width: 300,
      render: (videoId) => (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1890ff' }}
        >
          {videoId}
        </a>
      ),
    },
    {
      title: 'Качество',
      dataIndex: 'quality',
      key: 'quality',
      width: 100,
      render: (quality) => <Tag>{quality || 'highest'}</Tag>,
    },
    {
      title: 'Прогресс',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress, record) => {
        const percent = typeof progress === 'object' && progress !== null ? (progress.percent || 0) : (progress || 0);
        const content = (
          <div>
            <div>Процент: {percent}%</div>
            {record?.speed && <div>Скорость: {record.speed}</div>}
            {record?.eta && <div>ETA: {record.eta}</div>}
          </div>
        );
        if (record.status === 'completed') {
          return (
            <Tooltip title={content} placement="top">
              <Progress percent={100} status="success" size="small" />
            </Tooltip>
          );
        }
        if (record.status === 'active') {
          return (
            <Tooltip title={content} placement="top">
              <Progress percent={percent} status="active" size="small" className="progress-pulse" />
            </Tooltip>
          );
        }
        return (
          <Tooltip title={content} placement="top">
            <Progress percent={percent || 0} size="small" />
          </Tooltip>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'completed' && (
            <>
              <Tooltip title="Открыть на YouTube">
                <Button
                  type="link"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  href={`https://www.youtube.com/watch?v=${record.videoId}`}
                  target="_blank"
                >
                  Открыть
                </Button>
              </Tooltip>
              <Tooltip title="Скачать файл с сервера">
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={`/api/videos/download/file?videoId=${record.videoId}`}
                >
                  Файл
                </Button>
              </Tooltip>
              <Tooltip title="Парсить субтитры и таймкоды">
                <Button
                  type="primary"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => handleParse(record.videoId)}
                  loading={parseMutation.isPending}
                >
                  Парсить
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleRetry(record.jobId, 'download')}
              loading={retryMutation.isPending}
            >
              Повторить
            </Button>
          )}
          <Popconfirm
            title="Удалить задачу?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.jobId, 'download')}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const parseColumns = [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} type="parse" />,
    },
    {
      title: 'Создано',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: 'Видео',
      dataIndex: 'videoId',
      key: 'videoId',
      ellipsis: true,
      width: 300,
      render: (videoId) => (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1890ff' }}
        >
          {videoId}
        </a>
      ),
    },
    {
      title: 'Этап',
      key: 'step',
      width: 320,
      render: (_, record) => {
        const steps = [
          { key: 'info', title: 'Инфо' },
          { key: 'chapters', title: 'Таймкоды' },
          { key: 'transcript', title: 'Транскрипт' },
          { key: 'sheets', title: 'Sheets' },
        ];
        const hasSheets = !!record.spreadsheetId;
        const items = hasSheets ? steps : steps.slice(0, 3);
        const idx = Math.max(0, items.findIndex(s => s.key === record.currentStep));
        const current = idx === -1 ? 0 : idx;
        return (
          <Steps
            size="small"
            current={record.status === 'completed' ? items.length - 1 : current}
            items={items.map(s => ({ title: s.title }))}
          />
        );
      }
    },
    {
      title: 'Прогресс',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress, record) => {
        const percent = typeof progress === 'object' && progress !== null ? (progress.percent || 0) : (progress || 0);
        const content = (
          <div>
            <div>Процент: {percent}%</div>
            {record?.currentStep && <div>Этап: {record.currentStep}</div>}
          </div>
        );
        if (record.status === 'completed') {
          return (
            <Tooltip title={content} placement="top">
              <Progress percent={100} status="success" size="small" />
            </Tooltip>
          );
        }
        if (record.status === 'active') {
          return (
            <Tooltip title={content} placement="top">
              <Progress percent={percent} status="active" size="small" className="progress-pulse" />
            </Tooltip>
          );
        }
        return (
          <Tooltip title={content} placement="top">
            <Progress percent={percent || 0} size="small" />
          </Tooltip>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'completed' && (
            <Tooltip title="Скачать полный транскрипт">
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadTranscript(record.videoId)}
              >
                Транскрипт
              </Button>
            </Tooltip>
          )}
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleRetry(record.jobId, 'parse')}
              loading={retryMutation.isPending}
            >
              Повторить
            </Button>
          )}
          <Popconfirm
            title="Удалить задачу парсинга?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.jobId, 'parse')}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <DownloadOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                <div>
                  <h2 style={{ margin: 0 }}>Скачать/Спарсить видео</h2>
                  <p style={{ margin: 0, color: '#888' }}>
                    Скачивайте и/или парсьте видео из YouTube для анализа и создания контента
                  </p>
                </div>
              </div>

              <Alert
                message="Как использовать"
                description="Введите YouTube Video ID или полную ссылку на видео, выберите качество и нажмите 'Скачать' или 'Парсить'. Видео будет добавлено в соответствующую очередь."
                type="info"
                showIcon
              />

              <Space.Compact style={{ width: '100%' }}>
                <Search
                  placeholder="YouTube Video ID или URL (например: dQw4w9WgXcQ)"
                  enterButton={
                    <Button 
                      type="primary" 
                      icon={<DownloadOutlined />}
                      loading={downloadMutation.isPending}
                    >
                      Скачать
                    </Button>
                  }
                  size="large"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onSearch={handleDownload}
                  disabled={downloadMutation.isPending}
                />
                <Select
                  value={quality}
                  onChange={setQuality}
                  style={{ width: 150 }}
                  size="large"
                >
                  <Option value="highest">Макс качество</Option>
                  <Option value="1080">1080p</Option>
                  <Option value="720">720p</Option>
                  <Option value="480">480p</Option>
                  <Option value="360">360p</Option>
                </Select>
              </Space.Compact>

              <Space.Compact style={{ width: '100%' }}>
                <Search
                  placeholder="Парсить без скачивания: Video ID или URL"
                  enterButton={
                    <Button 
                      icon={<FileTextOutlined />}
                      loading={parseMutation.isPending}
                    >
                      Парсить
                    </Button>
                  }
                  size="large"
                  value={parseInputValue}
                  onChange={(e) => setParseInputValue(e.target.value)}
                  onSearch={handleParse}
                  disabled={parseMutation.isPending}
                />
              </Space.Compact>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Всего скачано"
              value={statsData?.completed || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="В процессе"
              value={statsData?.active || 0}
              prefix={<SyncOutlined spin={(statsData?.active || 0) > 0} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="В очереди"
              value={statsData?.waiting || 0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="📥 Очередь скачивания">
        {isLoading ? (
          <Empty description="Загрузка..." />
        ) : allJobs && allJobs.length > 0 ? (
          <Table
            columns={columns}
            dataSource={allJobs}
            rowKey="jobId"
            pagination={{
              pageSize: 20,
              showTotal: (total) => `Всего: ${total} задач`,
            }}
            scroll={{ x: 1200 }}
            size="middle"
          />
        ) : (
          <Empty
            description="Нет задач. Начните скачивание, введя YouTube URL выше."
            style={{ padding: '60px 0' }}
          />
        )}
      </Card>

      <div style={{ height: 16 }} />

      <Card title="🧾 Очередь парсинга">
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic
              title="Готово"
              value={parseStats?.completed || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="В процессе"
              value={parseStats?.active || 0}
              prefix={<SyncOutlined spin={(parseStats?.active || 0) > 0} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="В очереди"
              value={parseStats?.waiting || 0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>

        {isParseLoading ? (
          <Empty description="Загрузка..." />
        ) : parseJobs && parseJobs.length > 0 ? (
          <Table
            columns={parseColumns}
            dataSource={parseJobs}
            rowKey="jobId"
            pagination={{ pageSize: 20, showTotal: (t) => `Всего: ${t} задач` }}
            scroll={{ x: 1200 }}
            size="middle"
          />
        ) : (
          <Empty description="Нет задач парсинга." style={{ padding: '60px 0' }} />
        )}
      </Card>
    </div>
  );
};

export default DownloadPage;
