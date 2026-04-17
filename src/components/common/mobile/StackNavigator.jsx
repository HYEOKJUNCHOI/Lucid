import { createContext, useContext, useState, useCallback } from 'react';
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
  // stack 아이템에 exiting 플래그를 두어 연타 pop 에도 stale closure 없이 동작.
  // { key, component, exiting?: true }
  const [stack, setStack] = useState([
    { key: '__initial__', component: initialScreen },
  ]);
  // 'push' | 'pop' | null — 현재 진행 중인 애니메이션 방향
  const [animDir, setAnimDir] = useState(null);

  const push = useCallback((component, key) => {
    setAnimDir('push');
    setStack((prev) => [...prev, { key, component }]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      // 이미 exiting 중이 아닌 최상위를 찾아 exiting 마킹
      let marked = false;
      const next = [...prev];
      for (let i = next.length - 1; i >= 1; i--) {
        if (!next[i].exiting) {
          next[i] = { ...next[i], exiting: true };
          marked = true;
          break;
        }
      }
      if (!marked) return prev; // 더 이상 pop 할 게 없음
      haptic.tap();
      setAnimDir('pop');
      return next;
    });
  }, []);

  const handleAnimationEnd = useCallback((key) => {
    setStack((prev) => {
      const target = prev.find((s) => s.key === key);
      if (target?.exiting) {
        // 애니메이션 끝난 exiting 화면만 제거
        const next = prev.filter((s) => s.key !== key);
        // 남은 exiting 이 있으면 animDir 'pop' 유지, 없으면 idle
        const stillAnimating = next.some((s) => s.exiting);
        if (!stillAnimating) setAnimDir(null);
        return next;
      }
      // push 완료 → animDir idle
      setAnimDir(null);
      return prev;
    });
  }, []);

  // 화면 수 (exiting 포함). stackDepth 는 외부 API 로 exiting 제외값 노출.
  const stackDepth = stack.filter((s) => !s.exiting).length;
  // 살아있는(non-exiting) 최상단 인덱스 — pop-in 대상 판정용
  const visibleTopIdx = (() => {
    for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].exiting) return i;
    return -1;
  })();

  return (
    <StackContext.Provider value={{ push, pop, stackDepth }}>
      <div className={cx('relative w-full h-full overflow-hidden', className)}>
        {stack.map((screen, i) => {
          const isTop = i === stack.length - 1;
          const isVisibleTop = i === visibleTopIdx;
          const isSecondFromVisibleTop = i === visibleTopIdx - 1;

          let animClass = '';
          if (screen.exiting) {
            // exiting 플래그가 있으면 무조건 pop-out
            animClass = motion(variants.stackPopOut);
          } else if (animDir === 'push' && isTop) {
            animClass = motion(variants.stackPushIn);
          } else if (animDir === 'push' && i === stack.length - 2) {
            animClass = motion(variants.stackPushOut);
          } else if (animDir === 'pop' && isVisibleTop) {
            animClass = motion(variants.stackPopIn);
          }

          // exiting 화면 또는 push 진입 화면만 animationEnd 리스닝
          const needsEndListener =
            screen.exiting || (animDir === 'push' && isTop);

          return (
            <div
              key={screen.key}
              className={cx(
                'absolute inset-0',
                // exiting 은 최상위로 올려 pop-out 을 보여줌
                screen.exiting ? 'z-20' : isVisibleTop ? 'z-10' : 'z-0',
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
