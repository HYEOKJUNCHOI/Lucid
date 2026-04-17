import { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentContext } from '@/pages/Student/MobileStudentRoot';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import StatBadge from '@/components/common/mobile/StatBadge';
import HapticButton from '@/components/common/mobile/HapticButton';
import PullToRefresh from '@/components/common/mobile/PullToRefresh';
import ListRow from '@/components/common/mobile/ListRow';

// ─── 주간 학습 바 차트 ─────────────────────────────────────────────
function WeeklyBar({ values = [] }) {
  const max = Math.max(...values, 1);
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="flex items-end gap-1.5 h-16 w-full">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-sm bg-theme-primary/30 relative overflow-hidden"
            style={{ height: '44px' }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-theme-primary rounded-sm transition-all duration-500"
              style={{ height: `${Math.round((v / max) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-500">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── 스트릭 7일 도트 ──────────────────────────────────────────────
function StreakDots({ streak = 0 }) {
  const todayIdx = new Date().getDay();
  // 일(0)~토(6) → 월(0)~일(6) 인덱스 변환
  const todayMon = (todayIdx + 6) % 7;

  return (
    <div className="flex gap-2 items-center">
      {Array.from({ length: 7 }).map((_, i) => {
        const isToday = i === todayMon;
        const isPast = i < todayMon && streak > (todayMon - i);
        return (
          <div
            key={i}
            className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-sm',
              isToday
                ? 'bg-orange-500/20 border border-orange-400/50 animate-pulse'
                : isPast
                ? 'bg-theme-primary/20 border border-theme-primary/40'
                : 'bg-white/5 border border-white/10',
            ].join(' ')}
          >
            {isToday ? '🔥' : isPast ? '✓' : ''}
          </div>
        );
      })}
    </div>
  );
}

// ─── 이어하기 카드 ─────────────────────────────────────────────────
function ContinueCard({ chapters = [], onPress }) {
  const lastChapter = chapters[0] ?? null;
  if (!lastChapter) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPress?.(); }}
      className="pressable bg-theme-card border border-theme-border rounded-card p-4 shadow-e2 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-theme-primary font-semibold tracking-wide">이어하기</span>
        <span className="text-xs text-gray-500">›</span>
      </div>
      <div className="font-bold text-white text-base leading-snug truncate">
        {lastChapter.name ?? '챕터'}
      </div>
      {lastChapter.description && (
        <div className="text-xs text-gray-400 mt-0.5 truncate">{lastChapter.description}</div>
      )}
      <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-theme-primary rounded-full transition-all duration-700"
          style={{ width: `${lastChapter.progress ?? 0}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-500 mt-1">{lastChapter.progress ?? 0}% 완료</div>
    </div>
  );
}

// ─── 추천 카드 리스트 ─────────────────────────────────────────────
function RecommendSection({ chapters = [], onPress }) {
  const items = chapters.slice(0, 3);
  if (items.length === 0) return null;

  return (
    <div className="rounded-card border border-theme-border overflow-hidden shadow-e2">
      {items.map((ch, idx) => (
        <ListRow
          key={ch.id ?? idx}
          icon="📖"
          label={ch.name ?? '챕터'}
          sublabel={ch.description ?? undefined}
          value={ch.progress != null ? `${ch.progress}%` : undefined}
          chevron
          onPress={() => onPress?.(ch)}
        />
      ))}
    </div>
  );
}

// ─── HomeTab ──────────────────────────────────────────────────────
export default function HomeTab() {
  const navigate = useNavigate();
  const { user, userData } = useContext(StudentContext) ?? {};

  // userData 필드 안전 추출
  const displayName = userData?.displayName ?? user?.displayName ?? '학생';
  const streak      = userData?.streak ?? 0;
  const bestStreak  = userData?.bestStreak ?? 0;
  // 스트릭 뱃지 = 역대 최고 기록. 현재 streak가 bestStreak를 넘어서면 같이 상승.
  const badgeValue  = Math.max(streak, bestStreak);
  const isBeatingRecord = streak > 0 && streak >= bestStreak && bestStreak > 0;
  const totalXP     = userData?.totalXP ?? 0;
  const beanCount   = userData?.beanCount ?? 0;

  // 주간 학습 XP — userData.weeklyXP 배열(7개) or 더미 0 배열
  const weeklyValues = useMemo(() => {
    if (Array.isArray(userData?.weeklyXP) && userData.weeklyXP.length === 7) {
      return userData.weeklyXP;
    }
    return Array(7).fill(0);
  }, [userData?.weeklyXP]);

  // chapters — context 에 없으면 빈 배열 (StudentContext 에 전달 시 확장 가능)
  const chapters = useMemo(() => userData?.chapters ?? [], [userData?.chapters]);

  const handleContinue = () => {
    navigate('/chapter');
  };

  const handleRefresh = async () => {
    // context 는 App.jsx onSnapshot 으로 자동 갱신 — 명시적 리패치 없음
    await new Promise((r) => setTimeout(r, 400));
  };

  const topBar = (
    <MobileTopBar
      leading={null}
      title="루시드"
      largeTitle
      blurBg
      actions={
        <div className="flex items-center gap-1">
          <StatBadge
            icon={streak > 0 ? "🔥" : "🌱"}
            value={streak > 0 ? streak : "시작!"}
            label="스트릭"
            detail={
              bestStreak === 0
                ? "오늘 첫 퀘스트를 끝내면 스트릭이 시작돼요."
                : streak === 0
                  ? `🏅 최고 기록 ${bestStreak}일 — 오늘부터 다시 시작!`
                  : isBeatingRecord
                    ? `🎉 최고 기록 갱신 중! ${streak}일 연속.`
                    : `현재 ${streak}일 연속 / 🏅 최고 ${bestStreak}일.`
            }
            color={streak > 0 ? "orange" : "green"}
            popoverSide="bottom"
          />
          <StatBadge
            icon="☕"
            value={beanCount}
            label="원두"
            detail="원두는 학습 리워드로 쌓여요."
            color="yellow"
            popoverSide="bottom"
          />
        </div>
      }
    />
  );

  return (
    <Screen
      bottomTab
      appBar={topBar}
      animate="fade"
    >
      <PullToRefresh onRefresh={handleRefresh} className="h-full overflow-y-auto">
        <div className="space-y-6 px-4 py-4">

          {/* ── 인사 섹션 ─────────────────────────────────────── */}
          <section>
            <h1 className="text-xl font-bold text-white leading-tight">
              👋 안녕하세요, {displayName}님
            </h1>
            <p className="text-sm text-gray-400 mt-1">오늘도 한 걸음씩 가볼까요?</p>
          </section>

          {/* ── 스탯 뱃지 가로 스크롤 ──────────────────────────── */}
          <section>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              <div className="relative bg-theme-card border border-theme-border rounded-card px-4 py-3 flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
                <span className="text-xl">{streak > 0 ? "🔥" : "🌱"}</span>
                {streak > 0 ? (
                  <span className="text-base font-black text-orange-400 leading-none">{streak}</span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-400 leading-none">시작!</span>
                )}
                <span className="text-[10px] text-gray-500">스트릭</span>
                {/* 역대 최고 뱃지 (보조 — 기록 있을 때만) */}
                {bestStreak > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-amber-500/90 text-black rounded-pill px-1.5 py-0.5 shadow-e1 leading-none">
                    🏅{bestStreak}
                  </span>
                )}
              </div>
              <div className="bg-theme-card border border-theme-border rounded-card px-4 py-3 flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
                <span className="text-xl">⚡</span>
                <span className="text-base font-black text-yellow-400 leading-none">{totalXP.toLocaleString()}</span>
                <span className="text-[10px] text-gray-500">총 XP</span>
              </div>
              <div className="bg-theme-card border border-theme-border rounded-card px-4 py-3 flex flex-col items-center gap-1 shrink-0 min-w-[80px]">
                <span className="text-xl">☕</span>
                <span className="text-base font-black text-amber-400 leading-none">{beanCount}</span>
                <span className="text-[10px] text-gray-500">원두</span>
              </div>
            </div>
          </section>

          {/* ── 이어하기 ──────────────────────────────────────── */}
          {chapters.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-2">📖 이어하기</h2>
              <ContinueCard chapters={chapters} onPress={handleContinue} />
              <HapticButton
                variant="primary"
                size="lg"
                hapticType="success"
                onClick={handleContinue}
                className="w-full mt-3"
              >
                학습 계속하기
              </HapticButton>
            </section>
          )}

          {/* 챕터 없을 때 CTA */}
          {chapters.length === 0 && (
            <section>
              <div className="bg-theme-card border border-theme-border rounded-card p-6 flex flex-col items-center gap-3 shadow-e2">
                <span className="text-5xl">🌱</span>
                <p className="text-sm font-bold text-white">아직 학습 기록이 없어요</p>
                <p className="text-xs text-gray-400 text-center">첫 챕터를 시작하면<br />여기에 이어하기 카드가 생겨요.</p>
                <HapticButton
                  variant="primary"
                  size="md"
                  hapticType="success"
                  onClick={handleContinue}
                >
                  첫 챕터 시작하기
                </HapticButton>
              </div>
            </section>
          )}

          {/* ── 오늘의 추천 ────────────────────────────────────── */}
          {chapters.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-2">🎯 오늘의 추천</h2>
              <RecommendSection
                chapters={chapters}
                onPress={() => navigate('/chapter')}
              />
            </section>
          )}

          {/* ── 스트릭 캘린더 ─────────────────────────────────── */}
          <section>
            <h2 className="text-base font-bold text-white mb-2">🗓 이번 주 출석</h2>
            <div className="bg-theme-card border border-theme-border rounded-card p-4 shadow-e2">
              <StreakDots streak={streak} />
              <p className="text-xs text-gray-500 mt-3">
                {streak === 0 && bestStreak === 0 ? (
                  <>오늘 퀘스트를 끝내면 <span className="text-emerald-400 font-bold">첫 스트릭</span>이 시작돼요 🌱</>
                ) : streak === 0 ? (
                  <>🏅 최고 기록 <span className="text-orange-400 font-bold">{bestStreak}일</span> — 오늘 다시 시작!</>
                ) : isBeatingRecord ? (
                  <>🎉 최고 기록 갱신 중 — <span className="text-orange-400 font-bold">{streak}일</span> 연속!</>
                ) : (
                  <>현재 <span className="text-orange-400 font-bold">{streak}일</span> 연속 / 최고 {bestStreak}일</>
                )}
              </p>
            </div>
          </section>

          {/* ── 주간 학습 차트 ─────────────────────────────────── */}
          <section>
            <h2 className="text-base font-bold text-white mb-2">📊 주간 학습</h2>
            <div className="bg-theme-card border border-theme-border rounded-card p-4 shadow-e2">
              <WeeklyBar values={weeklyValues} />
            </div>
          </section>

          {/* safe-area bottom 여백 */}
          <div className="h-2" />
        </div>
      </PullToRefresh>
    </Screen>
  );
}
