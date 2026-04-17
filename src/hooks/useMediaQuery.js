import { useEffect, useState } from 'react';

/**
 * CSS Media Query 상태를 구독하는 훅
 * @param {string} query - 예: '(min-width: 768px)'
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const getMatch = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    setMatches(mql.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      // Safari <14 fallback
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/** 모바일(<768px) */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
/** 태블릿(768~1023) */
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
/** 데스크탑(>=1024) */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
/** 터치 디바이스 */
export const useIsTouch = () => useMediaQuery('(hover: none) and (pointer: coarse)');
/** 애니메이션 감소 선호 */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/**
 * 3구간 디바이스 타입 반환
 * @returns {'mobile'|'tablet'|'desktop'}
 */
export function useDeviceType() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

export default useMediaQuery;
