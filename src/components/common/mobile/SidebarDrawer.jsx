import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * 모바일 좌측 서랍 메뉴 — 햄버거 버튼으로 열고 오버레이 탭/ESC로 닫음
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} props.header
 * @param {'left'|'right'} props.side
 * @param {string} props.widthClass - 예: 'w-[280px]'
 */
export default function SidebarDrawer({
  open,
  onClose,
  children,
  header,
  side = 'left',
  widthClass = 'w-[280px]',
}) {
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

  const isLeft = side === 'left';

  return (
    <>
      {/* 오버레이 */}
      <div
        className={[
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 서랍 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="내비게이션 메뉴"
        className={[
          'fixed top-0 bottom-0 z-50',
          isLeft ? 'left-0 border-r' : 'right-0 border-l',
          'border-theme-border',
          widthClass,
          'max-w-[85vw]',
          'bg-theme-sidebar',
          'flex flex-col',
          'transition-transform duration-300 ease-out',
          open
            ? 'translate-x-0'
            : isLeft ? '-translate-x-full' : 'translate-x-full',
          'pt-safe pb-safe',
        ].join(' ')}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 h-topbar-h border-b border-theme-border shrink-0">
          <div className="flex-1 min-w-0 font-bold text-white">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="touch-target flex items-center justify-center rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-theme-icon"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </aside>
    </>
  );
}
