import React, { useMemo } from 'react';
import { Card, Space, Typography, Statistic, Button, Row, Col, Tag } from 'antd';
import { PlayCircleOutlined, StopOutlined, FieldTimeOutlined, DollarOutlined, DownloadOutlined, FileTextOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worktimeService as worktime } from '../services';
import userService from '../services/userService';
import useAuthStore from '../stores/authStore';

const { Title, Paragraph, Text } = Typography;

const secondsToHMS = (s) => {
  const sec = Math.max(0, Number(s || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
};

const EmployeePage = () => {
  const queryClient = useQueryClient();
  const { user, impersonating, revertImpersonation } = useAuthStore();

  const { data: activeResp } = useQuery({ queryKey: ['worktime-active'], queryFn: worktime.active, select: (r) => r.data });
  const { data: summaryResp } = useQuery({ queryKey: ['worktime-summary'], queryFn: () => worktime.summary({}), select: (r) => r.data });
  const { data: metricsResp } = useQuery({ queryKey: ['user-metrics'], queryFn: () => userService.getMyMetrics(), select: (r) => r.data });

  const startMutation = useMutation({ mutationFn: worktime.start, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worktime-active'] }) });
  const stopMutation = useMutation({ mutationFn: worktime.stop, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worktime-active','worktime-summary'] }); } });

  const active = activeResp;
  const summary = summaryResp || { sessions: 0, duration_seconds: 0 };
  const metrics = metricsResp || { videos_downloaded: 0, videos_parsed: 0, videos_generated: 0, earnings_cents: 0, worked_seconds: 0 };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card extra={impersonating && <Button size="small" icon={<UserSwitchOutlined />} onClick={() => revertImpersonation()}>Вернуться</Button>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>Личный кабинет</Title>
          <Paragraph style={{ margin: 0, color: '#666' }}>Здравствуйте, {user?.first_name || user?.username || 'сотрудник'} 👋</Paragraph>
          {impersonating && <Paragraph style={{ margin: 0, color: '#d48806' }}>Вы действуете как этот пользователь (имперсонация).</Paragraph>}
        </Space>
      </Card>

      <Row gutter={[16,16]}>
        <Col xs={24} md={8}>
          <Card title="Рабочее время" extra={active ? <Tag color="green">В работе</Tag> : <Tag>Оффлайн</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic title="Всего за все время" prefix={<FieldTimeOutlined />} value={secondsToHMS(metrics.worked_seconds)} />
              <Statistic title="Сессий" value={summary.sessions || 0} />
              {active && <Text type="secondary">Начато: {new Date(active.started_at).toLocaleString()}</Text>}
              <Space>
                {!active ? (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startMutation.mutate()} loading={startMutation.isPending}>Начать</Button>
                ) : (
                  <Button danger icon={<StopOutlined />} onClick={() => stopMutation.mutate()} loading={stopMutation.isPending}>Завершить</Button>
                )}
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="Ваша статистика">
            <Row gutter={[16,16]}>
              <Col xs={12} md={6}><Statistic title="Скачано" value={metrics.videos_downloaded || 0} prefix={<DownloadOutlined />} /></Col>
              <Col xs={12} md={6}><Statistic title="Спарсено" value={metrics.videos_parsed || 0} prefix={<FileTextOutlined />} /></Col>
              <Col xs={12} md={6}><Statistic title="Сгенерировано" value={metrics.videos_generated || 0} /></Col>
              <Col xs={12} md={6}><Statistic title="Доход" value={(metrics.earnings_cents || 0)/100} precision={2} prefix={<DollarOutlined />} suffix="$" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default EmployeePage;
