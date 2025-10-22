import React from 'react';
import { Card, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const DownloadPage = () => {
  return (
    <Card>
      <DownloadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
      <Title level={2}>Скачивание видео</Title>
      <Paragraph>
        Страница в разработке. Здесь будет функционал для скачивания видео из трендов.
      </Paragraph>
    </Card>
  );
};

export default DownloadPage;
