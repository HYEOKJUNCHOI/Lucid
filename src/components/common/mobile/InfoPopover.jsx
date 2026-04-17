/**
 * InfoPopover — 통합 팝오버 컴포넌트 (클릭/탭 전용)
 *
 * @param {object}          props
 * @param {React.ReactNode} props.trigger   팝오버를 여는 트리거 요소
 * @param {string}          props.title     팝오버 헤더
 * @param {string|React.ReactNode} props.content  팝오버 본문
 * @param {'bottom'|'top'|'left'|'right'} [props.side='bottom']
 * @param {'start'|'center'|'end'} [props.align='center']
 * @param {string}          [props.maxWidth='200px']
 * @param {string}          [props.className]
 */
import { useState, useEffect, useRef } from 'react';
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';

const SIDE_CLASSES = {
  bottom: 'top-full mt-2',
  top: 'bottom-full mb-2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

const ALIGN_CLASSES = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
};

export default function InfoPopover({
  trigger,
  title,
  content,
  side = 'bottom',
  align = 'center',
  maxWidth = '200px',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    if (!isOpen) haptic.tap();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const isVertical = side === 'bottom' || side === 'top';

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* 트리거 */}
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>

      {/* 팝오버 */}
      {isOpen && (
        <div
          className={cx(
            'absolute z-overlay',
            'bg-theme-card border border-theme-border rounded-card p-3 shadow-e3',
            'animate-tab-fade',
            SIDE_CLASSES[side] ?? SIDE_CLASSES.bottom,
            isVertical ? (ALIGN_CLASSES[align] ?? ALIGN_CLASSES.center) : '',
            className,
          )}
          style={{ maxWidth }}
        >
          {title && (
            <p className="font-semibold text-xs text-theme-primary mb-1">{title}</p>
          )}
          {content && (
            <div className="text-xs text-gray-300 leading-relaxed">{content}</div>
          )}
        </div>
      )}
    </div>
  );
}
