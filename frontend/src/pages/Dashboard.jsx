import React from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Badge } from 'antd';
import {
  GlobalOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { trendsService, videosService, configService } from '../services';
import Flag from '../components/Flag';
import { useSocketStore } from '../stores/socketStore';

const { Title, Paragraph } = Typography;

const Dashboard = () => {
  const { connected } = useSocketStore();

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: trendsService.getCountries,
  });
  const { data: trackedResp } = useQuery({
    queryKey: ['tracked-countries'],
    queryFn: configService.getTrackedCountries,
  });

  const { data: latestTrends } = useQuery({
    queryKey: ['latest-trends'],
    queryFn: trendsService.getLatestTrends,
  });

  const { data: downloadedVideos } = useQuery({
    queryKey: ['downloaded-videos'],
    queryFn: videosService.getDownloadedVideos,
  });

  const totalCountries = trackedResp?.trends?.length || countriesData?.count || 0;
  const totalVideos = latestTrends?.data?.totalVideos || 0;
  const downloadedCount = downloadedVideos?.count || 0;

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space align="center">
              <FireOutlined style={{ fontSize: 32, color: '#FF0000' }} />
              <Title level={2} style={{ margin: 0 }}>
                YT Combiner Dashboard
              </Title>
              <Badge 
                status={connected ? 'success' : 'error'} 
                text={connected ? 'Онлайн' : 'Оффлайн'} 
              />
            </Space>
            <Paragraph style={{ margin: 0, color: '#666' }}>
              Система для мониторинга трендовых видео и автоматической генерации контента
            </Paragraph>
          </Space>
        </Card>

        {/* Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Отслеживаемых стран"
                value={totalCountries}
                prefix={<GlobalOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Трендовых видео"
                value={totalVideos}
                prefix={<FireOutlined />}
                valueStyle={{ color: '#FF0000' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Скачано видео"
                value={downloadedCount}
                prefix={<DownloadOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Сгенерировано"
                value={0}
                prefix={<VideoCameraOutlined />}
                valueStyle={{ color: '#722ed1' }}
                suffix="видео"
              />
            </Card>
          </Col>
        </Row>

        {/* Features */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="🌍 Мониторинг трендов" bordered={false}>
              <Paragraph>
                Отслеживаемые страны:
              </Paragraph>
              <Space wrap>
                {(trackedResp?.trends || countriesData?.countries?.map(c => c.code) || []).map(code => {
                  const c = countriesData?.countries?.find(x => x.code === code);
                  return (
                    <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#666' }}>
                      <Flag code={c?.code} title={c?.name} /> {c?.name || code}
                    </span>
                  );
                })}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="⚡ Быстрый старт" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Paragraph>
                  <ThunderboltOutlined /> <strong>Шаг 1:</strong> Установите YouTube API ключ в настройках
                </Paragraph>
                <Paragraph>
                  <ThunderboltOutlined /> <strong>Шаг 2:</strong> Загрузите тренды из всех стран
                </Paragraph>
                <Paragraph>
                  <ThunderboltOutlined /> <strong>Шаг 3:</strong> Скачайте интересующие видео
                </Paragraph>
                <Paragraph>
                  <ThunderboltOutlined /> <strong>Шаг 4:</strong> Генерируйте контент с переводом
                </Paragraph>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Last Update */}
        {latestTrends?.data?.fetchedAt && (
          <Card>
            <Paragraph style={{ margin: 0, textAlign: 'center', color: '#666' }}>
              Последнее обновление трендов: {new Date(latestTrends.data.fetchedAt).toLocaleString('ru-RU')}
            </Paragraph>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default Dashboard;
