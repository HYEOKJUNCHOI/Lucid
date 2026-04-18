import { cn } from '@/lib/cn';
import { useStudentContext } from '@/pages/Student/MobileStudentRoot';
import { calcLevel, LEVEL_TABLE, DAILY_XP_CAP } from '@/services/learningService';

// ─── 스탯 배지 ────────────────────────────────────────────────────────────────
// 상단 한 줄에 수치를 요약해서 보여주는 작은 칩.
// 모바일은 공간이 좁으므로 아이콘 + 숫자만 표시하고 라벨은 툴팁으로 처리.
function StatChip({ icon, value, label, color }) {
  return (
    <div
      title={label}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-pill',
        'border bg-white/[0.03] select-none'
      )}
      style={{ borderColor: `${color}30` }}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="text-xs font-black leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// ─── 모드 카드 ────────────────────────────────────────────────────────────────
// 홈의 핵심 — 탭/모드 진입 카드. 2×2 그리드 배치.
// accent 색은 데스크탑 사이드바의 모드 카드 색과 동일하게 맞춤.
function ModeCard({ icon, title, desc, accent, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start gap-1.5 p-4 rounded-card',
        'border text-left transition-all duration-fast active:scale-[0.97]',
        'bg-white/[0.02] hover:bg-white/[0.04]'
      )}
      style={{
        borderColor: `${accent}25`,
        boxShadow: `0 0 0 0 ${accent}00`,
      }}
      // 손가락으로 누를 때 살짝 빛나는 느낌
      onTouchStart={(e) => {
        e.currentTarget.style.boxShadow = `0 0 16px ${accent}30`;
        e.currentTarget.style.borderColor = `${accent}55`;
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0 ${accent}00`;
        e.currentTarget.style.borderColor = `${accent}25`;
      }}
    >
      {/* 아이콘 */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: `${accent}15` }}
      >
        {icon}
      </div>

      {/* 텍스트 */}
      <div className="min-w-0">
        <p className="text-[13px] font-black text-white leading-tight">{title}</p>
        <p className="text-[11px] text-gray-500 leading-tight mt-0.5 truncate">{desc}</p>
      </div>

      {/* 뱃지 (예: "NEW", 완료 수 등) */}
      {badge && (
        <span
          className="absolute top-2.5 right-2.5 text-[9px] font-black px-1.5 py-0.5 rounded-pill"
          style={{ background: `${accent}25`, color: accent }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── XP 프로그레스 바 ─────────────────────────────────────────────────────────
// 다음 레벨까지 XP를 시각화. 좁은 화면에서도 한 줄로 표현.
function XpBar({ totalXP }) {
  const level = calcLevel(totalXP);
  const curRow  = LEVEL_TABLE.find((r) => r.level === level);
  const nextRow = LEVEL_TABLE.find((r) => r.level === level + 1);

  const curBase  = curRow?.xp  ?? 0;
  const nextBase = nextRow?.xp ?? curBase + 1;
  const progress = Math.min(((totalXP - curBase) / (nextBase - curBase)) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      {/* 레벨 뱃지 */}
      <span className="text-[11px] font-black text-theme-primary shrink-0">Lv.{level}</span>

      {/* 바 */}
      <div className="flex-1 h-1.5 rounded-pill bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-pill bg-theme-primary transition-all duration-slow"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 다음 레벨까지 남은 XP */}
      <span className="text-[10px] text-gray-500 shrink-0">
        {nextBase - totalXP} XP
      </span>
    </div>
  );
}

// ─── HomeTab ──────────────────────────────────────────────────────────────────
export default function HomeTab() {
  const { userData, streak, dailyXP, freezeCount, beanCount, handleTabChange } =
    useStudentContext();

  const totalXP    = userData?.totalXP    ?? 0;
  const displayName = userData?.displayName ?? '학생';

  // 오늘 XP 진행 (일일 캡 대비)
  const todayXPPercent = Math.min((dailyXP.total / DAILY_XP_CAP) * 100, 100);

  // ─── 모드 카드 정의 ────────────────────────────────────────────────────
  // accent 색은 데스크탑 사이드바 모드 색과 동일하게 맞춤 (디자인 통일성)
  const MODE_CARDS = [
    {
      id: 'learn',
      icon: '📖',
      title: '챕터 학습',
      desc: '코드 읽고 AI와 대화',
      accent: '#4ec9b0', // theme-primary (teal)
    },
    {
      id: 'quest',
      icon: '🎯',
      title: '오늘의 퀘스트',
      desc: '추천 파일 학습',
      accent: '#f59e0b', // amber
    },
    {
      id: 'levelup',
      icon: '⚡',
      title: '레벨업',
      desc: '문제 풀고 레벨 확인',
      accent: '#a78bfa', // violet
    },
    {
      id: 'levelup', // 마스터노트는 레벨업 탭 내부에서 진입
      icon: '📝',
      title: '마스터노트',
      desc: '자유 복습 & 예습',
      accent: '#569cd6', // blue
    },
  ];

  return (
    // h-full: MobileAppShell의 content 영역을 꽉 채움 (overflow 없음)
    <div className="flex h-full flex-col px-4 pb-4 pt-3">

      {/* ── 인사 + 이름 ──────────────────────────────────────────────── */}
      <div className="mb-3 shrink-0">
        <p className="text-[11px] text-gray-500">
          {new Date().getHours() < 12 ? '좋은 아침이에요 ☀️' : '안녕하세요 👋'}
        </p>
        <h2 className="text-lg font-black text-white leading-tight">{displayName}</h2>
      </div>

      {/* ── 스탯 칩 행 ───────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap gap-1.5 shrink-0">
        <StatChip icon="🔥" value={`${streak}일`}  label={`연속 출석 ${streak}일`}  color="#f97316" />
        <StatChip icon="⚡" value={`${dailyXP.total}XP`} label={`오늘 ${dailyXP.total}/${DAILY_XP_CAP}XP`} color="#f59e0b" />
        <StatChip icon="🧊" value={freezeCount}    label={`얼리기 ${freezeCount}개 남음`} color="#60a5fa" />
        <StatChip icon="☕" value={beanCount}       label={`원두 ${beanCount}개`}     color="#d97706" />
      </div>

      {/* ── XP 프로그레스 ─────────────────────────────────────────────── */}
      <div className="mb-4 shrink-0">
        <XpBar totalXP={totalXP} />
        {/* 오늘 XP 캡 진행 */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-gray-600 shrink-0">오늘</span>
          <div className="flex-1 h-1 rounded-pill bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-pill bg-amber-400/60 transition-all duration-slow"
              style={{ width: `${todayXPPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-600 shrink-0">{dailyXP.total}/{DAILY_XP_CAP}</span>
        </div>
      </div>

      {/* ── 모드 카드 2×2 그리드 ─────────────────────────────────────── */}
      {/* flex-1로 남은 공간을 카드가 꽉 채움 — 스크롤 없이 화면에 딱 맞음 */}
      <div className="grid flex-1 grid-cols-2 gap-2.5 overflow-hidden">
        {MODE_CARDS.map((card, idx) => (
          <ModeCard
            key={idx}
            icon={card.icon}
            title={card.title}
            desc={card.desc}
            accent={card.accent}
            badge={card.badge}
            onClick={() => handleTabChange(card.id)}
          />
        ))}
      </div>

    </div>
  );
}
