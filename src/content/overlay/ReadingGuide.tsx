import React, { useState, useEffect, useRef, useCallback } from 'react';

type GuideType = 'highlight' | 'underline' | 'dynamic';

interface ReadingGuideProps {
  contentRef: React.RefObject<HTMLDivElement>;
  guideType: GuideType;
  enabled: boolean;
  lineHeight?: number;
}

export function ReadingGuide({
  contentRef,
  guideType,
  enabled,
  lineHeight = 2.0,
}: ReadingGuideProps) {
  const [offsetY, setOffsetY] = useState(0);
  const [dynamicPosition, setDynamicPosition] = useState(-100);
  const animationRef = useRef<number | null>(null);
  const dynamicElementRef = useRef<HTMLDivElement>(null);

  // 监听滚动计算当前行
  useEffect(() => {
    if (!enabled || !contentRef.current) return;

    const handleScroll = () => {
      const element = contentRef.current;
      if (!element) return;

      const scrollTop = element.scrollTop;
      // 使用传入的 lineHeight (单位 em)，转换为像素值
      const computedStyle = getComputedStyle(element);
      const fontSize = parseFloat(computedStyle.fontSize) || 20;
      const lineHeightPx = fontSize * lineHeight;

      // 计算精确的偏移量（考虑滚动容器顶部位置）
      const containerRect = element.getBoundingClientRect();
      const contentTop = element.scrollTop;
      // 当前可视区域中心行
      const centerY = containerRect.height / 2;
      const centerLine = Math.floor((contentTop + centerY) / lineHeightPx);
      setOffsetY(centerLine * lineHeightPx - contentTop);
    };

    const element = contentRef.current;
    element.addEventListener('scroll', handleScroll, { passive: true });

    // 初始调用一次
    handleScroll();

    return () => element.removeEventListener('scroll', handleScroll);
  }, [enabled, contentRef, lineHeight]);

  // 动态模式的动画 - 直接操作 DOM 以优化性能
  useEffect(() => {
    if (!enabled || guideType !== 'dynamic') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    let startTime: number | null = null;
    const duration = 2000; // 2秒一个周期

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;

      // 从 -100% 到 333%
      const position = -100 + progress * 433;

      // 直接操作 DOM 避免频繁的 React 渲染
      if (dynamicElementRef.current) {
        dynamicElementRef.current.style.transform = `translateX(${position}%)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, guideType]);

  if (!enabled) return null;

  const fontSize = 20; // 默认字体大小
  const lineHeightPx = fontSize * lineHeight;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {guideType === 'highlight' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: `${lineHeight}em`,
            top: offsetY,
            backgroundColor: 'var(--color-accent, #4a90d9)',
            opacity: 0.1,
            pointerEvents: 'none',
            transition: 'top 0.15s ease-out',
            willChange: 'top',
          }}
        />
      )}

      {guideType === 'underline' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            top: offsetY + lineHeightPx - 2,
            backgroundColor: 'var(--color-accent, #4a90d9)',
            pointerEvents: 'none',
            transition: 'top 0.15s ease-out',
            willChange: 'top',
          }}
        />
      )}

      {guideType === 'dynamic' && (
        <div
          ref={dynamicElementRef}
          style={{
            position: 'absolute',
            left: 0,
            width: '30%',
            height: `${lineHeight}em`,
            top: offsetY,
            background: 'linear-gradient(90deg, transparent 0%, var(--color-accent, #4a90d9) 50%, transparent 100%)',
            opacity: 0.2,
            pointerEvents: 'none',
            transform: 'translateX(-100%)',
            willChange: 'transform',
          }}
        />
      )}
    </div>
  );
}

// 导出类型
export type { GuideType, ReadingGuideProps };
