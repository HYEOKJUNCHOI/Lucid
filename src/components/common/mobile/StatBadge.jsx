/**
 * StatBadge — 스트릭/XP/원두 등 스탯 뱃지 + 팝오버
 *
 * @param {object}         props
 * @param {string|React.ReactNode} props.icon
 * @param {string|number}  props.value
 * @param {string}         props.label
 * @param {string}         [props.detail]
 * @param {'teal'|'yellow'|'orange'|'red'|'blue'|'green'} [props.color='teal']
 * @param {function}       [props.onClick]
 * @param {'bottom'|'top'} [props.popoverSide='bottom']
 */
import { useState, useEffect, useRef } from 'react';
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

const COLOR_CLASSES = {
  teal:   'text-theme-primary',
  yellow: 'text-yellow-400',
  orange: 'text-orange-400',
  red:    'text-red-400',
  blue:   'text-blue-400',
  green:  'text-green-400',
};

export default function StatBadge({
  icon,
  value,
  label,
  detail,
  color = 'teal',
  onClick,
  popoverSide = 'bottom',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  const handlePress = (e) => {
    haptic.tap();
    setIsOpen((prev) => !prev);
    onClick?.(e);
  };

  const popoverPositionClass = popoverSide === 'top'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={handlePress}
        className={cx('stat-badge', COLOR_CLASSES[color] ?? COLOR_CLASSES.teal)}
      >
        <span>{icon}</span>
        <span>{value}</span>
      </button>

      {isOpen && (
        <div
          className={cx(
            'absolute left-1/2 -translate-x-1/2 z-overlay',
            'bg-theme-card border border-theme-border rounded-card p-3',
            'text-sm text-white w-52 shadow-e3',
            popoverPositionClass,
          )}
        >
          {label && (
            <p className="font-semibold mb-1 text-theme-primary text-xs">{label}</p>
          )}
          {detail && (
            <p className="text-xs text-gray-300 leading-relaxed">{detail}</p>
          )}
        </div>
      )}
    </div>
  );
}
