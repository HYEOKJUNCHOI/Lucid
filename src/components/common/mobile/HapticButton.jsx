/**
 * HapticButton — 햅틱 피드백을 포함한 모바일 기본 버튼
 *
 * @param {object}   props
 * @param {function} props.onClick
 * @param {function} [props.onLongPress]
 * @param {'tap'|'success'|'error'|'warning'|'heavy'|'selection'|'none'} [props.hapticType='tap']
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='ghost']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.loading]
 * @param {string}   [props.className]
 * @param {React.ReactNode} props.children
 * @param {'button'|'div'} [props.as='button']
 */
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const VARIANT_CLASSES = {
  primary:   'bg-theme-primary text-theme-bg',
  secondary: 'bg-theme-card border border-theme-border text-white',
  ghost:     'text-theme-primary hover:bg-theme-primary/10 md:hover:bg-theme-primary/10',
  danger:    'text-red-400 hover:bg-red-400/10',
};

export default function HapticButton({
  onClick,
  onLongPress,
  hapticType = 'tap',
  variant = 'ghost',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  children,
  as: Tag = 'button',
}) {
  const handleClick = (e) => {
    if (disabled || loading) return;
    if (hapticType !== 'none') haptic[hapticType]?.();
    onClick?.(e);
  };

  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={handleClick}
      className={cx(
        'pressable touch-target inline-flex items-center justify-center font-semibold rounded-lg select-none',
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.ghost,
        (disabled || loading) && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      {loading ? <span className="animate-spin">⏳</span> : children}
    </Tag>
  );
}
