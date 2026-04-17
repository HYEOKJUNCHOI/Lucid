import { useCallback, useEffect, useRef, useState } from 'react';
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

/**
 * Pull-to-Refresh 래퍼 컴포넌트
 *
 * @param {object} props
 * @param {() => Promise<void>} props.onRefresh  새로고침 로직 (Promise 반환)
 * @param {number} [props.threshold]             당기는 거리 px (default: 60)
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export default function PullToRefresh({
  onRefresh,
  threshold = 60,
  children,
  className,
}) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const [dy, setDy] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isDraggingRef = useRef(false);
  // threshold 를 한 번만 트리거하기 위한 플래그
  const triggeredRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop !== 0) return;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    triggeredRef.current = false;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current || startYRef.current == null || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop !== 0) {
      // 스크롤 내려간 상태면 드래그 취소
      isDraggingRef.current = false;
      startYRef.current = null;
      return;
    }

    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) return;

    // 브라우저 기본 pull-to-refresh 차단
    e.preventDefault();

    setDy(delta);

    if (!triggeredRef.current && delta >= threshold) {
      triggeredRef.current = true;
      haptic.success();
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startYRef.current = null;

    if (triggeredRef.current) {
      setRefreshing(true);
      setDy(0);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    } else {
      setDy(0);
    }
    triggeredRef.current = false;
  }, [onRefresh]);

  // passive: false 로 touchmove 등록 — preventDefault 가 동작하도록
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // 인디케이터 opacity / scale
  const progress = Math.min(dy / threshold, 1);
  const indicatorStyle = {
    opacity: refreshing ? 1 : progress,
    transform: `scale(${refreshing ? 1 : progress})`,
  };

  // children translateY (탄성 — 실제 거리의 40%)
  const childTranslateY = refreshing ? 0 : dy * 0.4;
  const childStyle = {
    transform: `translateY(${childTranslateY}px)`,
    transition: isDraggingRef.current ? 'none' : 'transform 150ms ease-out',
  };

  return (
    <div
      ref={containerRef}
      className={cx('relative overflow-hidden', className)}
      style={{ overscrollBehaviorY: 'contain' }}
    >
      {/* 스피너 인디케이터 */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center text-theme-primary pointer-events-none z-10"
        style={indicatorStyle}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className={cx('w-5 h-5', refreshing ? 'animate-spin' : '')}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>

      {/* 콘텐츠 래퍼 */}
      <div style={childStyle}>
        {children}
      </div>
    </div>
  );
}
