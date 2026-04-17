/**
 * motion.js — CSS-based animation utilities (framer-motion 없이)
 * 번들 추가 비용 Zero. tailwind.config.js 의 motion 토큰과 짝.
 *
 * 사용법:
 *   import { transitions, variants, cx } from '@/lib/motion';
 *   <div className={cx('transition-all', transitions.page, variants.stackPushIn)} />
 */

// ─── Transition 클래스 (duration + easing 조합) ─────────────────────────────
export const transitions = {
  instant: 'transition-none',
  fast:    'transition-all duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)]',
  base:    'transition-all duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)]',
  slow:    'transition-all duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)]',
  page:    'transition-all duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]',
  sheet:   'transition-all duration-[320ms] ease-[cubic-bezier(0.3,0,0,1)]',
  spring:  'transition-all duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.3,1)]',
};

// ─── 애니메이션 클래스 (Tailwind keyframe 이름과 매핑) ──────────────────────
export const variants = {
  stackPushIn:  'animate-stack-push-in',
  stackPushOut: 'animate-stack-push-out',
  stackPopIn:   'animate-stack-pop-in',
  stackPopOut:  'animate-stack-pop-out',
  sheetIn:      'animate-sheet-in',
  sheetOut:     'animate-sheet-out',
  backdropIn:   'animate-backdrop-in',
  backdropOut:  'animate-backdrop-out',
  tabFade:      'animate-tab-fade',
  tabSpring:    'animate-tab-spring',
  pressIn:      'animate-ios-press-in',
};

// ─── Stack 네비게이션 방향 결정 ─────────────────────────────────────────────
/** push(앞으로) vs pop(뒤로) 에 따라 in/out 클래스 쌍 반환 */
export function getStackClasses(direction = 'push') {
  if (direction === 'push') {
    return { entering: variants.stackPushIn, leaving: variants.stackPushOut };
  }
  return { entering: variants.stackPopIn, leaving: variants.stackPopOut };
}

// ─── CSS 변수 기반 런타임 duration 오버라이드 ────────────────────────────────
/** @example setMotionDuration(el, 200) */
export function setMotionDuration(el, ms) {
  if (el) el.style.setProperty('--motion-duration', `${ms}ms`);
}

// ─── 유틸: className 조합 (clsx 없이 쓰는 초경량 버전) ─────────────────────
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ─── prefers-reduced-motion 런타임 체크 ─────────────────────────────────────
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** prefersReducedMotion 이면 빈 문자열 반환, 아니면 className 그대로 반환 */
export function motion(className) {
  return prefersReducedMotion() ? '' : className;
}
