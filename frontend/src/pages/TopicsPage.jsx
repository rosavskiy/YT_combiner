import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Collapse, Table, Space, Tag, Select, 
  Empty, Progress, Statistic, Row, Col, Typography, Tooltip, Badge, App as AntdApp, Checkbox 
} from 'antd';
import { 
  SearchOutlined, YoutubeOutlined, LinkOutlined, EyeOutlined, 
  LikeOutlined, CommentOutlined, ThunderboltOutlined, FireOutlined, DownloadOutlined, FileTextOutlined 
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { topicsService, configService, trendsService } from '../services';
import Flag from '../components/Flag';
import { useSocketStore } from '../stores/socketStore';
import videosService from '../services/videosService';

const { Panel } = Collapse;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const TopicsPage = () => {
  const { message } = AntdApp.useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [regions, setRegions] = useState([]);
  // Загружаем страны и списки отслеживаемых стран
  const { data: countriesResp } = useQuery({
    queryKey: ['countries-all'],
    queryFn: trendsService.getCountries,
    staleTime: Infinity,
  });
  const { data: trackedResp } = useQuery({
    queryKey: ['tracked-countries'],
    queryFn: configService.getTrackedCountries,
  });

  // Все доступные коды регионов для тем
  const allTopicCodes = React.useMemo(() => (
    trackedResp?.topics || countriesResp?.countries?.map(c => c.code) || []
  ), [trackedResp, countriesResp]);

  // Инициализация выбранных регионов: сначала из localStorage, далее из настроек
  useEffect(() => {
    const saved = localStorage.getItem('topics_regions_selected');
    if (saved) {
      try {
        const arr = JSON.parse(saved) || [];
        // Пересекаем с доступными кодами, чтобы убрать устаревшие
        const filtered = arr.filter((c) => allTopicCodes.includes(c));
        if (filtered.length > 0) {
          setRegions(filtered);
          return;
        }
      } catch {}
    }
    if (allTopicCodes.length > 0) {
      setRegions(allTopicCodes);
    }
  }, [allTopicCodes]);

  const pluralizeCountries = (n) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'страна';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'страны';
    return 'стран';
  };
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
      socket.on('topics-search-progress', (data) => {
        setProgress(data.progress);
        message.info(`📝 ${data.currentTopic} (${data.processed}/${data.total})`);
      });

      return () => {
        socket.off('topics-search-progress');
      };
    }
  }, [socket]);

  // Загрузка тем
  const { data: topicsData, isLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: topicsService.getTopics,
  });

  // Поиск по одной теме
  const searchTopicMutation = useMutation({
    mutationFn: async ({ apiKey, topicId, regions, maxResults }) => {
      const regionList = regions && regions.length > 0 ? regions : (trackedResp?.topics || ['US']);
      const results = await Promise.all(
        regionList.map((r) => topicsService.searchTopic(apiKey, topicId, r, maxResults))
      );
      // Объединяем результаты
      const merged = {
        totalVideos: results.reduce((s, r) => s + (r?.totalVideos || 0), 0),
        videos: results.flatMap((r) => r?.videos || []),
      };
      return merged;
    },
    onSuccess: (data) => {
      message.success(`🎉 Найдено ${data.totalVideos} видео!`);
      setSearchResults(data);
    },
    onError: (error) => {
      message.error(`❌ Ошибка: ${error.error || 'Не удалось найти видео'}`);
    }
  });

  // Поиск по всей категории
  const searchCategoryMutation = useMutation({
    mutationFn: async ({ apiKey, categoryId, regions, maxResults }) => {
      const regionList = regions && regions.length > 0 ? regions : (trackedResp?.topics || ['US']);
      const results = await Promise.all(
        regionList.map((r) => topicsService.searchCategory(apiKey, categoryId, r, maxResults))
      );
      // Склеиваем результаты от разных регионов
      const merged = {
        totalTopics: results.reduce((s, r) => s + (r?.totalTopics || 0), 0),
        totalVideos: results.reduce((s, r) => s + (r?.totalVideos || 0), 0),
        results: results.flatMap((r) => r?.results || []),
      };
      return merged;
    },
    onSuccess: (data) => {
      message.success(`🎉 Найдено ${data.totalVideos} видео по ${data.totalTopics} темам!`);
      // Преобразуем результаты категории в плоский список
      const allVideos = [];
      data.results.forEach(result => {
        if (result.videos && result.videos.length > 0) {
          result.videos.forEach(video => {
            allVideos.push({
              ...video,
              topicTitle: result.title
            });
          });
        }
      });
      setSearchResults({
        ...data,
        videos: allVideos
      });
      setProgress(0);
    },
    onError: (error) => {
      message.error(`❌ Ошибка: ${error.error || 'Не удалось найти видео'}`);
      setProgress(0);
    }
  });

  // Мутации на действия по видео (скачать/парсить)
  const downloadMutation = useMutation({
    mutationFn: ({ videoId, metadata }) => videosService.downloadVideo(videoId, 'highest', metadata),
    onSuccess: () => message.success('✅ Видео добавлено в очередь скачивания!'),
    onError: (error) => message.error(`❌ Ошибка скачивания: ${error?.message || 'Не удалось скачать'}`),
  });

  const parseMutation = useMutation({
    mutationFn: ({ videoId }) => {
      const spreadsheetId = localStorage.getItem('sheets_spreadsheet_id') || undefined;
      return videosService.parseVideo(videoId, { spreadsheetId });
    },
    onSuccess: () => message.success('✅ Видео добавлено в очередь парсинга!'),
    onError: (error) => message.error(`❌ Ошибка парсинга: ${error?.message || 'Не удалось запустить парсинг'}`),
  });

  const handleSearchTopic = (topicId) => {
    const apiKey = localStorage.getItem('youtube_api_key') || 'AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw';
    setSelectedTopic(topicId);
    setSearchResults(null);
    searchTopicMutation.mutate({ apiKey, topicId, regions, maxResults: 20 });
  };

  const handleSearchCategory = (categoryId) => {
    const apiKey = localStorage.getItem('youtube_api_key') || 'AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw';
    setSelectedCategory(categoryId);
    setSearchResults(null);
    setProgress(1);
    searchCategoryMutation.mutate({ apiKey, categoryId, regions, maxResults: 5 });
  };

  // Колонки таблицы результатов
  const columns = [
    {
      title: 'Видео',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      fixed: 'left',
      ellipsis: true,
      render: (title, record) => (
        <a
          href={`https://www.youtube.com/watch?v=${record.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1890ff' }}
        >
          <YoutubeOutlined style={{ color: '#FF0000', fontSize: 16, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
        </a>
      ),
    },
    {
      title: 'Тема',
      dataIndex: 'topicTitle',
      key: 'topicTitle',
      width: 250,
      ellipsis: true,
      render: (topicTitle) => topicTitle && (
        <Tag color="blue" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {topicTitle}
        </Tag>
      ),
    },
    {
      title: 'Канал',
      dataIndex: 'channel',
      key: 'channel',
      width: 180,
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
      width: 130,
      align: 'right',
      render: (views) => views?.toLocaleString() || '0',
      sorter: (a, b) => a.views - b.views,
    },
    {
      title: <><LikeOutlined /> Лайки</>,
      dataIndex: 'likes',
      key: 'likes',
      width: 110,
      align: 'right',
      render: (likes) => likes?.toLocaleString() || '0',
      sorter: (a, b) => a.likes - b.likes,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 260,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={`https://www.youtube.com/watch?v=${record.videoId}`}
            target="_blank"
          >
            Открыть
          </Button>
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
            onClick={() => parseMutation.mutate({ videoId: record.videoId })}
            loading={parseMutation.isPending}
          >
            Парсить
          </Button>
        </Space>
      ),
    },
  ];

  const categories = topicsData?.data || [];
  const stats = topicsData?.stats;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Space>
                <FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                <Title level={2} style={{ margin: 0 }}>Кураторские темы</Title>
              </Space>
              <Space>
                <Select style={{ width: 130 }} value={dlQuality} onChange={setDlQuality}>
                  <Option value="highest">Макс</Option>
                  <Option value="1080">1080p</Option>
                  <Option value="720">720p</Option>
                  <Option value="480">480p</Option>
                  <Option value="360">360p</Option>
                </Select>
                <Select
                  mode="multiple"
                  style={{ width: 320 }}
                  value={regions}
                  onChange={(vals) => {
                    // Обработка 'Выбрать все'
                    if (vals.includes('__ALL__')) {
                      const all = allTopicCodes;
                      const isAll = regions.length === all.length;
                      const next = isAll ? [] : all;
                      setRegions(next);
                      localStorage.setItem('topics_regions_selected', JSON.stringify(next));
                    } else {
                      setRegions(vals);
                      localStorage.setItem('topics_regions_selected', JSON.stringify(vals));
                    }
                  }}
                  placeholder={regions.length ? `Выбрано ${regions.length} ${pluralizeCountries(regions.length)}` : 'Выберите регионы'}
                  optionLabelProp="label"
                  maxTagCount={0}
                  maxTagPlaceholder={() => `Выбрано ${regions.length} ${pluralizeCountries(regions.length)}`}
                  options={[
                    {
                      value: '__ALL__',
                      label: (
                        <Space>
                          <Checkbox checked={regions.length === allTopicCodes.length} />
                          <span>Выбрать все</span>
                        </Space>
                      )
                    },
                    ...allTopicCodes.map(code => {
                      const c = countriesResp?.countries?.find(x => x.code === code);
                      return {
                        value: code,
                        label: (
                          <Space>
                            <Flag code={c?.code} title={c?.name} />
                            <span>{c?.name || code}</span>
                          </Space>
                        )
                      }
                    })
                  ]}
                  menuItemSelectedIcon={({ isSelected, value }) => (
                    <Checkbox
                      checked={value === '__ALL__' ? regions.length === allTopicCodes.length : isSelected}
                      style={{ marginRight: 8 }}
                    />
                  )}
                />
              </Space>
            </Space>
            {/* Убрали предупреждение о FFmpeg из интерфейса */}
            
            {progress > 0 && progress < 100 && (
              <Progress
                percent={progress}
                status="active"
                style={{ marginTop: 16 }}
                strokeColor={{
                  '0%': '#ff4d4f',
                  '100%': '#52c41a',
                }}
              />
            )}
          </Card>
        </Col>

        {stats && (
          <>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Категорий"
                  value={stats.totalCategories}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Тем"
                  value={stats.totalTopics}
                  prefix={<FireOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Найдено видео"
                  value={searchResults?.totalVideos || 0}
                  prefix={<YoutubeOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      <Card title="📚 Категории и темы" style={{ marginBottom: 16 }}>
        {isLoading ? (
          <Empty description="Загрузка..." />
        ) : (
          <Collapse accordion>
            {categories.map((category) => (
              <Panel
                header={
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <span style={{ fontSize: 20 }}>{category.icon}</span>
                      <Text strong>{category.category}</Text>
                      <Badge count={category.topics.length} showZero color={category.color} />
                    </Space>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSearchCategory(category.id);
                      }}
                      loading={searchCategoryMutation.isPending && selectedCategory === category.id}
                    >
                      Искать все
                    </Button>
                  </Space>
                }
                key={category.id}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {category.topics.map((topic) => (
                    <Card
                      key={topic.id}
                      size="small"
                      hoverable
                      style={{ 
                        borderLeft: `4px solid ${category.color}`,
                        backgroundColor: selectedTopic === topic.id ? '#f0f0f0' : 'white'
                      }}
                    >
                      <Row gutter={16} align="middle">
                        <Col flex="auto">
                          <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                            {topic.title}
                          </Title>
                          <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                            {topic.description}
                          </Paragraph>
                          <Space wrap style={{ marginTop: 8 }}>
                            {topic.keywords.slice(0, 3).map((keyword, idx) => (
                              <Tag key={idx} color="default" style={{ fontSize: 11 }}>
                                {keyword}
                              </Tag>
                            ))}
                          </Space>
                        </Col>
                        <Col>
                          <Tooltip title="Поиск видео по этой теме">
                            <Button
                              type="primary"
                              icon={<SearchOutlined />}
                              onClick={() => handleSearchTopic(topic.id)}
                              loading={searchTopicMutation.isPending && selectedTopic === topic.id}
                            >
                              Искать
                            </Button>
                          </Tooltip>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </Space>
              </Panel>
            ))}
          </Collapse>
        )}
      </Card>

      {searchResults && (
        <Card title={`🎬 Результаты поиска (${searchResults.videos?.length || 0} видео)`}>
          {searchResults.videos && searchResults.videos.length > 0 ? (
            <Table
              columns={columns}
              dataSource={searchResults.videos}
              rowKey={(record) => record.videoId}
              pagination={{
                pageSize: 20,
                showTotal: (total) => `Всего: ${total} видео`,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100']
              }}
              scroll={{ x: 1300 }}
              size="middle"
              bordered
            />
          ) : (
            <Empty description="Видео не найдены. Попробуйте другую тему или регион." />
          )}
        </Card>
      )}
    </div>
  );
};

export default TopicsPage;
