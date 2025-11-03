import React from 'react';
import { Card, Typography, Table, Button, Space, Alert, App as AntdApp } from 'antd';
import { VideoCameraOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { generatorService } from '@/services';

const { Title } = Typography;

const DEFAULT_SHEET = 'Videos';

const GeneratorPage = () => {
  const { message } = AntdApp.useApp();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [spreadsheetId, setSpreadsheetId] = React.useState(() => localStorage.getItem('sheets_spreadsheet_id') || '');

  const queryKey = ['sheets-rows', { spreadsheetId, page, pageSize }];
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    enabled: !!spreadsheetId,
    queryFn: async () => {
      const res = await generatorService.getSheetRows({ spreadsheetId, sheet: DEFAULT_SHEET, page, pageSize });
      return res;
    }
  });

  const rows = data?.rows || [];
  const headers = data?.headers || [];
  const total = data?.total || 0;

  const columns = React.useMemo(() => {
    const base = headers.map((h) => ({
      title: h,
      dataIndex: h,
      key: h,
      ellipsis: true,
      width: 200,
      render: (val) => {
        const v = val ?? '';
        if (/^https?:\/\//i.test(String(v))) {
          return <a href={String(v)} target="_blank" rel="noreferrer">{String(v)}</a>;
        }
        return String(v);
      }
    }));
    return base.length ? base : [{ title: 'Данных нет', dataIndex: 'empty', key: 'empty' }];
  }, [headers]);

  const onRefresh = () => {
    if (!spreadsheetId) {
      message.warning('Укажите Spreadsheet ID в настройках');
      return;
    }
    refetch();
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <VideoCameraOutlined style={{ fontSize: 28, color: '#722ed1' }} />
            <Title level={3} style={{ margin: 0 }}>Генератор — данные из Google Sheets</Title>
          </Space>
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh} loading={isFetching}>
            Обновить
          </Button>
        </Space>
      </Card>

      {!spreadsheetId && (
        <Alert
          type="warning"
          showIcon
          message="Не указан Spreadsheet ID"
          description="Укажите ID таблицы в настройках (ключ sheets_spreadsheet_id). После этого вернитесь сюда и нажмите 'Обновить'."
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          rowKey={(_, idx) => idx}
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `Всего: ${t}`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: Math.max(1000, headers.length * 200) }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default GeneratorPage;
