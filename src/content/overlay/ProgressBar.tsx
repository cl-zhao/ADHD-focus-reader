import React from 'react';

interface ProgressBarProps {
  current: number;      // 当前段落
  total: number;        // 总段落数
  estimatedTime?: number; // 预计剩余时间（分钟）
}

/**
 * 计算预计剩余阅读时间
 */
export function calculateEstimatedTime(current: number, total: number): number {
  if (current === 0 || total === 0) return 0;
  const remaining = total - current;
  const avgReadTime = 0.5; // 假设每段0.5分钟（可配置）
  return Math.ceil(remaining * avgReadTime);
}

export function ProgressBar({ current, total, estimatedTime }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div style={{
      padding: '8px 20px',
      backgroundColor: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-bg-secondary)',
    }}>
      {/* 进度条 */}
      <div style={{
        height: '4px',
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: 'var(--color-accent)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* 进度文字 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
      }}>
        <span>{current} / {total} 段</span>
        <span>{Math.round(percentage)}%</span>
        {estimatedTime !== undefined && estimatedTime > 0 && <span>约 {estimatedTime} 分钟</span>}
      </div>
    </div>
  );
}
