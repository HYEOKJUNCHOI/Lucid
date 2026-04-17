import { useEffect, useRef, useState } from 'react';
import haptic from '@/lib/haptic';

/**
 * 모바일 바텀시트 — 스와이프 다운으로 닫기 + snapPoints 2단 스냅 지원
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} props.children
 * @param {'auto'|'half'|'full'} props.size
 * @param {boolean} props.showHandle
 * @param {boolean} props.closeOnBackdrop
 * @param {number[]} [props.snapPoints] — vh 퍼센트 배열 예: [40, 90]
 *   제공 시 첫 번째 snap 에서 열리고, 위로 드래그하면 다음 snap 으로 확장
 *   미제공 시 기존 size prop 동작 유지
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = 'auto',
  showHandle = true,
  closeOnBackdrop = true,
  snapPoints,
}) {
  const sheetRef = useRef(null);

  // snapPoints 모드 여부
  const hasSnaps = Array.isArray(snapPoints) && snapPoints.length > 0;

  // 현재 활성 snapIndex (0 = 가장 작은 snap)
  const [snapIndex, setSnapIndex] = useState(0);
  // 드래그 중 실시간 오프셋 (px, 양수 = 아래로)
  const [dragOffset, setDragOffset] = useState(0);
  // 레거시 모드용 dragY
  const [dragY, setDragY] = useState(0);

  const startY = useRef(null);
  const startTime = useRef(null);
  const startedAtTop = useRef(false);
  const isDragging = useRef(false);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // open 변경 시 상태 초기화
  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragOffset(0);
      setSnapIndex(0);
    }
  }, [open]);

  // ── snapPoints 모드 드래그 핸들러 ──────────────────────────────────────────
  const onSnapTouchStart = (e) => {
    const el = sheetRef.current;
    startedAtTop.current = el ? el.scrollTop <= 0 : true;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isDragging.current = false;
  };

  const onSnapTouchMove = (e) => {
    if (startY.current == null || !startedAtTop.current) return;
    const dy = e.touches[0].clientY - startY.current;
    isDragging.current = true;
    setDragOffset(dy); // 음수(위) or 양수(아래) 모두 허용
  };

  const onSnapTouchEnd = () => {
    if (startY.current == null || !isDragging.current) {
      startY.current = null;
      return;
    }

    const elapsed = Date.now() - startTime.current;
    const speed = Math.abs(dragOffset) / Math.max(elapsed, 1) * 1000; // px/s

    const sorted = [...snapPoints].sort((a, b) => a - b);
    const currentSnap = sorted[snapIndex];
    const windowH = window.innerHeight;

    // 닫힘 threshold: 가장 작은 snap 에서 60px 이상 아래로
    if (snapIndex === 0 && dragOffset > 60) {
      haptic.selection();
      setDragOffset(0);
      startY.current = null;
      onClose?.();
      return;
    }

    // 속도 기반 방향 snap
    if (speed > 200) {
      if (dragOffset < 0 && snapIndex < sorted.length - 1) {
        // 위로 빠르게 → 다음 snap
        haptic.selection();
        setSnapIndex(snapIndex + 1);
      } else if (dragOffset > 0 && snapIndex > 0) {
        // 아래로 빠르게 → 이전 snap
        haptic.selection();
        setSnapIndex(snapIndex - 1);
      } else if (dragOffset > 0 && snapIndex === 0) {
        // 가장 작은 snap 에서 아래로 빠르게 → 닫힘
        haptic.selection();
        setDragOffset(0);
        startY.current = null;
        onClose?.();
        return;
      }
      setDragOffset(0);
      startY.current = null;
      return;
    }

    // 위치 기반: 현재 실제 vh 위치 계산 후 가장 가까운 snap 으로
    // currentSnap 에서 dragOffset 만큼 이동 → 새로운 vh 위치
    const currentVh = currentSnap; // sheet 높이 vh
    // dragOffset 이 음수면 sheet 가 커지는 것 (위로 드래그)
    // 즉 남은 빈 공간이 줄어듦 → 실제 표시 높이는 currentVh + (-dragOffset / windowH * 100)
    const newVh = currentVh + (-dragOffset / windowH * 100);

    let closestIdx = 0;
    let closestDist = Infinity;
    sorted.forEach((sp, i) => {
      const dist = Math.abs(sp - newVh);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx !== snapIndex) {
      haptic.selection();
    }
    setSnapIndex(closestIdx);
    setDragOffset(0);
    startY.current = null;
  };

  // ── 레거시 모드 드래그 핸들러 ─────────────────────────────────────────────
  const onTouchStart = (e) => {
    const el = sheetRef.current;
    startedAtTop.current = el ? el.scrollTop <= 0 : true;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current == null || !startedAtTop.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) {
      onClose?.();
    }
    setDragY(0);
    startY.current = null;
  };

  // ── 레거시 size 클래스 ─────────────────────────────────────────────────────
  const sizeClass = {
    auto: 'max-h-[85dvh]',
    half: 'h-[50dvh]',
    full: 'h-[92dvh]',
  }[size] || 'max-h-[85dvh]';

  // ── snapPoints 모드: 시트 높이 + transform 계산 ───────────────────────────
  const sorted = hasSnaps ? [...snapPoints].sort((a, b) => a - b) : [];
  const activeVh = hasSnaps ? sorted[snapIndex] : null;

  // transform: 드래그 중이면 dragOffset 반영, 아니면 snap 위치
  // 닫힌 상태면 100% (화면 밖)
  let sheetStyle;
  if (hasSnaps) {
    const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;
    // translateY: 드래그 오프셋만 사용 (높이는 height 로 제어)
    const ty = open ? dragOffset : windowH;
    const isAnimating = dragOffset === 0;
    sheetStyle = {
      height: `${activeVh}dvh`,
      transform: `translateY(${open ? dragOffset : windowH}px)`,
      transition: isAnimating && open
        ? 'transform 320ms cubic-bezier(0.3,0,0,1), height 320ms cubic-bezier(0.3,0,0,1)'
        : dragOffset !== 0
        ? 'none'
        : 'transform 320ms cubic-bezier(0.3,0,0,1), height 320ms cubic-bezier(0.3,0,0,1)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    };
  } else {
    sheetStyle = {
      transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
      transition: dragY > 0 ? 'none' : 'transform 0.25s ease-out',
      paddingBottom: 'env(safe-area-inset-bottom)',
    };
  }

  const touchHandlers = hasSnaps
    ? {
        onTouchStart: onSnapTouchStart,
        onTouchMove: onSnapTouchMove,
        onTouchEnd: onSnapTouchEnd,
        onTouchCancel: onSnapTouchEnd,
      }
    : {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: onTouchEnd,
      };

  return (
    <>
      {/* 백드롭 */}
      <div
        className={[
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* 시트 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '바텀시트'}
        className={[
          'fixed left-0 right-0 bottom-0 z-50',
          'bg-theme-card border-t border-theme-border',
          'rounded-t-2xl shadow-2xl',
          'flex flex-col',
          hasSnaps ? '' : sizeClass,
        ].join(' ')}
        style={sheetStyle}
      >
        {/* 드래그 핸들 + 헤더 */}
        <div
          className="shrink-0 h-8 flex flex-col justify-start px-4"
          {...touchHandlers}
        >
          {showHandle && (
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2" />
          )}
          {title && (
            <div className="text-center text-white font-bold text-[15px] py-1 mt-1">
              {title}
            </div>
          )}
        </div>

        {/* 본문 */}
        <div
          ref={sheetRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
        >
          {children}
        </div>
      </div>
    </>
  );
}
