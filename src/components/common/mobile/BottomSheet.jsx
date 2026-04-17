import { useEffect, useRef, useState } from 'react';

/**
 * 모바일 바텀시트 — 스와이프 다운으로 닫기 지원
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} props.children
 * @param {'auto'|'half'|'full'} props.size
 * @param {boolean} props.showHandle
 * @param {boolean} props.closeOnBackdrop
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = 'auto',
  showHandle = true,
  closeOnBackdrop = true,
}) {
  const sheetRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);
  const startedAtTop = useRef(false);

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

  // open 변경 시 드래그 상태 초기화
  useEffect(() => { if (!open) setDragY(0); }, [open]);

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

  const sizeClass = {
    auto: 'max-h-[85dvh]',
    half: 'h-[50dvh]',
    full: 'h-[92dvh]',
  }[size] || 'max-h-[85dvh]';

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

      {/* 시트 — transform은 style 단독 관리 (Tailwind translate와 충돌 방지) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '바텀시트'}
        className={[
          'fixed left-0 right-0 bottom-0 z-50',
          'bg-theme-card border-t border-theme-border',
          'rounded-t-2xl shadow-2xl',
          'flex flex-col',
          sizeClass,
          'pb-safe',
        ].join(' ')}
        style={{
          transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragY > 0 ? 'none' : 'transform 0.25s ease-out',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 드래그 핸들 + 헤더 (드래그 영역) */}
        <div
          className="shrink-0 pt-2 pb-1 px-4"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {showHandle && (
            <div className="mx-auto mb-2 w-10 h-1.5 rounded-full bg-white/20" />
          )}
          {title && (
            <div className="text-center text-white font-bold text-[15px] py-1">
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
