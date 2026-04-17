import { useEffect, useState } from 'react';

// 전역 toast 이벤트 시스템
const listeners = new Set();

/**
 * showToast(msg, options)
 *
 * @param {string} msg
 * @param {'default'|'success'|'error'|'warning'|'info'} [variant]
 * @param {{ label: string, onPress: function }} [action]
 *
 * 하위 호환: 두 번째 인자로 문자열 type 도 허용 (기존 showToast(msg, 'success'))
 */
export const showToast = (msg, variantOrLegacyType = 'default', action = undefined) => {
  // 레거시 호환: 두 번째 인자가 문자열이면 variant 로 처리
  const variant = typeof variantOrLegacyType === 'string' ? variantOrLegacyType : 'default';
  listeners.forEach(fn => fn({ msg, variant, action }));
};

export const useToast = () => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handler = (t) => {
      setToast(t);
      setTimeout(() => setToast(null), 3000);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  return toast;
};

// variant → 이모지 아이콘
const ICON_MAP = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
  // 레거시 type 키 매핑
  warn:    '⚠️',
};

const Toast = () => {
  const toast = useToast();
  if (!toast) return null;

  const icon = ICON_MAP[toast.variant] ?? null;

  return (
    <div
      className={[
        'fixed left-4 right-4 z-[var(--z-toast,9999)]',
        'bottom-[calc(var(--tab-h,56px)+env(safe-area-inset-bottom,0px)+12px)]',
        'animate-sheet-in pointer-events-auto',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center px-4 py-3',
          'bg-theme-card border border-theme-border rounded-card shadow-e3',
        ].join(' ')}
      >
        {/* 아이콘 */}
        {icon && (
          <span className="shrink-0 mr-2 text-base leading-none">{icon}</span>
        )}

        {/* 메시지 */}
        <span className="flex-1 text-sm text-white">{toast.msg}</span>

        {/* action 버튼 */}
        {toast.action && (
          <button
            type="button"
            className="text-theme-primary text-sm font-semibold ml-3 shrink-0"
            onClick={() => {
              toast.action.onPress?.();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
