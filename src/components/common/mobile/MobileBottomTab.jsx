import { useState, useEffect } from 'react';
import haptic from '@/lib/haptic';
import { cx, motion } from '@/lib/motion';

/**
 * 모바일 하단 탭 네비게이션
 *
 * @param {object} props
 * @param {Array<{key:string, label:string, icon:React.ReactNode, onClick?:()=>void, active?:boolean, badge?:number|string}>} props.items
 * @param {boolean} [props.hapticOnChange=true] — 탭 전환 시 haptic.selection() 호출
 * @param {boolean} [props.blurBg=true] — tabbar-blur 반투명 배경 사용
 * @param {string}  [props.className]
 */
export default function MobileBottomTab({
  items = [],
  hapticOnChange = true,
  blurBg = true,
  className = '',
}) {
  // 현재 active 키 추적 (스프링 애니메이션 트리거용)
  const activeKey = items.find((it) => it.active)?.key ?? null;
  const [springKey, setSpringKey] = useState(null);
  const [prevActiveKey, setPrevActiveKey] = useState(activeKey);

  useEffect(() => {
    if (activeKey !== prevActiveKey) {
      if (hapticOnChange) haptic.selection();
      setSpringKey(activeKey);
      setPrevActiveKey(activeKey);
    }
  }, [activeKey, prevActiveKey, hapticOnChange]);

  function handleAnimationEnd(key) {
    if (springKey === key) setSpringKey(null);
  }

  return (
    <nav
      className={cx(
        'md:hidden',
        'fixed bottom-0 left-0 right-0 z-tab',
        blurBg ? 'tabbar-blur' : 'bg-theme-sidebar',
        'border-t border-theme-border/50',
        'pb-safe',
        className,
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="tablist"
    >
      <ul className="h-tab-h flex items-stretch">
        {items.map((it) => {
          const active = !!it.active;
          const isSpring = springKey === it.key;
          const hasBadge = it.badge !== undefined && it.badge !== null && it.badge !== false;
          const badgeIsNumber = typeof it.badge === 'number' || (typeof it.badge === 'string' && it.badge !== '.');

          return (
            <li key={it.key} className="flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={it.label}
                onClick={it.onClick}
                className={cx(
                  'w-full h-full flex flex-col items-center justify-center gap-0.5',
                  'relative transition-opacity duration-[150ms]',
                  active ? 'opacity-100 text-theme-primary' : 'opacity-[0.55] text-theme-secondary hover:opacity-80 active:opacity-70',
                )}
              >
                {/* 아이콘 + 배지 래퍼 */}
                <span
                  className={cx(
                    'relative flex items-center justify-center',
                    motion(isSpring ? 'animate-tab-spring' : ''),
                  )}
                  onAnimationEnd={() => handleAnimationEnd(it.key)}
                >
                  {it.icon}

                  {/* 배지 */}
                  {hasBadge && badgeIsNumber && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                      {it.badge}
                    </span>
                  )}
                  {hasBadge && !badgeIsNumber && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </span>

                {/* 라벨 */}
                <span
                  className={cx(
                    'text-[10px] font-semibold leading-none mt-1',
                    motion(isSpring ? 'animate-tab-spring' : ''),
                  )}
                  onAnimationEnd={() => handleAnimationEnd(it.key)}
                >
                  {it.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
