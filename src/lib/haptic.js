/**
 * haptic.js — 네이티브 앱 햅틱 피드백 헬퍼
 * navigator.vibrate() 래퍼 + prefers-reduced-motion 자동 적용
 *
 * 사용법:
 *   import { haptic } from '@/lib/haptic';
 *   haptic.tap();       // 버튼 탭
 *   haptic.success();   // 완료/정답
 *   haptic.error();     // 오류/오답
 *   haptic.warning();   // 경고
 *   haptic.heavy();     // 레벨업/큰 이벤트
 */

const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

function vibrate(pattern) {
  if (!supported) return;
  // prefers-reduced-motion 이면 햅틱도 억제
  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate(pattern);
}

export const haptic = {
  /** 일반 버튼 탭 (8ms — 거의 안 느껴지는 살짝) */
  tap: () => vibrate(8),

  /** 탭 전환, 토글 (12ms) */
  selection: () => vibrate(12),

  /** 성공 / 정답 / 완료 (15ms) */
  success: () => vibrate(15),

  /** 경고 / 주의 (짧은 2연타) */
  warning: () => vibrate([10, 60, 10]),

  /** 오류 / 오답 (3연타 점점 강해짐) */
  error: () => vibrate([20, 60, 30, 60, 40]),

  /** 레벨업 / 큰 이벤트 / 퀘스트 완료 (진동 패턴) */
  heavy: () => vibrate([30, 50, 60, 50, 30]),

  /** CodePeekButton 시작 (기존 useLongPress 8ms 와 동일) */
  peek: () => vibrate(8),

  /** iOS 꾹 눌림 감지 시 (기존 useLongPress 15ms 와 동일) */
  longPress: () => vibrate(15),
};

export default haptic;
