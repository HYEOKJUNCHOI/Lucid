import { useEffect, useState } from 'react';

// 전역 toast 이벤트 시스템
const listeners = new Set();

export const showToast = (msg, type = 'success') => {
  listeners.forEach(fn => fn({ msg, type }));
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

const ICONS = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

const STYLES = {
  success: {
    bg: 'rgba(17,34,28,0.92)',
    border: 'rgba(78,201,176,0.35)',
    color: '#4ec9b0',
  },
  warn: {
    bg: 'rgba(34,26,10,0.92)',
    border: 'rgba(251,191,36,0.35)',
    color: '#fbbf24',
  },
  error: {
    bg: 'rgba(34,10,10,0.92)',
    border: 'rgba(239,68,68,0.35)',
    color: '#f87171',
  },
};

const Toast = () => {
  const toast = useToast();
  if (!toast) return null;
  const s = STYLES[toast.type] || STYLES.success;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in pointer-events-none">
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border text-sm font-semibold"
        style={{ background: s.bg, borderColor: s.border, color: s.color }}
      >
        {ICONS[toast.type]}
        {toast.msg}
      </div>
    </div>
  );
};

export default Toast;
