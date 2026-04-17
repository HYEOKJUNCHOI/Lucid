import BottomSheet from './BottomSheet';
import haptic from '@/lib/haptic';
import { cx } from '@/lib/motion';
import { useEffect } from 'react';

/**
 * iOS 스타일 액션시트
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} [props.title]
 * @param {string} [props.message]
 * @param {Array<{label: string, icon?: string, onPress: function, destructive?: boolean, disabled?: boolean}>} props.actions
 * @param {string} [props.cancelLabel]
 */
export default function ActionSheet({
  isOpen,
  onClose,
  title,
  message,
  actions = [],
  cancelLabel = '취소',
}) {
  // 열릴 때 selection 햅틱
  useEffect(() => {
    if (isOpen) haptic.selection();
  }, [isOpen]);

  const handleAction = (action) => {
    if (action.disabled) return;
    haptic.tap();
    action.onPress?.();
    onClose?.();
  };

  const handleCancel = () => {
    haptic.tap();
    onClose?.();
  };

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      size="auto"
      showHandle={true}
      closeOnBackdrop={true}
    >
      <div className="flex flex-col pb-2">
        {/* 제목 + 메시지 영역 */}
        {(title || message) && (
          <div className="border-b border-theme-border mb-1">
            {title && (
              <p className="text-sm font-semibold text-white text-center px-6 pt-4 pb-1">
                {title}
              </p>
            )}
            {message && (
              <p className="text-xs text-gray-400 text-center px-6 pb-3">
                {message}
              </p>
            )}
          </div>
        )}

        {/* 액션 목록 */}
        <div className="flex flex-col">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              className={cx(
                'flex items-center gap-3 px-6 py-4 text-base font-medium',
                'border-b border-theme-border last:border-0',
                'active:bg-white/5 transition-colors duration-[100ms]',
                action.destructive ? 'text-red-400' : 'text-white',
                action.disabled ? 'opacity-40 pointer-events-none' : '',
              )}
            >
              {action.icon && (
                <span className="text-lg shrink-0">{action.icon}</span>
              )}
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* 취소 버튼 */}
        <button
          onClick={handleCancel}
          className="mt-2 w-full py-4 text-center text-base font-semibold text-theme-primary bg-theme-card rounded-2xl active:opacity-70 transition-opacity duration-[100ms]"
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
