import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * iOS 홈화면 편집 모드 Context
 *
 * - 한 번에 하나의 편집 세션만 활성화 (여러 섹션이 동시에 떨지 않도록 key 기반)
 * - 빈 공간 탭, ESC, 또는 `exitEditMode()` 호출로 종료
 *
 * 사용:
 * ```jsx
 * <EditModeProvider>
 *   <App />
 * </EditModeProvider>
 *
 * // 내부 컴포넌트에서:
 * const { editMode, enterEditMode, exitEditMode } = useEditMode();
 * const bind = useLongPress(() => enterEditMode('chapter-list'));
 * const isEditing = editMode === 'chapter-list';
 * ```
 */
const EditModeContext = createContext({
  editMode: null,
  enterEditMode: () => {},
  exitEditMode: () => {},
});

export function EditModeProvider({ children }) {
  const [editMode, setEditMode] = useState(null); // null | string(key)

  const enterEditMode = useCallback((key) => setEditMode(key || 'default'), []);
  const exitEditMode = useCallback(() => setEditMode(null), []);

  // ESC로 편집 모드 종료
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e) => { if (e.key === 'Escape') exitEditMode(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, exitEditMode]);

  // 빈 공간 탭으로 종료 (body click, 단 편집 UI는 stopPropagation 필요)
  useEffect(() => {
    if (!editMode) return;
    const onDocClick = (e) => {
      // data-edit-ignore 속성이 있는 요소는 무시 (편집 UI 자체)
      let el = e.target;
      while (el && el !== document.body) {
        if (el.dataset?.editIgnore === 'true') return;
        el = el.parentElement;
      }
      exitEditMode();
    };
    // 살짝 지연시켜 편집 진입 당시의 mouseup이 곧바로 발동하지 않도록
    const timer = setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('touchstart', onDocClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [editMode, exitEditMode]);

  return (
    <EditModeContext.Provider value={{ editMode, enterEditMode, exitEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}

/**
 * 흔들리는 래퍼 — 편집 모드에서 지정된 키가 활성화됐을 때 jiggle
 *
 * @param {object} props
 * @param {string} props.forKey - 이 키가 활성 editMode와 일치해야 떨림
 * @param {'a'|'b'} [props.variant='a'] - a/b 번갈아 써서 자연스럽게
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function JiggleWrap({ forKey, variant = 'a', children, className = '' }) {
  const { editMode } = useEditMode();
  const active = editMode === forKey;
  const animClass = active
    ? (variant === 'b' ? 'animate-ios-jiggle-alt' : 'animate-ios-jiggle')
    : '';
  return (
    <div
      className={`${className} ${animClass}`}
      style={{ transformOrigin: 'center center' }}
      data-edit-ignore={active ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

/**
 * 삭제 뱃지 — 편집 모드일 때 좌상단에 iOS 스타일 (-) 버튼 표시
 *
 * @param {object} props
 * @param {string} props.forKey
 * @param {() => void} props.onDelete
 * @param {'top-left'|'top-right'} [props.position='top-left']
 */
export function DeleteBadge({ forKey, onDelete, position = 'top-left' }) {
  const { editMode } = useEditMode();
  if (editMode !== forKey) return null;

  const posClass = position === 'top-right'
    ? '-top-1.5 -right-1.5'
    : '-top-1.5 -left-1.5';

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      data-edit-ignore="true"
      aria-label="삭제"
      className={[
        'absolute', posClass,
        'w-6 h-6 rounded-full',
        'bg-white text-black',
        'flex items-center justify-center',
        'shadow-[0_2px_6px_rgba(0,0,0,0.4)]',
        'border border-black/10',
        'z-10',
        'active:scale-95 transition-transform',
      ].join(' ')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
  );
}
