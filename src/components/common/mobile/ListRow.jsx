/**
 * ListRow — iOS 설정앱 스타일 리스트 아이템
 *
 * @param {object}         props
 * @param {string|React.ReactNode} [props.icon]
 * @param {string}         props.label
 * @param {string}         [props.sublabel]
 * @param {string|React.ReactNode} [props.value]
 * @param {boolean}        [props.chevron=false]
 * @param {function}       [props.onPress]
 * @param {boolean}        [props.destructive=false]
 * @param {boolean}        [props.disabled=false]
 * @param {string}         [props.className]
 */
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

export default function ListRow({
  icon,
  label,
  sublabel,
  value,
  chevron = false,
  onPress,
  destructive = false,
  disabled = false,
  className = '',
}) {
  const handlePress = () => {
    if (disabled) return;
    haptic.tap();
    onPress?.();
  };

  return (
    <div
      role={onPress ? 'button' : undefined}
      tabIndex={onPress && !disabled ? 0 : undefined}
      onClick={onPress ? handlePress : undefined}
      onKeyDown={onPress ? (e) => { if (e.key === 'Enter' || e.key === ' ') handlePress(); } : undefined}
      className={cx(
        'pressable flex items-center gap-3 px-4 py-3 bg-theme-card list-row-divider',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      {icon && (
        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0">
          {icon}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className={cx(
          'block text-sm font-medium',
          destructive ? 'text-red-400' : 'text-white',
        )}>
          {label}
        </span>
        {sublabel && (
          <span className="block text-xs text-gray-400 mt-0.5">{sublabel}</span>
        )}
      </span>

      {value !== undefined && value !== null && (
        <span className="text-sm text-gray-400 shrink-0">{value}</span>
      )}

      {chevron && (
        <span className="text-gray-500 text-xs shrink-0">›</span>
      )}
    </div>
  );
}
