import React, { useContext, useState } from 'react';
import { StudentContext } from '@/pages/Student/mobile/MobileStudentPage';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import ListRow from '@/components/common/mobile/ListRow';
import HapticButton from '@/components/common/mobile/HapticButton';
import ActionSheet from '@/components/common/mobile/ActionSheet';
import haptic from '@/lib/haptic';

// ─── 섹션 래퍼 ──────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pb-2 pt-4">
        {title}
      </h3>
      <div className="bg-theme-card rounded-card mx-4 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function ProfileTab() {
  const { user, userData, onLogout } = useContext(StudentContext) ?? {};
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── 사용자 정보 ──
  const displayName = user?.displayName ?? userData?.name ?? '게스트';
  const email = user?.email ?? '';
  const photoURL = user?.photoURL;
  const tier = userData?.tier ?? 'bronze';
  const xp = userData?.xp ?? 0;
  const streak = userData?.streak ?? 0;
  const beans = userData?.beans ?? 0;
  const chaptersCompleted = userData?.chaptersCompleted ?? 0;

  // 티어 한글 + 색상
  const TIER_MAP = {
    bronze:   { label: '브론즈',   color: 'orange' },
    silver:   { label: '실버',     color: 'teal'   },
    gold:     { label: '골드',     color: 'yellow' },
    platinum: { label: '플래티넘', color: 'blue'   },
  };
  const { label: tierLabel } = TIER_MAP[tier] ?? TIER_MAP.bronze;

  // ── 로그아웃 ──
  const handleLogout = () => {
    haptic.warning();
    onLogout?.();
  };

  const handleLogoutRequest = () => {
    haptic.warning();
    setConfirmOpen(true);
  };

  return (
    <>
      <Screen
        bottomTab
        appBar={
          <MobileTopBar
            title="프로필"
            largeTitle
            blurBg
            leading={null}
          />
        }
        animate="fade"
      >
        {/* ── 프로필 헤더 카드 ── */}
        <div className="mx-4 mt-4 bg-theme-card rounded-card p-5 flex flex-col items-center gap-2">
          {/* 아바타 */}
          <div className="w-20 h-20 rounded-full bg-theme-surface flex items-center justify-center overflow-hidden border-2 border-theme-border shrink-0">
            {photoURL ? (
              <img src={photoURL} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">👤</span>
            )}
          </div>

          {/* 이름 */}
          <p className="text-lg font-bold text-white leading-tight">{displayName}</p>

          {/* 이메일 */}
          {email && (
            <p className="text-xs text-gray-400">{email}</p>
          )}

          {/* 티어 뱃지 */}
          <span
            className={`mt-1 px-3 py-0.5 rounded-full text-xs font-semibold
              ${tier === 'platinum' ? 'bg-blue-400/20 text-blue-300' :
                tier === 'gold'    ? 'bg-yellow-400/20 text-yellow-300' :
                tier === 'silver'  ? 'bg-teal-400/20 text-teal-300' :
                                     'bg-orange-400/20 text-orange-300'}`}
          >
            {tierLabel} 티어
          </span>
        </div>

        {/* ── 통계 그리드 2×2 ── */}
        <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
          <div className="bg-theme-card rounded-card p-4 flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-base font-bold text-white">{streak}일</p>
              <p className="text-xs text-gray-400">스트릭</p>
            </div>
          </div>
          <div className="bg-theme-card rounded-card p-4 flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="text-base font-bold text-white">{xp} XP</p>
              <p className="text-xs text-gray-400">경험치</p>
            </div>
          </div>
          <div className="bg-theme-card rounded-card p-4 flex items-center gap-3">
            <span className="text-2xl">☕</span>
            <div>
              <p className="text-base font-bold text-white">{beans}</p>
              <p className="text-xs text-gray-400">원두</p>
            </div>
          </div>
          <div className="bg-theme-card rounded-card p-4 flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <p className="text-base font-bold text-white">{chaptersCompleted}</p>
              <p className="text-xs text-gray-400">챕터 완료</p>
            </div>
          </div>
        </div>

        {/* ── 섹션: 학습 ── */}
        <Section title="학습">
          <ListRow
            icon="📖"
            label="학습 기록"
            chevron
            onPress={() => console.warn('TODO: 학습 기록 페이지')}
          />
          <ListRow
            icon="📝"
            label="마스터노트"
            chevron
            onPress={() => console.warn('TODO: 마스터노트 페이지')}
          />
          <ListRow
            icon="🔖"
            label="북마크"
            chevron
            onPress={() => console.warn('TODO: 북마크 페이지')}
          />
        </Section>

        {/* ── 섹션: 설정 ── */}
        <Section title="설정">
          <ListRow
            icon="🔑"
            label="API 키 설정"
            chevron
            onPress={() => console.warn('TODO: API 키 모달')}
          />
          <ListRow
            icon="🔔"
            label="알림 설정"
            chevron
            onPress={() => console.warn('TODO: 알림 설정 페이지')}
          />
          <ListRow
            icon="🎨"
            label="테마"
            value="다크"
            chevron
            onPress={() => console.warn('TODO: 테마 설정 페이지')}
          />
        </Section>

        {/* ── 섹션: 정보 ── */}
        <Section title="정보">
          <ListRow
            icon="❓"
            label="도움말"
            chevron
            onPress={() => console.warn('TODO: 도움말 페이지')}
          />
          <ListRow
            icon="📩"
            label="문의하기"
            chevron
            onPress={() => console.warn('TODO: 문의하기 페이지')}
          />
          <ListRow
            icon="📄"
            label="라이선스"
            chevron
            onPress={() => console.warn('TODO: 라이선스 페이지')}
          />
          <ListRow
            icon="ℹ️"
            label="버전"
            value="1.0.0"
          />
        </Section>

        {/* ── 로그아웃 버튼 ── */}
        <div className="mx-4 mt-6 mb-4">
          <HapticButton
            variant="danger"
            size="lg"
            hapticType="warning"
            onClick={handleLogoutRequest}
            className="w-full rounded-card"
          >
            로그아웃
          </HapticButton>
        </div>
      </Screen>

      {/* ── 로그아웃 확인 ActionSheet ── */}
      <ActionSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="정말 로그아웃 할까요?"
        actions={[
          {
            label: '로그아웃',
            onPress: handleLogout,
            destructive: true,
          },
        ]}
        cancelLabel="취소"
      />
    </>
  );
}
