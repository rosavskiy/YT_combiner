import React from 'react';
import { Card, Table, Statistic, Row, Col, Tag, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import userService from '../services/userService';
import useAuthStore from '../stores/authStore';

const columns = [
  {
    title: 'Пользователь',
    key: 'user',
    render: (_, r) => (
      <Space direction="vertical" size={0}>
        <strong>{r.user.first_name} {r.user.last_name}</strong>
        <span style={{ color:'#999' }}>@{r.user.username || r.user.login || r.user.id}</span>
      </Space>
    )
  },
  { title: 'Скачано', dataIndex: ['metrics','videos_downloaded'], key: 'vd' },
  { title: 'Спарсено', dataIndex: ['metrics','videos_parsed'], key: 'vp' },
  { title: 'Сгенерировано', dataIndex: ['metrics','videos_generated'], key: 'vg' },
  { title: 'Время (ч)', key: 'time', render: (_, r) => ((r.metrics.worked_seconds || 0)/3600).toFixed(2) },
  { title: 'Доход ($)', key: 'earn', render: (_, r) => ((r.metrics.earnings_cents || 0)/100).toFixed(2) },
];

const ReportsPage = () => {
  const { isAdmin } = useAuthStore();
  const { data, isLoading, error } = useQuery({ queryKey: ['reports-users-metrics'], queryFn: userService.getAllMetrics, select: (r) => r.data });

  const total = (data || []).reduce((acc, r) => {
    acc.vd += r.metrics.videos_downloaded || 0;
    acc.vp += r.metrics.videos_parsed || 0;
    acc.vg += r.metrics.videos_generated || 0;
    acc.ws += r.metrics.worked_seconds || 0;
    acc.ec += r.metrics.earnings_cents || 0;
    return acc;
  }, { vd:0, vp:0, vg:0, ws:0, ec:0 });

  return (
    <div>
      <h2>Отчёты по сотрудникам</h2>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="Скачано" value={total.vd} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Спарсено" value={total.vp} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Сгенерировано" value={total.vg} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Часы" value={(total.ws/3600).toFixed(2)} /></Card></Col>
      </Row>
      <Card>
        <Table columns={columns} dataSource={data || []} rowKey={(r) => r.user.id} loading={isLoading} pagination={{ pageSize: 20 }} />
      </Card>
    </div>
  );
};

export default ReportsPage;
