import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Collapse, Table, Space, Tag, message, Select, 
  Empty, Progress, Statistic, Row, Col, Typography, Tooltip, Badge 
} from 'antd';
import { 
  SearchOutlined, YoutubeOutlined, LinkOutlined, EyeOutlined, 
  LikeOutlined, CommentOutlined, ThunderboltOutlined, FireOutlined 
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { topicsService } from '../services';
import { useSocketStore } from '../stores/socketStore';

const { Panel } = Collapse;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const TopicsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [region, setRegion] = useState('US');
  const { socket } = useSocketStore();

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
    mutationFn: ({ apiKey, topicId, region, maxResults }) =>
      topicsService.searchTopic(apiKey, topicId, region, maxResults),
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
    mutationFn: ({ apiKey, categoryId, region, maxResults }) =>
      topicsService.searchCategory(apiKey, categoryId, region, maxResults),
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

  const handleSearchTopic = (topicId) => {
    const apiKey = localStorage.getItem('youtube_api_key') || 'AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw';
    setSelectedTopic(topicId);
    setSearchResults(null);
    searchTopicMutation.mutate({ apiKey, topicId, region, maxResults: 20 });
  };

  const handleSearchCategory = (categoryId) => {
    const apiKey = localStorage.getItem('youtube_api_key') || 'AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw';
    setSelectedCategory(categoryId);
    setSearchResults(null);
    setProgress(1);
    searchCategoryMutation.mutate({ apiKey, categoryId, region, maxResults: 5 });
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
      width: 110,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          href={`https://www.youtube.com/watch?v=${record.videoId}`}
          target="_blank"
        >
          Открыть
        </Button>
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
                <Select
                  style={{ width: 200 }}
                  value={region}
                  onChange={setRegion}
                  placeholder="Выберите регион"
                >
                  <Option value="US">🇺🇸 США</Option>
                  <Option value="CA">🇨🇦 Канада</Option>
                  <Option value="GB">🇬🇧 Великобритания</Option>
                  <Option value="DE">🇩🇪 Германия</Option>
                  <Option value="FR">🇫🇷 Франция</Option>
                  <Option value="FI">🇫🇮 Финляндия</Option>
                  <Option value="SE">🇸🇪 Швеция</Option>
                  <Option value="NO">🇳🇴 Норвегия</Option>
                </Select>
              </Space>
            </Space>
            
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
