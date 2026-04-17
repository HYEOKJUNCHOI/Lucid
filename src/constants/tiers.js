/**
 * tiers.js — 학습 티어 공유 상수 (레벨업 뱃지/챌린지 구조)
 *
 * **중요**: 현재 데스크탑 LevelUpView.jsx 는 로컬 TIERS 를 따로 정의하고 있음.
 * 기획 변경(minXP/색/라벨/desc) 시 반드시 **두 곳 모두** 업데이트하거나,
 * 데스크탑도 이 모듈을 참조하도록 리팩토링할 것.
 *
 * 현재 사용처:
 * - src/pages/Student/mobile/LevelUpTab.jsx (TIER_BASE + getTier 사용)
 */
import {
  GiAnvilImpact,
  GiSilverBullet,
  GiGoldBar,
  GiDiamondTrophy,
  GiLaurelCrown,
} from 'react-icons/gi';

/** 최소 공유 스키마 — id/label/minXP/color/desc/icon/glowClass */
export const TIER_BASE = [
  {
    id: 'bronze',
    label: '브론즈',
    icon: GiAnvilImpact,
    minXP: 0,
    color: '#d97706',
    desc: '배우는 중',
    glowClass: 'tier-glow-bronze',
  },
  {
    id: 'silver',
    label: '실버',
    icon: GiSilverBullet,
    minXP: 500,
    color: '#9ca3af',
    desc: '수업 따라가는 수준',
    glowClass: 'tier-glow-silver',
  },
  {
    id: 'gold',
    label: '골드',
    icon: GiGoldBar,
    minXP: 1500,
    color: '#eab308',
    desc: '혼자 짤 수 있는 수준',
    glowClass: 'tier-glow-gold',
  },
  {
    id: 'platinum',
    label: '플래티넘',
    icon: GiLaurelCrown,
    minXP: 3500,
    color: '#06b6d4',
    desc: '취업 가능 수준',
    glowClass: 'tier-glow-platinum',
  },
  {
    id: 'diamond',
    label: '다이아',
    icon: GiDiamondTrophy,
    minXP: 7000,
    color: '#a855f7',
    desc: '가르칠 수 있는 수준',
    glowClass: 'tier-glow-diamond',
  },
];

/** XP 로 현재 티어 산출 */
export function getTier(xp) {
  let current = TIER_BASE[0];
  for (const t of TIER_BASE) if (xp >= t.minXP) current = t;
  return current;
}

/** 모바일 전용 확장(이모지/링애니/챌린지) — 모바일 UI 구성용 */
export const TIER_MOBILE_EXT = {
  bronze: {
    emoji: '⚒️',
    ringColor: 'rgba(217,119,6,0.6)',
    ringAnim: 'animate-ring-breathe-1',
    challenges: [
      { id: 'b1', label: '변수와 자료형 마스터', desc: '기초 개념 10문항', total: 10 },
      { id: 'b2', label: '조건문·반복문 정복',   desc: 'if/for/while 응용', total: 15 },
      { id: 'b3', label: '배열 기초 챌린지',     desc: '1차원 배열 문제',   total: 8 },
    ],
  },
  silver: {
    emoji: '🥈',
    ringColor: 'rgba(156,163,175,0.6)',
    ringAnim: 'animate-ring-breathe',
    challenges: [
      { id: 's1', label: '클래스와 객체 설계', desc: 'OOP 기초 챌린지',    total: 12 },
      { id: 's2', label: '예외처리 마스터',   desc: 'try/catch/finally',   total: 10 },
      { id: 's3', label: '컬렉션 프레임워크', desc: 'List/Map/Set 활용',   total: 12 },
    ],
  },
  gold: {
    emoji: '🥇',
    ringColor: 'rgba(234,179,8,0.6)',
    ringAnim: 'animate-ring-breathe',
    challenges: [
      { id: 'g1', label: '상속·다형성 심화',  desc: 'override/overload',       total: 15 },
      { id: 'g2', label: '람다·스트림 정복',   desc: 'Java 8+ 함수형',          total: 12 },
      { id: 'g3', label: 'SQL 중급 챌린지',   desc: 'JOIN/GROUP BY/서브쿼리',  total: 10 },
    ],
  },
  platinum: {
    emoji: '💎',
    ringColor: 'rgba(6,182,212,0.6)',
    ringAnim: 'animate-ring-breathe-3',
    challenges: [
      { id: 'p1', label: 'Spring Boot API 설계', desc: 'REST + JPA 챌린지',        total: 15 },
      { id: 'p2', label: '디자인 패턴 마스터',   desc: 'Singleton/Factory/MVC',    total: 10 },
      { id: 'p3', label: 'React 심화 챌린지',    desc: 'Hook·상태관리·최적화',      total: 12 },
    ],
  },
  diamond: {
    emoji: '🔱',
    ringColor: 'rgba(168,85,247,0.6)',
    ringAnim: 'animate-ring-breathe-3',
    challenges: [
      { id: 'd1', label: '아키텍처 설계 챌린지', desc: '복합 시스템 설계',    total: 8  },
      { id: 'd2', label: '코드 리뷰 마스터',    desc: '버그 찾기·리팩토링',   total: 10 },
      { id: 'd3', label: '풀스택 프로젝트',     desc: '종합 미션',           total: 5  },
    ],
  },
};

/** 모바일용 완전 티어 배열 (base + ext merge) */
export const TIERS_MOBILE = TIER_BASE.map((t) => ({ ...t, ...TIER_MOBILE_EXT[t.id] }));
