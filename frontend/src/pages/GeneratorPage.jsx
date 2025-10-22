import React from 'react';
import { Card, Typography } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const GeneratorPage = () => {
  return (
    <Card>
      <VideoCameraOutlined style={{ fontSize: 48, color: '#722ed1' }} />
      <Title level={2}>Генератор видео</Title>
      <Paragraph>
        Страница в разработке. Здесь будет функционал для генерации видео с переводом на разные языки.
      </Paragraph>
    </Card>
  );
};

export default GeneratorPage;
