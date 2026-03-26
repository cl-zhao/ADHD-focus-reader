import React from 'react';

interface ReaderPanelProps {
  data: {
    success: boolean;
    content?: string;
    title?: string;
    fallback?: string;
  };
  onClose: () => void;
}

export function ReaderPanel({ data, onClose }: ReaderPanelProps) {
  if (!data) return null;

  const title = data.title || document.title || '未命名文章';
  const htmlContent = data.content || data.fallback || '<p>无法提取内容</p>';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 顶栏 */}
      <div
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          borderBottom: '1px solid var(--color-bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          ← 返回原文
        </button>

        <h1
          style={{
            fontSize: '18px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            flex: 1,
            margin: '0 16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: '24px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* 正文区域 */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '40px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--panel-max-width)',
            margin: '0 auto',
            fontSize: 'var(--font-size)',
            lineHeight: 'var(--line-height)',
            letterSpacing: 'var(--letter-spacing)',
            color: 'var(--color-text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* 底栏 */}
      <div
        style={{
          height: '48px',
          borderTop: '1px solid var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        按 Esc 关闭 · Alt+R 快速切换
      </div>
    </div>
  );
}
