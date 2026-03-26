import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useReaderStore } from '../../shared/store/readerStore';

interface FocusModeProps {
  content: string;
  onProgressChange?: (current: number, total: number) => void;
  segmentSize?: number; // 每段目标字数，默认150
}

/**
 * 将HTML内容转换为纯文本
 */
function htmlToText(html: string): string {
  // 创建临时元素解析HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * 分段算法
 * 1. 先按自然段落分割（<p>, <br>, \n\n）
 * 2. 超长段落按句号分割
 * 3. 每段控制在 minSize-maxSize 字之间
 */
function segmentContent(text: string, targetSize: number = 150): string[] {
  const minSize = 100;
  const maxSize = 300;
  const segments: string[] = [];

  // 1. 先按自然段落分割
  const paragraphs = text
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // 2. 处理每个段落
  for (const para of paragraphs) {
    const cleanPara = htmlToText(para).trim();

    if (cleanPara.length === 0) continue;

    // 如果段落长度合适，直接添加
    if (cleanPara.length <= maxSize) {
      segments.push(cleanPara);
      continue;
    }

    // 超长段落按句号分割
    const sentences = cleanPara.split(/(?<=[。！？!?.])/);

    let currentSegment = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      // 如果单句就超长，需要强制分割
      if (trimmedSentence.length > maxSize) {
        // 先保存当前段落
        if (currentSegment.length > 0) {
          segments.push(currentSegment.trim());
          currentSegment = '';
        }
        // 按逗号或字数强制分割
        const parts = trimmedSentence.split(/(?<=[，,；;])/);
        let tempPart = '';

        for (const part of parts) {
          if (tempPart.length + part.length <= maxSize) {
            tempPart += part;
          } else {
            if (tempPart.length > 0) {
              segments.push(tempPart.trim());
            }
            // 如果单个part还是超长，按字数强制分割
            if (part.length > maxSize) {
              for (let i = 0; i < part.length; i += maxSize) {
                segments.push(part.slice(i, i + maxSize));
              }
            } else {
              tempPart = part;
            }
          }
        }

        if (tempPart.length >= minSize) {
          currentSegment = tempPart;
        } else if (tempPart.length > 0) {
          // 太短的合并到下一个
          currentSegment = tempPart;
        }
        continue;
      }

      // 检查添加后是否超过最大长度
      if (currentSegment.length + trimmedSentence.length <= maxSize) {
        currentSegment += trimmedSentence;
      } else {
        // 当前段落达到上限，保存并开始新段落
        if (currentSegment.length >= minSize) {
          segments.push(currentSegment.trim());
          currentSegment = trimmedSentence;
        } else {
          // 当前段落太短，继续添加
          currentSegment += trimmedSentence;
          segments.push(currentSegment.trim());
          currentSegment = '';
        }
      }
    }

    // 保存剩余内容
    if (currentSegment.trim().length > 0) {
      segments.push(currentSegment.trim());
    }
  }

  // 过滤空段落并确保每段至少有内容
  return segments.filter(s => s.length > 0);
}

export function FocusMode({ content, onProgressChange, segmentSize = 150 }: FocusModeProps) {
  const { settings } = useReaderStore();

  // 使用配置中的segmentSize，如果props没传则使用store中的设置
  const actualSegmentSize = segmentSize || settings.reading.segmentSize;

  // 1. 分段逻辑
  const segments = useMemo(() => {
    return segmentContent(content, actualSegmentSize);
  }, [content, actualSegmentSize]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // 2. 键盘监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(i => Math.min(segments.length - 1, i + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [segments.length]);

  // 3. 进度回调
  useEffect(() => {
    onProgressChange?.(currentIndex + 1, segments.length);
  }, [currentIndex, segments.length, onProgressChange]);

  // 导航函数
  const goToPrevious = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(i => Math.min(segments.length - 1, i + 1));
  }, []);

  if (segments.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)'
      }}>
        暂无内容
      </div>
    );
  }

  const progress = ((currentIndex + 1) / segments.length) * 100;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 进度条 */}
      <div style={{ height: '4px', backgroundColor: 'var(--color-bg-secondary)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: 'var(--color-accent)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* 内容区域 */}
      <div
        style={{
          flex: 1,
          padding: '40px',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--panel-max-width)',
            margin: '0 auto',
            width: '100%',
            fontSize: 'var(--font-size)',
            lineHeight: 'var(--line-height)',
            letterSpacing: 'var(--letter-spacing)',
            color: 'var(--color-text-primary)',
          }}
        >
          <p style={{ margin: 0, textIndent: '2em' }}>
            {segments[currentIndex]}
          </p>
        </div>
      </div>

      {/* 底部导航 */}
      <div
        style={{
          height: '60px',
          borderTop: '1px solid var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '0 20px',
        }}
      >
        <NavigationButton
          onClick={goToPrevious}
          disabled={currentIndex === 0}
        >
          {'<'} 上一段
        </NavigationButton>

        <span style={{
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
          minWidth: '80px',
          textAlign: 'center',
        }}>
          {currentIndex + 1} / {segments.length} 段
        </span>

        <NavigationButton
          onClick={goToNext}
          disabled={currentIndex === segments.length - 1}
        >
          下一段 {'>'}
        </NavigationButton>
      </div>
    </div>
  );
}

// 导航按钮组件
interface NavigationButtonProps {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}

function NavigationButton({ onClick, disabled, children }: NavigationButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        fontSize: '14px',
        border: '1px solid var(--color-bg-secondary)',
        borderRadius: '6px',
        backgroundColor: disabled ? 'transparent' : 'var(--color-accent)',
        color: disabled ? 'var(--color-text-tertiary)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = '0.8';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = disabled ? '0.5' : '1';
      }}
    >
      {children}
    </button>
  );
}

export default FocusMode;
