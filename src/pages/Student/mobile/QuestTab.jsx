import { useState, useContext, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentContext } from '@/pages/Student/mobile/MobileStudentPage';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import SegmentedControl from '@/components/common/mobile/SegmentedControl';
import HapticButton from '@/components/common/mobile/HapticButton';
import PullToRefresh from '@/components/common/mobile/PullToRefresh';
import ListRow from '@/components/common/mobile/ListRow';
import haptic from '@/lib/haptic';

// ─── 세그먼트 정의 ─────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'daily',     label: '일일',    icon: '🌅' },
  { id: 'weekly',    label: '주간',    icon: '📅' },
  { id: 'challenge', label: '도전과제', icon: '🏆' },
];

// ─── 퀘스트 타입 → 배지 색상 ──────────────────────────────────────
const TYPE_BADGE = {
  new:       { label: '신규',   className: 'bg-sky-500/20 text-sky-300' },
  review:    { label: '복습',   className: 'bg-emerald-500/20 text-emerald-300' },
  weak:      { label: '약점',   className: 'bg-red-500/20 text-red-400' },
  weekly:    { label: '주간',   className: 'bg-purple-500/20 text-purple-300' },
  challenge: { label: '도전',   className: 'bg-amber-500/20 text-amber-300' },
};

// ─── 진행률 바 ─────────────────────────────────────────────────────
function ProgressBar({ value = 0, max = 1, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-1.5 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-theme-primary rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── 퀘스트 카드 ───────────────────────────────────────────────────
function QuestCard({ quest, onStart }) {
  const { file, type, chapterLabel, done, progress, total } = quest;
  const badge = TYPE_BADGE[type] ?? TYPE_BADGE.new;
  const isDone = !!done;
  const xp = type === 'weak' ? 15 : type === 'review' ? 10 : 8;

  return (
    <div
      className={[
        'rounded-2xl border p-4 transition-all duration-200',
        isDone
          ? 'bg-theme-card/50 border-theme-border/30 opacity-60'
          : 'bg-theme-card border-theme-border shadow-e2',
      ].join(' ')}
    >
      {/* 헤더 행 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{isDone ? '✅' : '🎯'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-snug truncate">
              {file?.name ?? '퀘스트'}
            </p>
            {chapterLabel && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{chapterLabel}</p>
            )}
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* XP 보상 */}
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
        <span>⚡ +{xp} XP</span>
        {total > 0 && (
          <span>
            진행: {progress ?? 0}/{total}
          </span>
        )}
      </div>

      {/* 진행률 바 */}
      {total > 0 && (
        <ProgressBar value={progress ?? 0} max={total} className="mb-3" />
      )}

      {/* CTA */}
      {!isDone && (
        <HapticButton
          variant="primary"
          size="sm"
          hapticType="tap"
          onClick={() => onStart(quest)}
          className="w-full"
        >
          시작하기 →
        </HapticButton>
      )}
      {isDone && (
        <p className="text-center text-xs text-gray-500 font-medium py-1">완료됨</p>
      )}
    </div>
  );
}

// ─── 빈 상태 ───────────────────────────────────────────────────────
function EmptyState({ segment }) {
  const msgs = {
    daily:     { icon: '🌱', title: '오늘 퀘스트가 없어요', desc: '학습을 진행하면 퀘스트가 생성됩니다.' },
    weekly:    { icon: '📆', title: '주간 퀘스트 준비 중', desc: '더 많은 학습 후 주간 과제가 제공됩니다.' },
    challenge: { icon: '🏅', title: '도전과제가 없어요', desc: '기본 퀘스트를 모두 완료하면 잠금 해제됩니다.' },
  };
  const { icon, title, desc } = msgs[segment] ?? msgs.daily;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <span className="text-6xl">{icon}</span>
      <p className="text-base font-bold text-white">{title}</p>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

// ─── 오늘 요약 카드 ────────────────────────────────────────────────
function SummaryCard({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="bg-theme-card border border-theme-border rounded-2xl p-4 shadow-e2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-400 tracking-wide">오늘 진행 상황</p>
        <p className="text-xs font-bold text-theme-primary">{done}/{total} 완료</p>
      </div>
      <ProgressBar value={done} max={total} className="mt-2" />
      <p className="text-[10px] text-gray-500 mt-1.5">{pct}% 달성</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QuestTab
// ═══════════════════════════════════════════════════════════════════
export default function QuestTab() {
  const navigate = useNavigate();
  const { userData } = useContext(StudentContext) ?? {};

  const [segment, setSegment] = useState('daily');
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── 퀘스트 아이템 구성 ─────────────────────────────────────────
  // StudentContext.userData 에서 이미 구독된 데이터 활용.
  // visitedFiles, weakFiles, chapters 는 userData 에서 추출.
  // 신규 Firebase 구독 없음.
  const visitedFiles = useMemo(() => userData?.visitedFiles ?? [], [userData, refreshKey]);
  const weakFiles    = useMemo(() => userData?.weakFiles    ?? [], [userData, refreshKey]);
  const chapters     = useMemo(() => userData?.chapters     ?? [], [userData, refreshKey]);

  // 모든 파일 리스트 (chapters 배열에 파일이 embedded 되어 있는 경우를 처리)
  const allFiles = useMemo(() => {
    const files = [];
    chapters.forEach((ch) => {
      const chFiles = ch.files ?? [];
      chFiles.forEach((f) => files.push({ ...f, chapterLabel: ch.label || ch.name }));
    });
    return files;
  }, [chapters]);

  // ─── 일일 퀘스트 구성 ───────────────────────────────────────────
  const dailyQuests = useMemo(() => {
    const items = [];
    // 신규 파일 (미방문)
    allFiles
      .filter((f) => !visitedFiles.includes(f.path))
      .slice(0, 3)
      .forEach((f) => items.push({ id: `new_${f.path}`, file: f, type: 'new', chapterLabel: f.chapterLabel, done: false, progress: 0, total: 0 }));
    // 약점 파일
    allFiles
      .filter((f) => weakFiles.includes(f.path))
      .slice(0, 2)
      .forEach((f) => items.push({ id: `weak_${f.path}`, file: f, type: 'weak', chapterLabel: f.chapterLabel, done: false, progress: 0, total: 0 }));
    // 복습 (방문했지만 약점 아닌 것)
    const reviewCandidates = allFiles.filter(
      (f) => visitedFiles.includes(f.path) && !weakFiles.includes(f.path)
    );
    if (reviewCandidates.length > 0) {
      // 날짜 기반 결정적 시드 (하루 동안 같은 복습 파일 유지 + StrictMode 이중 렌더 대응)
      const today = new Date().toISOString().slice(0, 10);
      let seed = 0;
      for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) | 0;
      const idx = Math.abs(seed) % reviewCandidates.length;
      const pick = reviewCandidates[idx];
      items.push({ id: `review_${pick.path}`, file: pick, type: 'review', chapterLabel: pick.chapterLabel, done: false, progress: 0, total: 0 });
    }
    return items;
  }, [allFiles, visitedFiles, weakFiles]);

  // ─── 주간 퀘스트 구성 ───────────────────────────────────────────
  const weeklyQuests = useMemo(() => {
    return allFiles.slice(0, 5).map((f, i) => ({
      id: `weekly_${f.path}_${i}`,
      file: f,
      type: 'weekly',
      chapterLabel: f.chapterLabel,
      done: false,
      progress: i < 2 ? i + 1 : 0,
      total: 3,
    }));
  }, [allFiles]);

  // ─── 도전과제 구성 ──────────────────────────────────────────────
  const challengeQuests = useMemo(() => {
    if (allFiles.length < 5) return [];
    return allFiles.slice(0, 3).map((f, i) => ({
      id: `challenge_${f.path}_${i}`,
      file: f,
      type: 'challenge',
      chapterLabel: f.chapterLabel,
      done: false,
      progress: 0,
      total: 5,
    }));
  }, [allFiles]);

  const questsBySegment = { daily: dailyQuests, weekly: weeklyQuests, challenge: challengeQuests };
  const currentQuests = questsBySegment[segment] ?? [];
  const doneCount = currentQuests.filter((q) => q.done).length;

  // ─── 새로고침 ──────────────────────────────────────────────────
  const handleRefresh = async () => {
    await new Promise((r) => setTimeout(r, 400));
    setRefreshKey((k) => k + 1);
  };

  // ─── 퀘스트 시작 핸들러 ────────────────────────────────────────
  const handleStart = (quest) => {
    haptic.tap();
    // QuestView(데스크탑) 로 이동 — quest URL 유지
    navigate('/home/quest');
  };

  // ─── AppBar ────────────────────────────────────────────────────
  const topBar = (
    <MobileTopBar
      title="퀘스트"
      largeTitle
      blurBg
    />
  );

  return (
    <Screen bottomTab appBar={topBar} animate="fade">
      <PullToRefresh onRefresh={handleRefresh} className="h-full overflow-y-auto">
        <div className="px-4 pt-3 pb-6 flex flex-col gap-4">

          {/* SegmentedControl */}
          <SegmentedControl
            items={SEGMENTS}
            value={segment}
            onChange={setSegment}
          />

          {/* 오늘 요약 카드 (일일 탭만) */}
          {segment === 'daily' && (
            <SummaryCard done={doneCount} total={currentQuests.length} />
          )}

          {/* 퀘스트 리스트 */}
          {currentQuests.length === 0 ? (
            <EmptyState segment={segment} />
          ) : (
            <div className="flex flex-col gap-3">
              {currentQuests.map((quest) => (
                <QuestCard key={quest.id} quest={quest} onStart={handleStart} />
              ))}
            </div>
          )}

          {/* ── 평가 섹션 ─────────────────────────────────────── */}
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-400 tracking-wide px-1 mb-2">📝 평가</p>
            <div className="rounded-2xl border border-theme-border overflow-hidden bg-theme-card shadow-e2">
              <ListRow
                icon="📋"
                label="배치고사 시작"
                sublabel="내 수준을 진단하고 맞춤 커리큘럼을 받아요"
                chevron
                onPress={() => {
                  haptic.tap();
                  navigate('/home/levelup');
                }}
              />
              <ListRow
                icon="🔬"
                label="진단평가"
                sublabel="약점 챕터를 집중 점검해요"
                chevron
                onPress={() => {
                  haptic.tap();
                  navigate('/home/quest');
                }}
              />
            </div>
          </div>

        </div>
      </PullToRefresh>
    </Screen>
  );
}
