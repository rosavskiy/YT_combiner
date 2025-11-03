import React, { useMemo } from 'react';
import { Card, Space, Input, Button, List, Typography, Table, Tag, App as AntdApp, Popconfirm } from 'antd';
import { EyeOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined, FileTextOutlined, LikeOutlined, CommentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import channelsService from '@/services/channelsService';
import videosService from '@/services/videosService';

const { Title, Text, Link } = Typography;

const makeColumns = (actions) => [
  {
    title: 'Канал',
    dataIndex: 'channelTitle',
    key: 'channelTitle',
    width: 240,
    render: (text, record) => (
      <Space direction="vertical" size={0}>
        <Text strong>{text}</Text>
        <Link href={`https://www.youtube.com/channel/${record.channelId}`} target="_blank">Открыть канал</Link>
      </Space>
    )
  },
  {
    title: 'Тип',
    dataIndex: 'type',
    key: 'type',
    width: 120,
    render: (type) => <Tag color={type === 'short' ? 'purple' : 'blue'}>{type === 'short' ? 'Шортс' : 'Видео'}</Tag>
  },
  {
    title: 'Название',
    dataIndex: 'title',
    key: 'title',
    width: 420,
    ellipsis: true,
    render: (text, record) => (
      <Link href={record.url} target="_blank">{text}</Link>
    )
  },
  {
    title: 'Опубликовано',
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    width: 180,
    render: (date) => new Date(date).toLocaleString()
  },
  {
    title: <><EyeOutlined /> Просмотры</>,
    dataIndex: 'views',
    key: 'views',
    width: 120,
    render: (views) => (views || 0).toLocaleString(),
    sorter: (a, b) => (a.views || 0) - (b.views || 0),
  },
  {
    title: <><LikeOutlined /> Лайки</>,
    dataIndex: 'likes',
    key: 'likes',
    width: 110,
    render: (likes) => (likes || 0).toLocaleString(),
    sorter: (a, b) => (a.likes || 0) - (b.likes || 0),
  },
  {
    title: <><CommentOutlined /> Комментарии</>,
    dataIndex: 'comments',
    key: 'comments',
    width: 130,
    render: (c) => (c || 0).toLocaleString(),
    sorter: (a, b) => (a.comments || 0) - (b.comments || 0),
  },
  actions
];

const TrackingPage = () => {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const { data: channels, isLoading: isChannelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const res = await channelsService.list();
      return res.data || [];
    }
  });

  const { data: activities, isLoading: isActivitiesLoading, refetch } = useQuery({
    queryKey: ['channels-activities'],
    queryFn: async () => {
      const res = await channelsService.activities(10);
      return res.data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (url) => channelsService.add(url),
    onSuccess: () => {
      message.success('Канал добавлен');
      queryClient.invalidateQueries(['channels']);
      refetch();
    },
    onError: (err) => {
      message.error(err?.error || 'Не удалось добавить канал');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (channelId) => channelsService.remove(channelId),
    onSuccess: () => {
      message.success('Канал удален');
      queryClient.invalidateQueries(['channels']);
      refetch();
    },
    onError: (err) => message.error(err?.error || 'Не удалось удалить канал')
  });

  const handleAdd = async (value) => {
    if (!value) return;
    addMutation.mutate(value);
  };

  const dataSource = useMemo(() => activities || [], [activities]);

  // Мутации действий с видео (скачивание и парсинг)
  const downloadMutation = useMutation({
    mutationFn: async ({ videoId, quality }) => videosService.downloadVideo(videoId, quality || 'highest'),
    onSuccess: () => message.success('✅ Видео добавлено в очередь скачивания'),
    onError: (e) => message.error(e?.message || 'Не удалось добавить в очередь')
  });

  const parseMutation = useMutation({
    mutationFn: async (videoId) => {
      const spreadsheetId = localStorage.getItem('sheets_spreadsheet_id') || undefined;
      return videosService.parseVideo(videoId, { spreadsheetId });
    },
    onSuccess: () => message.success('✅ Видео добавлено в очередь парсинга'),
    onError: (e) => message.error(e?.message || 'Не удалось запустить парсинг')
  });

  const actionsCol = {
    title: 'Действия',
    key: 'actions',
    width: 220,
    render: (_, record) => (
      <Space size="small">
        <Button
          type="primary"
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => downloadMutation.mutate({ videoId: record.videoId, quality: 'highest' })}
          loading={downloadMutation.isPending}
        >
          Скачать на сервер
        </Button>
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => parseMutation.mutate(record.videoId)}
          loading={parseMutation.isPending}
        >
          Парсить
        </Button>
      </Space>
    )
  };

  return (
    <div>
      <Space align="center" style={{ marginBottom: 16 }}>
        <EyeOutlined style={{ fontSize: 32, color: '#1890ff' }} />
        <div>
          <h2 style={{ margin: 0 }}>Отслеживание каналов</h2>
          <p style={{ margin: 0, color: '#888' }}>Добавляйте каналы и следите за последними действиями</p>
        </div>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.Search
            placeholder="Ссылка на YouTube канал (URL / @handle / channel id)"
            enterButton={<Button type="primary" icon={<PlusOutlined />} loading={addMutation.isPending}>Добавить</Button>}
            size="large"
            onSearch={handleAdd}
            allowClear
          />
        </Space.Compact>
      </Card>

      <Card title={`Каналы (${channels?.length || 0})`} style={{ marginBottom: 16 }}>
        <List
          loading={isChannelsLoading}
          dataSource={channels || []}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Popconfirm title="Удалить канал?" okText="Удалить" cancelText="Отмена" onConfirm={() => deleteMutation.mutate(item.channel_id)}>
                  <Button danger size="small" icon={<DeleteOutlined />} loading={deleteMutation.isPending}>Удалить</Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={<Link href={`https://www.youtube.com/channel/${item.channel_id}`} target="_blank">{item.title || item.channel_id}</Link>}
                description={item.url}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card
        title="Последние 10 действий"
        extra={<Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isActivitiesLoading}>Обновить</Button>}
      >
        <Table
          loading={isActivitiesLoading}
          columns={makeColumns(actionsCol)}
          dataSource={dataSource}
          rowKey={(r) => r.activityId || r.videoId}
          pagination={false}
          scroll={{ x: 1300 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default TrackingPage;
