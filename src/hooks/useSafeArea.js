import { useEffect, useState } from 'react';

/**
 * CSS env(safe-area-inset-*) 값을 숫자(px)로 반환
 * 노치/홈 인디케이터 대응용
 */
export function useSafeArea() {
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const read = () => {
      const probe = document.createElement('div');
      probe.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        pointer-events: none;
        visibility: hidden;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      `;
      document.body.appendChild(probe);
      const cs = window.getComputedStyle(probe);
      const next = {
        top: parseFloat(cs.paddingTop) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
        right: parseFloat(cs.paddingRight) || 0,
      };
      document.body.removeChild(probe);
      setInsets(next);
    };

    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  return insets;
}

export default useSafeArea;
