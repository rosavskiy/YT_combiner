import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Progress, Space, Tag, Statistic, Row, Col, message, Select, Empty } from 'antd';
import { GlobalOutlined, ReloadOutlined, EyeOutlined, LikeOutlined, CommentOutlined, YoutubeOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trendsService } from '../services';
import { useSocketStore } from '../stores/socketStore';

const TrendsPage = () => {
  const [progress, setProgress] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [localTrends, setLocalTrends] = useState(null);
  const { socket } = useSocketStore();

  // Подписка на прогресс через WebSocket
  useEffect(() => {
    if (socket) {
      socket.on('trends-progress', (data) => {
        setProgress(data.percentage);
        
        if (data.success) {
          message.success(`✅ ${data.region}: ${data.percentage}%`);
        } else {
          message.error(`❌ ${data.region}: ${data.error}`);
        }
      });

      return () => {
        socket.off('trends-progress');
      };
    }
  }, [socket]);

  // Запрос стран
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: trendsService.getCountries,
  });

  // Запрос последних трендов
  const { data: trendsData, refetch, isLoading } = useQuery({
    queryKey: ['latest-trends'],
    queryFn: trendsService.getLatestTrends,
  });

  // Мутация для получения новых трендов
  const fetchTrendsMutation = useMutation({
    mutationFn: (apiKey) => trendsService.fetchAllTrends(apiKey),
    onSuccess: (data) => {
      message.success('🎉 Тренды успешно обновлены!');
      // Сохраняем данные локально с датой
      setLocalTrends({
        ...data,
        fetchedAt: new Date().toISOString()
      });
      refetch();
      setProgress(0);
    },
    onError: (error) => {
      message.error(`❌ Ошибка: ${error.error || 'Не удалось получить тренды'}`);
      setProgress(0);
    }
  });

  const handleFetchTrends = () => {
    let apiKey = localStorage.getItem('youtube_api_key');
    
    // Если ключа нет, используем дефолтный из .env
    if (!apiKey) {
      apiKey = 'AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw';
      localStorage.setItem('youtube_api_key', apiKey);
      message.info('💡 Используется API ключ из конфигурации');
    }
    
    setProgress(1);
    fetchTrendsMutation.mutate(apiKey);
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Страна',
      dataIndex: 'region',
      key: 'region',
      width: 100,
      fixed: 'left',
      render: (region) => {
        const country = countriesData?.countries?.find(c => c.code === region);
        return (
          <Space>
            <span style={{ fontSize: 20 }}>{country?.flag}</span>
            <Tag color="blue">{region}</Tag>
          </Space>
        );
      }
    },
    {
      title: 'Видео',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 300,
      render: (title, record) => (
        <a 
          href={`https://www.youtube.com/watch?v=${record.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: '#1890ff',
          }}
        >
          <YoutubeOutlined style={{ color: '#FF0000', fontSize: 16 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
        </a>
      ),
    },
    {
      title: 'Канал',
      dataIndex: 'channel',
      key: 'channel',
      width: 150,
      ellipsis: true,
      render: (channel, record) => (
        <a
          href={`https://www.youtube.com/channel/${record.channelId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#595959' }}
        >
          {channel}
        </a>
      ),
    },
    {
      title: <><EyeOutlined /> Просмотры</>,
      dataIndex: 'views',
      key: 'views',
      width: 120,
      render: (views) => views?.toLocaleString() || '0',
      sorter: (a, b) => a.views - b.views,
    },
    {
      title: <><LikeOutlined /> Лайки</>,
      dataIndex: 'likes',
      key: 'likes',
      width: 100,
      render: (likes) => likes?.toLocaleString() || '0',
      sorter: (a, b) => a.likes - b.likes,
    },
    {
      title: <><CommentOutlined /> Комментарии</>,
      dataIndex: 'comments',
      key: 'comments',
      width: 120,
      render: (comments) => comments?.toLocaleString() || '0',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={`https://www.youtube.com/watch?v=${record.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть
          </Button>
        </Space>
      ),
    },
  ];

  // Преобразуем данные для таблицы
  const tableData = React.useMemo(() => {
    // Используем локальные данные, если они есть, иначе данные из БД
    const sourceData = localTrends?.data || trendsData?.data?.data;
    
    if (!sourceData) return [];
    
    const allVideos = [];
    
    Object.entries(sourceData).forEach(([region, videos]) => {
      if (Array.isArray(videos)) {
        const filteredVideos = selectedCountry === 'all' 
          ? videos.slice(0, 10)
          : region === selectedCountry 
            ? videos 
            : [];
        
        filteredVideos.forEach(video => {
          allVideos.push({ 
            ...video, 
            region, 
            key: `${video.videoId}-${region}` 
          });
        });
      }
    });
    
    return allVideos;
  }, [localTrends, trendsData, selectedCountry]);

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Space>
                <GlobalOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <h2 style={{ margin: 0 }}>YouTube Тренды (19 стран)</h2>
              </Space>
              <Space>
                <Select
                  style={{ width: 200 }}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  placeholder="Выберите страну"
                >
                  <Select.Option value="all">Все страны (топ 10)</Select.Option>
                  {countriesData?.countries?.map(country => (
                    <Select.Option key={country.code} value={country.code}>
                      {country.flag} {country.name}
                    </Select.Option>
                  ))}
                </Select>
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={handleFetchTrends}
                  loading={fetchTrendsMutation.isPending}
                  disabled={progress > 0 && progress < 100}
                >
                  Обновить тренды
                </Button>
              </Space>
            </Space>
            
            {progress > 0 && progress < 100 && (
              <Progress 
                percent={progress} 
                status="active" 
                style={{ marginTop: 16 }}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card>
            <Statistic 
              title="Всего стран" 
              value={countriesData?.count || 19}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic 
              title="Всего видео" 
              value={localTrends?.totalVideos || trendsData?.data?.totalVideos || 0}
              valueStyle={{ color: '#FF0000' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic 
              title="В таблице" 
              value={tableData.length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="📊 Трендовые видео">
        {tableData.length === 0 && !isLoading ? (
          <Empty 
            description="Нет данных. Нажмите 'Обновить тренды' для загрузки"
            style={{ padding: '60px 0' }}
          />
        ) : (
          <Table 
            columns={columns} 
            dataSource={tableData}
            loading={isLoading}
            pagination={{ 
              pageSize: 20,
              showTotal: (total) => `Всего: ${total} видео`,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ x: 1200 }}
            size="middle"
            rowKey="key"
          />
        )}
      </Card>

      {(localTrends || trendsData?.data?.fetchedAt) && (
        <Card style={{ marginTop: 16, textAlign: 'center' }}>
          Последнее обновление: {new Date(localTrends?.fetchedAt || trendsData.data.fetchedAt || Date.now()).toLocaleString('ru-RU')}
        </Card>
      )}
    </div>
  );
};

export default TrendsPage;
