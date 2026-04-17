import { FiMenu, FiChevronLeft } from 'react-icons/fi';

/**
 * 모바일 상단바 — 햄버거 / 뒤로가기 + 타이틀 + 우측 액션
 *
 * @param {object} props
 * @param {'menu'|'back'|null} props.leading - 왼쪽 아이콘 타입
 * @param {() => void} props.onLeadingClick
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} props.right - 우측 영역 (알림/프로필 등)
 * @param {string} props.className
 */
export default function MobileTopBar({
  leading = 'menu',
  onLeadingClick,
  title,
  right,
  className = '',
}) {
  return (
    <header
      className={[
        'md:hidden',
        'fixed top-0 left-0 right-0 z-40',
        'bg-theme-sidebar/95 backdrop-blur',
        'border-b border-theme-border',
        'flex items-center px-3 gap-2',
        className,
      ].join(' ')}
      style={{
        // 총 높이 = safe-area + 48px (탑바 콘텐츠 영역)
        height: 'calc(env(safe-area-inset-top) + 48px)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {leading && (
        <button
          type="button"
          onClick={onLeadingClick}
          aria-label={leading === 'back' ? '뒤로가기' : '메뉴 열기'}
          className="touch-target flex items-center justify-center rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-theme-icon"
        >
          {leading === 'back' ? <FiChevronLeft size={24} /> : <FiMenu size={22} />}
        </button>
      )}

      <div className="flex-1 min-w-0 text-center text-[15px] font-bold text-white truncate">
        {title}
      </div>

      <div className="min-w-[44px] flex items-center justify-end gap-1">
        {right}
      </div>
    </header>
  );
}
