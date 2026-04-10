import { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect — 라운드 드롭다운
 * props: value, onChange, options: [{ value, label }], className
 */
const CustomSelect = ({ value, onChange, options = [], className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* 트리거 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-[#111] border border-[#4ec9b0]/40 text-white text-sm rounded-xl px-4 py-2.5 hover:border-[#569cd6]/70 focus:outline-none focus:border-[#569cd6]/80 transition-all"
      >
        <span className="truncate">{selected?.label ?? '선택'}</span>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06] ${
                opt.value === value
                  ? 'text-[#4ec9b0] bg-[#4ec9b0]/[0.06]'
                  : 'text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
