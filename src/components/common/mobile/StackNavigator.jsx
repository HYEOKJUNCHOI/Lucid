import { createContext, useContext, useState, useCallback, useRef } from 'react';
import haptic from '@/lib/haptic';
import { cx, motion, variants } from '@/lib/motion';

// ─── Context ──────────────────────────────────────────────────────────────────
export const StackContext = createContext({
  push: () => {},
  pop: () => {},
  stackDepth: 1,
});

export function useStack() {
  return useContext(StackContext);
}

// ─── 애니메이션 상태 타입: 'push' | 'pop' | null
// ─── StackNavigator ───────────────────────────────────────────────────────────
/**
 * react-router-dom 과 독립적인 내부 화면 스택 관리 컴포넌트.
 * 탭 내부 서브-스크린 라우팅에 사용한다.
 *
 * @param {object} props
 * @param {React.ReactNode} props.initialScreen — 최초 화면
 * @param {string}          [props.className]
 */
export default function StackNavigator({ initialScreen, className = '' }) {
  const [stack, setStack] = useState([
    { key: '__initial__', component: initialScreen },
  ]);
  // 'push' | 'pop' | null — 현재 진행 중인 애니메이션 방향
  const [animDir, setAnimDir] = useState(null);
  // pop 중에 제거될 화면의 key
  const popTargetRef = useRef(null);

  const push = useCallback((component, key) => {
    setAnimDir('push');
    setStack((prev) => [...prev, { key, component }]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev; // 스택 깊이 1이면 pop 불가
      haptic.tap();
      const topKey = prev[prev.length - 1].key;
      popTargetRef.current = topKey;
      setAnimDir('pop');
      return prev; // 실제 제거는 애니메이션 종료 후
    });
  }, []);

  function handleAnimationEnd(key) {
    if (animDir === 'pop' && key === popTargetRef.current) {
      setStack((prev) => prev.slice(0, -1));
      popTargetRef.current = null;
      setAnimDir(null);
    } else if (animDir === 'push' && key === stack[stack.length - 1]?.key) {
      setAnimDir(null);
    }
  }

  const stackDepth = stack.length;

  return (
    <StackContext.Provider value={{ push, pop, stackDepth }}>
      <div className={cx('relative w-full h-full overflow-hidden', className)}>
        {stack.map((screen, i) => {
          const isTop = i === stack.length - 1;
          const isSecondFromTop = i === stack.length - 2;

          let animClass = '';
          if (animDir === 'push' && isTop) {
            animClass = motion(variants.stackPushIn);
          } else if (animDir === 'push' && isSecondFromTop) {
            animClass = motion(variants.stackPushOut);
          } else if (animDir === 'pop' && isTop) {
            animClass = motion(variants.stackPopOut);
          } else if (animDir === 'pop' && isSecondFromTop) {
            animClass = motion(variants.stackPopIn);
          }

          // pop 애니메이션 중 최상위 화면만 onAnimationEnd 리스닝
          const needsEndListener =
            (animDir === 'pop' && isTop) ||
            (animDir === 'push' && isTop);

          return (
            <div
              key={screen.key}
              className={cx(
                'absolute inset-0',
                isTop ? 'z-10' : 'z-0',
                animClass,
              )}
              onAnimationEnd={needsEndListener ? () => handleAnimationEnd(screen.key) : undefined}
            >
              {screen.component}
            </div>
          );
        })}
      </div>
    </StackContext.Provider>
  );
}
