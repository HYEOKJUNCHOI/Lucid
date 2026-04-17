import { useEffect, useRef, useState } from 'react';
import { FiMenu, FiChevronLeft, FiX } from 'react-icons/fi';
import { cx, transitions } from '@/lib/motion';

/**
 * 모바일 상단바 — 햄버거 / 뒤로가기 / 닫기 + 타이틀 + 우측 액션
 * largeTitle 모드: 스크롤 감지 후 compact(56px)로 축소
 *
 * @param {object} props
 * @param {'menu'|'back'|'close'|React.ReactNode} props.leading
 * @param {() => void}       props.onLeadingClick
 * @param {string}           props.title
 * @param {string}           [props.subtitle]      - largeTitle 모드에서만 표시
 * @param {React.ReactNode}  [props.actions]        - 우측 영역 (= 기존 right)
 * @param {React.ReactNode}  [props.right]          - 하위 호환: actions 대신 사용 가능
 * @param {boolean}          [props.largeTitle]     - true: 96px 확장 + scrollAware 축소
 * @param {React.RefObject}  [props.scrollRef]      - largeTitle 스크롤 감시 대상 (null→window)
 * @param {boolean}          [props.blurBg]         - appbar-blur 클래스 적용 (기본 true)
 * @param {boolean}          [props.transparent]    - 투명 배경 (splash/hero용)
 * @param {string}           [props.className]
 */
export default function MobileTopBar({
  leading = 'menu',
  onLeadingClick,
  title,
  subtitle,
  actions,
  right,           // 하위 호환 alias
  largeTitle = false,
  scrollRef = null,
  blurBg = true,
  transparent = false,
  className = '',
}) {
  const [compact, setCompact] = useState(false);

  // largeTitle 모드: 스크롤 구독
  useEffect(() => {
    if (!largeTitle) return;

    const target = scrollRef?.current ?? window;
    const getScrollY = () =>
      scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY;

    const handleScroll = () => {
      setCompact(getScrollY() > 16);
    };

    // 초기 상태 동기화
    handleScroll();

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [largeTitle, scrollRef]);

  // compact 상태에 따른 높이
  const heightClass = largeTitle && !compact ? 'h-appbar-large-h' : 'h-appbar-h';

  // 배경 클래스
  const bgClass = transparent
    ? 'bg-transparent'
    : blurBg
    ? 'appbar-blur border-b border-theme-border'
    : 'bg-theme-bg border-b border-theme-border';

  // leading 아이콘 렌더
  const renderLeading = () => {
    if (!leading) return null;
    if (leading === 'back') {
      return <FiChevronLeft size={24} />;
    }
    if (leading === 'close') {
      return <FiX size={22} />;
    }
    if (leading === 'menu') {
      return <FiMenu size={22} />;
    }
    // ReactNode
    return leading;
  };

  const ariaLabel =
    leading === 'back' ? '뒤로가기' : leading === 'close' ? '닫기' : '메뉴 열기';

  // actions 우선, 없으면 하위 호환 right 사용
  const rightSlot = actions ?? right;

  return (
    <header
      className={cx(
        'md:hidden',
        'fixed top-0 left-0 right-0 z-appbar',
        bgClass,
        'flex flex-col justify-end',
        transitions.base,
        heightClass,
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* compact 행 — 항상 존재, largeTitle+compact 아닐 때도 타이틀 표시 */}
      <div className="flex items-center px-3 gap-2 h-appbar-h shrink-0">
        {leading && (
          <button
            type="button"
            onClick={onLeadingClick}
            aria-label={typeof leading === 'string' ? ariaLabel : undefined}
            className="touch-target flex items-center justify-center rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-theme-icon"
          >
            {renderLeading()}
          </button>
        )}

        {/* compact 타이틀: largeTitle 모드 + compact 상태이거나, largeTitle 아닐 때 */}
        <div
          className={cx(
            'flex-1 min-w-0 text-center truncate',
            transitions.base,
            largeTitle
              ? compact
                ? 'opacity-100 text-base font-semibold text-white'
                : 'opacity-0 pointer-events-none text-base font-semibold text-white'
              : 'text-[15px] font-bold text-white',
          )}
        >
          {title}
        </div>

        <div className="min-w-[44px] flex items-center justify-end gap-1">
          {rightSlot}
        </div>
      </div>

      {/* largeTitle 확장 영역 — compact 시 숨김 */}
      {largeTitle && (
        <div
          className={cx(
            'px-4 pb-3 shrink-0',
            transitions.base,
            compact ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100',
          )}
        >
          <div className="text-2xl font-bold text-white leading-tight">{title}</div>
          {subtitle && (
            <div className="text-sm text-theme-primary mt-0.5">{subtitle}</div>
          )}
        </div>
      )}
    </header>
  );
}
