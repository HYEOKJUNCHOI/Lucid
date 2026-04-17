import { useIsMobile } from '@/hooks/useMediaQuery';
import { cx, motion } from '@/lib/motion';

/**
 * Screen — 네이티브 앱 "화면 하나" 최상위 래퍼 (모바일 전용)
 * 모든 학생 뷰 화면의 모바일 루트로 사용.
 *
 * @param {object}           props
 * @param {React.ReactNode}  [props.appBar]      - MobileTopBar 인스턴스, null이면 앱바 없음
 * @param {boolean}          [props.bottomTab]   - 하단 탭바 있는 화면: pb-tab-h 추가
 * @param {string}           [props.className]   - screen-content에 추가되는 클래스
 * @param {React.ReactNode}  props.children
 * @param {'push'|'pop'|'fade'|null} [props.animate] - 진입 애니메이션
 * @param {() => void}       [props.onBack]      - 뒤로가기 제스처/버튼 핸들러
 */
export default function Screen({
  appBar = null,
  bottomTab = false,
  className = '',
  children,
  animate = null,
  onBack,
}) {
  const isMobile = useIsMobile();

  // 데스크탑에서는 기존 레이아웃 그대로 유지
  if (!isMobile) {
    return <>{children}</>;
  }

  // animate prop → CSS 클래스 매핑 (reduced-motion 자동 처리)
  const animateClass =
    animate === 'push'
      ? motion('animate-stack-push-in')
      : animate === 'pop'
      ? motion('animate-stack-pop-in')
      : animate === 'fade'
      ? motion('animate-tab-fade')
      : '';

  return (
    <div
      className={cx(
        'relative flex flex-col w-full',
        animateClass,
      )}
      style={{ height: '100dvh' }}
    >
      {/* AppBar placeholder — fixed이므로 동일 높이 spacer 필요 */}
      {appBar && <div className="h-appbar-h shrink-0" />}

      {/* AppBar 실제 렌더 */}
      {appBar}

      {/* 스크롤 가능 콘텐츠 영역 */}
      <div
        className={cx(
          'screen-content',
          bottomTab && 'pb-tab-h',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
