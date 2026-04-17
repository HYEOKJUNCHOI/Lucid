import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * CodePeekButton
 * - 모바일 전용 "홀드 투 피크(hold-to-peek)" 코드 미리보기 버튼.
 * - 버튼을 누르고 있는 동안만 뒷배경에 코드가 풀스크린 오버레이로 나타남.
 * - 누른 상태에서 손가락을 위/아래로 드래그하면 코드가 손가락을 따라 스크롤 (1:1 tracking).
 * - 손을 떼면 오버레이가 사라지고 퀴즈 UI로 복귀.
 *
 * Props:
 *   code:      미리보기할 코드 문자열 (비어있으면 버튼 비활성화)
 *   language:  (optional) 언어명 — 현재는 단순 <pre> 렌더, 확장 여지용
 *   label:     (optional) 버튼 라벨
 *   className: (optional) 버튼 위치/스타일 오버라이드
 */
const CodePeekButton = ({
  code,
  language = 'java',
  label = '👁️ 코드 미리보기',
  className = '',
}) => {
  const [peeking, setPeeking] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  // 드래그 시작 시점 기준값
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);
  // 현재까지 누적된 scrollTop (peek이 끝나도 다음 번 시작 기준점은 새로 잡음)
  const scrollTopRef = useRef(0);
  // 오버레이 <pre> ref
  const codeContainerRef = useRef(null);

  const disabled = !code || !code.trim();

  // ─── 공용 헬퍼 ────────────────────────────────
  const getY = (e) => {
    if (e.touches && e.touches[0]) return e.touches[0].clientY;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientY;
    return e.clientY ?? 0;
  };

  const clampScroll = (value) => {
    const el = codeContainerRef.current;
    if (!el) return Math.max(0, value);
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return Math.max(0, Math.min(value, max));
  };

  // ─── 시작 (press down) ───────────────────────
  const handleStart = useCallback((e) => {
    if (disabled) return;
    // preventDefault로 스크롤/선택 기본 동작 차단
    if (e.cancelable) e.preventDefault();

    startYRef.current = getY(e);
    startScrollRef.current = scrollTopRef.current;
    setPeeking(true);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(8); } catch { /* noop */ }
    }
  }, [disabled]);

  // ─── 이동 (drag) ──────────────────────────────
  const handleMove = useCallback((e) => {
    if (!peeking) return;
    const currentY = getY(e);
    const dy = startYRef.current - currentY; // 위로 드래그 → 양수 → 아래로 스크롤
    // 1:1 tracking — 손가락 움직인 만큼 정확히 따라옴 (iOS pinch-zoom 느낌)
    const next = clampScroll(startScrollRef.current + dy);
    scrollTopRef.current = next;
    setScrollTop(next);
  }, [peeking]);

  // ─── 종료 (release / cancel) ──────────────────
  const handleEnd = useCallback(() => {
    if (!peeking) return;
    setPeeking(false);
    // scrollTop은 리셋하지 않음 — 다음 번 피크에서는 새 시작점으로 잡지만
    // 위치 자체는 유지하지 않는다고 했으므로 누적값만 보존 (startScrollRef가 매번 갱신)
  }, [peeking]);

  // ─── scrollTop → DOM 동기화 ───────────────────
  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop, peeking]);

  // peeking이 true가 되는 순간, 오버레이가 방금 렌더됐을 수 있으니 다음 tick에 scrollTop 재동기화
  useEffect(() => {
    if (peeking && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollTopRef.current;
    }
  }, [peeking]);

  // peeking 도중 전역 window 이벤트로 안전하게 end 처리 (버튼 밖으로 손가락이 나갔을 때)
  useEffect(() => {
    if (!peeking) return;
    const onGlobalEnd = () => handleEnd();
    window.addEventListener('touchend', onGlobalEnd);
    window.addEventListener('touchcancel', onGlobalEnd);
    window.addEventListener('mouseup', onGlobalEnd);
    return () => {
      window.removeEventListener('touchend', onGlobalEnd);
      window.removeEventListener('touchcancel', onGlobalEnd);
      window.removeEventListener('mouseup', onGlobalEnd);
    };
  }, [peeking, handleEnd]);

  // ─── 버튼 스타일 ─────────────────────────────
  const baseBtn =
    'fixed bottom-20 right-4 z-[10000] ' +
    'px-4 py-3 rounded-full ' +
    'bg-[#4ec9b0]/20 border border-[#4ec9b0]/50 text-[#4ec9b0] ' +
    'font-bold text-[12px] shadow-lg ' +
    'active:scale-95 select-none touch-none ' +
    'min-h-[48px] min-w-[120px] pointer-events-auto ' +
    (disabled ? 'opacity-40 cursor-not-allowed ' : '');

  return (
    <>
      {/* ─── 피크 오버레이 (peeking일 때만) ─── */}
      {peeking && (
        <div
          className="fixed inset-0 z-[9999] bg-[#0d1117] pointer-events-none"
          data-edit-ignore="true"
        >
          <pre
            ref={codeContainerRef}
            className="h-full overflow-hidden p-4 text-[12px] text-gray-300 font-mono whitespace-pre leading-relaxed"
          >
            {code}
          </pre>
        </div>
      )}

      {/* ─── 홀드 버튼 본체 ─── */}
      <button
        type="button"
        disabled={disabled}
        aria-label="누르고 있으면 코드 미리보기"
        data-edit-ignore="true"
        data-language={language}
        className={`${baseBtn} ${className}`}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {label}
      </button>
    </>
  );
};

export default CodePeekButton;
