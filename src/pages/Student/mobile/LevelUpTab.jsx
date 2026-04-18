/**
 * LevelUpTab — 레벨업 탭 (모바일 전용)
 *
 * 구성:
 *  1. 현재 티어 대형 카드 (tier-glow + ring-breathe 애니메이션)
 *  2. 티어별 챌린지 섹션 (브론즈 → 실버 → 골드 → 플래티넘 → 다이아)
 *  3. 마스터노트 읽기전용 진입 카드
 */
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import HapticButton from '@/components/common/mobile/HapticButton';
import { StudentContext } from '@/pages/Student/mobile/MobileStudentPage';
import haptic from '@/lib/haptic';
import { TIERS_MOBILE as TIERS } from '@/constants/tiers';

// 티어 정의: src/constants/tiers.js 의 TIERS_MOBILE 을 단일 소스로 사용.
// 데스크탑 LevelUpView 와 drift 방지를 위해 기획 변경 시 해당 파일만 수정할 것.

// 현재 티어 계산
const getTier = (xp) => {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (xp >= t.minXP) tier = t;
  }
  return tier;
};

const getNextTier = (xp) => {
  for (const t of TIERS) {
    if (xp < t.minXP) return t;
  }
  return null;
};

// XP 기반 진행률 계산 (0~100)
const getTierProgress = (xp) => {
  const current = getTier(xp);
  const next = getNextTier(xp);
  if (!next) return 100;
  const range = next.minXP - current.minXP;
  const earned = xp - current.minXP;
  return Math.round((earned / range) * 100);
};

// 티어별 잠금 여부 (현재 티어보다 2단계 위부터 잠금)
const isTierLocked = (tierIdx, currentTierIdx) => tierIdx > currentTierIdx + 1;

// ─── 서브컴포넌트: 현재 티어 대형 카드 ──────────────
function CurrentTierCard({ xp }) {
  const tier = getTier(xp);
  const next = getNextTier(xp);
  const progress = getTierProgress(xp);
  const TierIcon = tier.icon;

  return (
    <div className={`mx-4 rounded-2xl bg-theme-card border border-white/10 p-5 ${tier.glowClass}`}>
      <div className="flex items-center gap-4">
        {/* 원형 티어 아이콘 */}
        <div
          className={`relative w-20 h-20 rounded-full bg-theme-bg border-2 shrink-0 ${tier.ringAnim}`}
          style={{ borderColor: tier.ringColor }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <TierIcon size={36} color={tier.color} />
          </div>
        </div>

        {/* 티어 정보 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-0.5">현재 티어</div>
          <div className="text-xl font-bold text-white">{tier.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">{tier.desc}</div>
          <div className="text-sm font-semibold mt-1" style={{ color: tier.color }}>
            {xp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* 다음 티어 진행률 */}
      {next ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>다음 티어까지 <span className="font-semibold text-white">{progress}%</span></span>
            <span>{tier.label} → {next.label}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${tier.color}, ${next.color})`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{xp.toLocaleString()} XP</span>
            <span>{next.minXP.toLocaleString()} XP</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center text-xs font-semibold" style={{ color: tier.color }}>
          최고 티어 달성 🎉
        </div>
      )}
    </div>
  );
}

// ─── 서브컴포넌트: 챌린지 카드 (개별) ───────────────
function ChallengeItem({ challenge, tierColor, locked, onPress }) {
  const done = 0; // 실제 데이터 연동 시 확장

  return (
    <div
      role={locked ? undefined : 'button'}
      onClick={locked ? undefined : onPress}
      className={`pressable flex items-center gap-3 px-4 py-3 bg-theme-card list-row-divider ${locked ? 'opacity-40' : ''}`}
    >
      <div
        className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-base shrink-0"
        style={{ borderColor: locked ? '#4b5563' : tierColor }}
      >
        {locked ? '🔒' : done === challenge.total ? '✅' : '📖'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white leading-snug">{challenge.label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{challenge.desc}</div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-xs font-semibold" style={{ color: locked ? '#6b7280' : tierColor }}>
          {done}/{challenge.total}
        </div>
        <div className="text-xs text-gray-500">문항</div>
      </div>

      {!locked && <span className="text-gray-500 text-xs">›</span>}
    </div>
  );
}

// ─── 서브컴포넌트: 티어 섹션 ────────────────────────
function TierSection({ tierDef, currentTierIdx, tierIdx, onChallengePress }) {
  const [expanded, setExpanded] = useState(tierIdx === currentTierIdx);
  const locked = isTierLocked(tierIdx, currentTierIdx);
  const TierIcon = tierDef.icon;

  return (
    <div className="mt-3 mx-4 rounded-2xl overflow-hidden border border-white/10 bg-theme-card">
      {/* 섹션 헤더 */}
      <button
        type="button"
        className={`pressable w-full flex items-center gap-3 px-4 py-3 ${locked ? 'opacity-50' : ''}`}
        onClick={() => {
          haptic.tap();
          if (!locked) setExpanded(v => !v);
        }}
      >
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${!locked ? tierDef.glowClass : ''}`}
          style={{ borderColor: locked ? '#4b5563' : tierDef.ringColor }}
        >
          {locked
            ? <span className="text-base">🔒</span>
            : <TierIcon size={20} color={tierDef.color} />
          }
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-bold text-white">{tierDef.label}</div>
          <div className="text-xs text-gray-400">{tierDef.desc}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs font-semibold" style={{ color: locked ? '#6b7280' : tierDef.color }}>
            {tierDef.minXP.toLocaleString()} XP~
          </div>
          {!locked && (
            <span className={`text-gray-400 text-sm transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
              ›
            </span>
          )}
        </div>
      </button>

      {/* 챌린지 목록 */}
      {expanded && !locked && (
        <div className="border-t border-white/10">
          {tierDef.challenges.map((ch) => (
            <ChallengeItem
              key={ch.id}
              challenge={ch}
              tierColor={tierDef.color}
              locked={false}
              onPress={() => onChallengePress(ch, tierDef)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 서브컴포넌트: 마스터노트 카드 ──────────────────
function MasterNoteCard({ onPress }) {
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-theme-card border border-theme-primary/30 overflow-hidden">
      <div className="px-4 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-theme-primary/15 flex items-center justify-center text-2xl shrink-0">
          📚
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">마스터노트</div>
          <div className="text-xs text-gray-400 mt-0.5">복습하고 예습하자</div>
        </div>
      </div>

      {/* 읽기전용 안내 배너 */}
      <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
        <span className="text-amber-400 text-sm">ℹ️</span>
        <span className="text-xs text-amber-300">읽기 전용 모드로 열립니다</span>
      </div>

      <div className="px-4 pb-4">
        <HapticButton
          variant="secondary"
          size="md"
          hapticType="selection"
          onClick={onPress}
          className="w-full justify-between"
        >
          <span>읽기 전용으로 열기</span>
          <span className="text-gray-400">→</span>
        </HapticButton>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────
export default function LevelUpTab() {
  const ctx = useContext(StudentContext);
  const navigate = useNavigate();

  // userData에서 XP 계산: subjectTiers 전체 합산
  const userData = ctx?.userData ?? {};
  const subjectTiers = userData.subjectTiers ?? {};
  const totalXP = Object.values(subjectTiers).reduce((sum, s) => sum + (s?.xp ?? 0), 0);
  const fallbackXP = userData.totalXP ?? totalXP;

  const currentTier = getTier(fallbackXP);
  const currentTierIdx = TIERS.findIndex(t => t.id === currentTier.id);

  const handleChallengePress = (challenge, tierDef) => {
    haptic.tap();
    // 챌린지 진입: LevelUpView(데스크탑 원본)로 연결
    navigate('/home/levelup');
  };

  const handleMasterNotePress = () => {
    navigate('/freestudy');
  };

  return (
    <Screen
      bottomTab
      appBar={<MobileTopBar title="레벨업" largeTitle blurBg />}
      animate="fade"
    >
      <div className="pt-2 pb-6">

        {/* 1. 현재 티어 대형 카드 */}
        <CurrentTierCard xp={fallbackXP} />

        {/* 2. 섹션 헤더 */}
        <div className="px-4 mt-6 mb-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            티어별 챌린지
          </div>
        </div>

        {/* 3. 티어별 섹션 */}
        {TIERS.map((tierDef, idx) => (
          <TierSection
            key={tierDef.id}
            tierDef={tierDef}
            tierIdx={idx}
            currentTierIdx={currentTierIdx}
            onChallengePress={handleChallengePress}
          />
        ))}

        {/* 4. 마스터노트 카드 */}
        <div className="px-4 mt-6 mb-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            마스터노트
          </div>
        </div>
        <MasterNoteCard onPress={handleMasterNotePress} />

        {/* safe area 하단 여백 */}
        <div className="h-4" />
      </div>
    </Screen>
  );
}
