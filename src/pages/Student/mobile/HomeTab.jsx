import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useStudentContext } from '@/pages/Student/mobile/MobileStudentPage';
import { DAILY_XP_CAP } from '@/services/learningService';
import MobileProblemHellOverlay from '@/pages/Student/mobile/levelup/MobileProblemHellOverlay';

// ─── 스트릭 상태 배너 ────────────────────────────────────────────────
// 데스크탑과 동일한 색/메시지. 모바일은 패딩만 더 줄임.
function StreakBanner({ streakStatus, streak, repairCount }) {
  if (streakStatus === 'grace2') {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
        <span>⚠️</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-400">내일이 마지막 기회예요</p>
          <p className="text-[10px] text-gray-400">오늘 퀘스트 안 하면 {streak}일 연속이 사라져요</p>
        </div>
      </div>
    );
  }
  if (streakStatus === 'broken') {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
        <span>💔</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-red-400">연속 퀘스트가 초기화됐어요</p>
          <p className="text-[10px] text-gray-400">3일 연속 퀘스트 완료 시 복구 가능해요!</p>
        </div>
      </div>
    );
  }
  if (streakStatus === 'repair') {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2.5">
        <span>🔧</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-purple-400">연속출석 복구 퀘스트 진행 중</p>
          <p className="text-[10px] text-gray-400">
            퀘스트 3연속 완료 시 복구! 현재{' '}
            <span className="font-bold text-purple-400">{repairCount}/3</span> 완료
          </p>
        </div>
        {/* 진행 도트 */}
        <div className="flex shrink-0 gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn('h-2 w-2 rounded-full', i < repairCount ? 'bg-purple-500' : 'bg-white/10')}
            />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ─── 오늘의 퀘스트 카드 ──────────────────────────────────────────────
// 데스크탑과 동일한 amber 그라디언트. 모바일은 아이콘/패딩 축소.
function QuestCard({ dailyXP, onClick }) {
  const xpPercent = Math.min((dailyXP.total / DAILY_XP_CAP) * 100, 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-2xl px-4 py-3.5 text-left',
        'border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] to-orange-500/[0.06]',
        'shadow-[0_4px_24px_rgba(245,158,11,0.10)] transition-all duration-base',
        'active:scale-[0.98] hover:border-amber-500/60 hover:from-amber-500/20',
      )}
    >
      <div className="flex items-center gap-3">
        {/* 아이콘 */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/20">
          <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* 타이틀 + 설명 */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-amber-400">오늘의 퀘스트</h3>
          <p className="text-[11px] text-gray-400">오늘 배운 코드를 한 바퀴 훑어보세요.</p>
        </div>

        {/* XP 바 (우측) */}
        <div className="w-24 shrink-0">
          <div className="mb-1 flex justify-between text-[9px] text-gray-500">
            <span>오늘의 XP</span>
            <span>{dailyXP.total}/{DAILY_XP_CAP}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-pill bg-white/[0.06]">
            <div
              className="h-full rounded-pill bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-slow"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* 시작 화살표 */}
        <div className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-amber-400">
          <span>시작</span>
          <svg className="h-3 w-3 transition-transform group-active:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─── 하단 2카드 (마스터노트 / 문제지옥) ─────────────────────────────
// 데스크탑과 동일한 디자인. 모바일은 패딩 줄이고 설명 텍스트 압축.
function BottomCard({ accent, icon, title, desc, sub, cta, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-1 flex-col rounded-2xl p-4 text-left transition-all duration-base active:scale-[0.97]"
      style={{
        background: `linear-gradient(135deg, ${accent}1a 0%, ${accent}0a 100%)`,
        border: `1px solid ${accent}40`,
        boxShadow: `0 4px 24px ${accent}1a`,
      }}
    >
      {/* 아이콘 */}
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform duration-fast group-active:scale-110"
        style={{
          background: `linear-gradient(135deg, ${accent}40 0%, ${accent}26 100%)`,
          ringColor: `${accent}33`,
          boxShadow: `0 0 15px ${accent}20`,
        }}
      >
        {icon}
      </div>

      {/* 텍스트 */}
      <h3 className="mb-1 text-sm font-bold" style={{ color: accent }}>{title}</h3>
      <p className="mb-1 text-[11px] leading-snug text-gray-400">{desc}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}

      {/* CTA */}
      <div
        className="mt-auto flex items-center gap-1 pt-2 text-[11px] font-bold transition-all duration-fast group-active:gap-2"
        style={{ color: accent }}
      >
        <span>{cta}</span>
        <svg className="h-3 w-3 transition-transform group-active:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ─── HomeTab ──────────────────────────────────────────────────────────
export default function HomeTab() {
  const navigate = useNavigate();
  const { userData, streak, streakStatus, repairCount, dailyXP, handleTabChange } =
    useStudentContext();

  const [questDevNotice, setQuestDevNotice] = useState(false);
  const [problemHellOpen, setProblemHellOpen] = useState(false);

  const name = userData?.displayName || '학생';

  // 스트릭 수에 따른 응원 문구 — 데스크탑과 동일
  const cheer =
    streak >= 30 ? `${streak}일 연속 — 전설이 되고 있어요` :
    streak >= 14 ? `${streak}일 연속 — 이건 진짜 루틴이에요` :
    streak >= 7  ? `${streak}일 연속 — 한 주가 쌓였어요` :
    streak >= 3  ? `${streak}일 연속 — 습관이 만들어지고 있어요` :
    streak >= 1  ? `${streak}일 연속 — 넌 이미 다름` :
    '오늘 시작하면 1일째가 돼요';

  const handleQuestClick = () => {
    // TODO: 퀘스트 기능 개발 완료 후 handleTabChange('quest')로 교체
    setQuestDevNotice(true);
    setTimeout(() => setQuestDevNotice(false), 2500);
  };

  return (
    // h-full: 부모 100dvh 꽉 채움. pb-[72px] = BottomNav(56px) + 여유(16px) 확보.
    <div className="relative flex flex-col overflow-y-auto px-4 pb-[72px] pt-3" style={{ height: '100dvh' }}>

      {/* ── 퀘스트 개발중 오버레이 ────────────────────────────────── */}
      {questDevNotice && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="flex items-center gap-4 rounded-2xl px-7 py-5"
            style={{ background: '#0c0c0c', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}
          >
            <span className="text-4xl">🛠️</span>
            <div>
              <p className="text-base font-black tracking-widest uppercase text-amber-400">퀘스트 조합 개발중</p>
              <p className="text-sm text-gray-500">곧 만나요!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 인사 + 응원 문구 ─────────────────────────────────────── */}
      <div className="mb-3 shrink-0 text-center">
        <h2 className="text-xl font-black text-white">{name}님, 오늘도 한 판 해볼까요?</h2>
        <p className="text-xs" style={{ color: '#4ec9b0' }}>{cheer}</p>
      </div>

      {/* ── 스트릭 상태 배너 ─────────────────────────────────────── */}
      <div className="shrink-0">
        <StreakBanner streakStatus={streakStatus} streak={streak} repairCount={repairCount} />
      </div>

      {/* ── "눌러서 시작" 힌트 ───────────────────────────────────── */}
      <div className="mb-2 flex shrink-0 items-center gap-1.5">
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-[11px] font-semibold text-gray-300">눌러서 시작해보세요</span>
      </div>

      {/* ── 오늘의 퀘스트 카드 ───────────────────────────────────── */}
      <div className="mb-3 shrink-0">
        <QuestCard dailyXP={dailyXP} onClick={handleQuestClick} />
      </div>

      {/* ── 하단 2카드 (마스터노트 / 문제지옥) ──────────────────── */}
      {/* flex-1로 남은 세로 공간을 꽉 채움 → 스크롤 없이 화면에 딱 맞음 */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        <BottomCard
          accent="#38bdf8"
          icon={
            <svg className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          }
          title="마스터노트"
          desc="코드노트, AI코드생성, 용어번역, 메모, AI문제출제, GitHub코드불러오기"
          sub="각종툴로 편하게 공부에만 집중하세요."
          cta="시작하기"
          onClick={() => { handleTabChange('levelup'); navigate('/study'); }}
        />
        <BottomCard
          accent="#a855f7"
          icon={
            <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          }
          title="문제지옥"
          desc="과목별 문제를 풀며 티어를 올립니다."
          sub="Java, React, Python, GitHub... 뭐든 OK"
          cta="도전하기"
          onClick={() => setProblemHellOpen(true)}
        />
      </div>

      {/* 문제지옥 오버레이 — 데스크탑 LevelUpView를 모바일 풀스크린으로 */}
      <MobileProblemHellOverlay
        isOpen={problemHellOpen}
        onClose={() => setProblemHellOpen(false)}
      />

    </div>
  );
}
