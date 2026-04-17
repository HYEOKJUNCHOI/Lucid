/**
 * 모바일 하단 탭 네비게이션
 *
 * @param {object} props
 * @param {Array<{key:string, label:string, icon:React.ReactNode, onClick?:()=>void, active?:boolean, badge?:React.ReactNode}>} props.items
 * @param {string} props.className
 */
export default function MobileBottomTab({ items = [], className = '' }) {
  return (
    <nav
      className={[
        'md:hidden',
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-theme-sidebar/95 backdrop-blur',
        'border-t border-theme-border',
        'pb-safe',
        className,
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="tablist"
    >
      <ul className="h-tab-h flex items-stretch">
        {items.map((it) => {
          const active = !!it.active;
          return (
            <li key={it.key} className="flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={it.label}
                onClick={it.onClick}
                className={[
                  'w-full h-full flex flex-col items-center justify-center gap-0.5',
                  'relative transition-colors',
                  active
                    ? 'text-theme-primary'
                    : 'text-theme-secondary hover:text-white active:text-white',
                ].join(' ')}
              >
                {it.badge && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {it.badge}
                  </span>
                )}
                <span className="flex items-center justify-center">{it.icon}</span>
                <span className="text-[10px] font-semibold leading-none mt-1">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
