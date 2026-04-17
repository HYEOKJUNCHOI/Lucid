import { useRef, useCallback, useEffect } from 'react';

/**
 * iOS 스타일 꾹누름(long press) 감지 훅
 *
 * 사용:
 * ```jsx
 * const bind = useLongPress(() => setEditMode(true), { delay: 500 });
 * return <div {...bind}>아이콘</div>;
 * ```
 *
 * @param {() => void} onLongPress - 꾹누름 발동 콜백
 * @param {object} [opts]
 * @param {number} [opts.delay=500] - 꾹누름 판정 시간(ms). iOS 기본값 500ms
 * @param {number} [opts.moveThreshold=10] - 이 px 이상 움직이면 취소
 * @param {boolean} [opts.hapticOnTrigger=true] - 발동 시 햅틱 피드백
 * @param {() => void} [opts.onStart] - 눌리기 시작 시
 * @param {() => void} [opts.onCancel] - 취소됐을 때 (움직이거나 일찍 떼면)
 * @returns {object} 바인딩할 이벤트 핸들러들
 */
export default function useLongPress(onLongPress, {
  delay = 500,
  moveThreshold = 10,
  hapticOnTrigger = true,
  onStart,
  onCancel,
} = {}) {
  const timerRef = useRef(null);
  const startPosRef = useRef(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((e) => {
    // 우클릭/보조 버튼은 무시
    if (e.type === 'mousedown' && e.button !== 0) return;

    triggeredRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPosRef.current = { x: point.clientX, y: point.clientY };

    onStart?.();

    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      // iOS 햅틱 피드백 (지원하는 기기에서만)
      if (hapticOnTrigger && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch { /* ignore */ }
      }
      onLongPress();
    }, delay);
  }, [delay, hapticOnTrigger, onLongPress, onStart]);

  const move = useCallback((e) => {
    if (!startPosRef.current || !timerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPosRef.current.x;
    const dy = point.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > moveThreshold) {
      clear();
      onCancel?.();
    }
  }, [clear, moveThreshold, onCancel]);

  const end = useCallback(() => {
    clear();
    if (!triggeredRef.current) onCancel?.();
    startPosRef.current = null;
  }, [clear, onCancel]);

  // 언마운트 시 타이머 정리
  useEffect(() => () => clear(), [clear]);

  return {
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: end,
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: end,
    onContextMenu: (e) => e.preventDefault(), // 길게 누르기 시 브라우저 컨텍스트 메뉴 차단
  };
}
