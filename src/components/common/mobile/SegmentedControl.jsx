/**
 * SegmentedControl — iOS 스타일 pill segmented control
 *
 * @param {object}   props
 * @param {Array<{ id: string, label: string, icon?: string }>} props.items
 * @param {string}   props.value          현재 선택된 id
 * @param {function} props.onChange       (id: string) => void
 * @param {string}   [props.className]
 * @param {'sm'|'md'} [props.size='md']
 */
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

export default function SegmentedControl({
  items = [],
  value,
  onChange,
  className = '',
  size = 'md',
}) {
  const activeIdx = items.findIndex((item) => item.id === value);
  const safeIdx = activeIdx < 0 ? 0 : activeIdx;

  const handleSelect = (id) => {
    if (id === value) return;
    haptic.selection();
    onChange?.(id);
  };

  return (
    <div className={cx('segmented-track flex relative w-full', className)}>
      {/* 슬라이딩 thumb */}
      <div
        className="segmented-thumb absolute inset-y-[2px] pointer-events-none"
        style={{
          width: `calc(100% / ${items.length})`,
          transform: `translateX(${safeIdx * 100}%)`,
        }}
      />

      {/* 탭 버튼들 */}
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            className={cx(
              'relative z-10 flex-1 flex items-center justify-center gap-1 rounded-[999px] font-medium transition-colors duration-150',
              size === 'sm' ? 'text-xs py-1' : 'text-sm py-1.5',
              isActive ? 'text-theme-primary' : 'text-gray-400',
            )}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
