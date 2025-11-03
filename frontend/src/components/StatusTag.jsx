import React from 'react';
import { Tag } from 'antd';
import { 
  DownloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

// Унифицированный компонент статуса для скачивания и парсинга
// type: 'download' | 'parse' (меняет подписи для active)
const StatusTag = ({ status, type = 'download' }) => {
  const map = {
    waiting: { icon: <LoadingOutlined />, color: 'blue', text: 'В очереди' },
    active: {
      icon: <DownloadOutlined />,
      color: 'processing',
      text: type === 'parse' ? 'Парсинг' : 'Скачивание',
    },
    completed: { icon: <CheckCircleOutlined />, color: 'success', text: 'Готово' },
    failed: { icon: <DeleteOutlined />, color: 'error', text: 'Ошибка' },
  };
  const cfg = map[status] || map.waiting;
  return (
    <Tag icon={cfg.icon} color={cfg.color}>
      {cfg.text}
    </Tag>
  );
};

export default StatusTag;
