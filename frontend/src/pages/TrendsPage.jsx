import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Progress, Space, Statistic, Row, Col, Select, Empty, App as AntdApp, Checkbox } from 'antd';
import { GlobalOutlined, ReloadOutlined, EyeOutlined, LikeOutlined, CommentOutlined, YoutubeOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trendsService, configService } from '../services';
import { useSocketStore } from '../stores/socketStore';
import videosService from '../services/videosService';
import Flag from '../components/Flag';

const TrendsPage = () => {
  const { message } = AntdApp.useApp();
  const [progress, setProgress] = useState(0);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [localTrends, setLocalTrends] = useState(null);
  const { socket } = useSocketStore();
  const [dlQuality, setDlQuality] = useState('highest');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await videosService.getSystemHealth();
        setHealth(res.data);
      } catch {}
    })();
  }, []);

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

  // Настроенные списки отслеживаемых стран
  const { data: trackedResp } = useQuery({
    queryKey: ['tracked-countries'],
    queryFn: configService.getTrackedCountries,
  });

  // Все доступные коды стран для трендов
  const allTrendCodes = React.useMemo(() => (
    trackedResp?.trends || countriesData?.countries?.map(c => c.code) || []
  ), [trackedResp, countriesData]);

  // Инициализация выбранных стран из localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trends_regions_selected');
    if (saved) {
      try {
        const arr = JSON.parse(saved) || [];
        const filtered = arr.filter((c) => allTrendCodes.includes(c));
        setSelectedCountries(filtered);
        return;
      } catch {}
    }
    // по умолчанию пусто (поведение: топ-10 по каждой стране), но выравниваем по доступным кодам
    setSelectedCountries([]);
  }, [allTrendCodes]);

  const pluralizeCountries = (n) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'страна';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'страны';
    return 'стран';
  };

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

  // Мутация для парсинга видео из трендов
  const parseMutation = useMutation({
    mutationFn: async (videoId) => {
      const spreadsheetId = localStorage.getItem('sheets_spreadsheet_id') || undefined;
      return videosService.parseVideo(videoId, { spreadsheetId });
    },
    onSuccess: () => {
      message.success('✅ Видео добавлено в очередь парсинга!');
    },
    onError: (error) => {
      message.error(`❌ Ошибка парсинга: ${error?.message || 'Не удалось запустить парсинг'}`);
    }
  });

  // Колонки таблицы
  const columns = [
    {
      title: 'Страна',
      dataIndex: 'region',
      key: 'region',
      width: 160,
      fixed: 'left',
      render: (region) => {
        const country = countriesData?.countries?.find(c => c.code === region);
        return (
          <Space>
            <Flag code={country?.code} title={country?.name || region} />
            <span>{country?.name || region}</span>
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={async () => {
              message.info(`Добавлено в очередь скачивания: ${record.title}`);
              try {
                await videosService.downloadVideo(record.videoId, dlQuality);
              } catch (e) {
                message.error(e?.message || 'Не удалось добавить в очередь');
              }
            }}
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
      ),
    },
  ];

  // Преобразуем данные для таблицы
  const tableData = React.useMemo(() => {
    // Используем локальные данные, если они есть, иначе данные из БД
    const sourceData = localTrends?.data || trendsData?.data?.data;
    
    if (!sourceData) return [];
    
    const allVideos = [];
    const allowed = new Set(trackedResp?.trends || Object.keys(sourceData));
    const filterRegions = selectedCountries && selectedCountries.length > 0
      ? new Set(selectedCountries)
      : allowed;

    Object.entries(sourceData).forEach(([region, videos]) => {
      if (Array.isArray(videos)) {
        if (!filterRegions.has(region)) return;
        const filteredVideos = (selectedCountries && selectedCountries.length > 0)
          ? videos
          : videos.slice(0, 10);
        
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
  }, [localTrends, trendsData, selectedCountries, trackedResp]);

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Space>
                <GlobalOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <h2 style={{ margin: 0 }}>YouTube Тренды ({(trackedResp?.trends?.length) ?? countriesData?.count ?? 0} стран)</h2>
              </Space>
              <Space>
                <Select style={{ width: 130 }} value={dlQuality} onChange={setDlQuality}>
                  <Select.Option value="highest">Макс</Select.Option>
                  <Select.Option value="1080">1080p</Select.Option>
                  <Select.Option value="720">720p</Select.Option>
                  <Select.Option value="480">480p</Select.Option>
                  <Select.Option value="360">360p</Select.Option>
                </Select>
                <Select
                  mode="multiple"
                  style={{ width: 360 }}
                  value={selectedCountries}
                  onChange={(vals) => {
                    if (vals.includes('__ALL__')) {
                      const isAll = selectedCountries.length === allTrendCodes.length;
                      const next = isAll ? [] : allTrendCodes;
                      setSelectedCountries(next);
                      localStorage.setItem('trends_regions_selected', JSON.stringify(next));
                    } else {
                      setSelectedCountries(vals);
                      localStorage.setItem('trends_regions_selected', JSON.stringify(vals));
                    }
                  }}
                  placeholder={selectedCountries.length ? `Выбрано ${selectedCountries.length} ${pluralizeCountries(selectedCountries.length)}` : 'Выберите регионы'}
                  optionLabelProp="label"
                  maxTagCount={0}
                  maxTagPlaceholder={() => `Выбрано ${selectedCountries.length} ${pluralizeCountries(selectedCountries.length)}`}
                  options={[
                    {
                      value: '__ALL__',
                      label: (
                        <Space>
                          <Checkbox checked={selectedCountries.length === allTrendCodes.length} />
                          <span>Выбрать все</span>
                        </Space>
                      )
                    },
                    ...allTrendCodes.map(code => {
                      const c = countriesData?.countries?.find(x => x.code === code);
                      return {
                        value: code,
                        label: (
                          <Space>
                            <Flag code={c?.code} title={c?.name} />
                            <span>{c?.name || code}</span>
                          </Space>
                        )
                      };
                    })
                  ]}
                  menuItemSelectedIcon={({ isSelected, value }) => (
                    <Checkbox
                      checked={value === '__ALL__' ? selectedCountries.length === allTrendCodes.length : isSelected}
                      style={{ marginRight: 8 }}
                    />
                  )}
                />
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
            {/* Убрали предупреждение о FFmpeg из интерфейса */}
            
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
              value={trackedResp?.trends?.length || countriesData?.count || 0}
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
