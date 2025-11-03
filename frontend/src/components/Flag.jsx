import React from 'react';

// Маленький компонент для отображения флага по коду страны
// Использует CDN flagcdn.com (PNG 20x15 по умолчанию)
export default function Flag({ code, title, size = 20, style }) {
  const [failed, setFailed] = React.useState(false);
  if (!code) return null;
  const cc = String(code).toLowerCase();
  const height = Math.round((size * 3) / 4); // 4:3
  const src = `https://flagcdn.com/${size}x${height}/${cc}.png`;
  if (failed) {
    return (
      <span title={title || code} style={{ display: 'inline-block', width: size, textAlign: 'center', ...style }}>
        {String(code).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={title || code}
      width={size}
      height={height}
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 2, ...style }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
