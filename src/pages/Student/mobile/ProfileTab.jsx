/**
 * ProfileTab — 모바일 프로필 탭
 *
 * 데스크탑 StudentPage 사이드바 디자인 그대로 모바일에 이식.
 * LV 배지 / 이름 / 뱃지 / XP바 / 날짜+얼리기 / 출석달력 / 오늘 XP / 원두
 */
import React, { useContext, useState } from 'react';
import { StudentContext } from '@/pages/Student/mobile/MobileStudentPage';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import HapticButton from '@/components/common/mobile/HapticButton';
import ActionSheet from '@/components/common/mobile/ActionSheet';
import TypingBadge from '@/components/common/TypingBadge';
import haptic from '@/lib/haptic';
import {
  calcLevel,
  LEVEL_TABLE,
  DAILY_XP_CAP,
} from '@/services/learningService';

// ─── 출석 달력 컴포넌트 ─────────────────────────────────────────────────
function AttendanceCalendar({ userData }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMon,  setCalMon]  = useState(now.getMonth());

  const dayLabels = ['일','월','화','수','목','금','토'];
  const isCurrentMonth = calYear === now.getFullYear() && calMon === now.getMonth();
  const todayDate  = isCurrentMonth ? now.getDate() : -1;
  const firstDow   = new Date(calYear, calMon, 1).getDay();
  const daysInMon  = new Date(calYear, calMon + 1, 0).getDate();

  const yearStr = String(calYear);
  const monStr  = String(calMon + 1).padStart(2, '0');

  const attendedDates = new Set(
    (userData?.attendedDates || [])
      .filter(s => s.startsWith(`${yearStr}-${monStr}-`))
      .map(s => parseInt(s.slice(8), 10))
  );
  const frozenDates = new Set(
    (userData?.frozenDates || [])
      .filter(s => s.startsWith(`${yearStr}-${monStr}-`))
      .map(s => parseInt(s.slice(8), 10))
  );

  // 실시간 연속 출석 계산
  const calcLiveStreak = () => {
    const attendedSet = new Set(userData?.attendedDates || []);
    const frozenSet   = new Set(userData?.frozenDates || []);
    if (attendedSet.size === 0 && frozenSet.size === 0) return 0;
    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const yday = new Date(); yday.setDate(yday.getDate() - 1);
    const ydayIso = `${yday.getFullYear()}-${String(yday.getMonth()+1).padStart(2,'0')}-${String(yday.getDate()).padStart(2,'0')}`;
    const covered = (iso) => attendedSet.has(iso) || frozenSet.has(iso);
    if (!covered(todayIso) && !covered(ydayIso)) return 0;
    let count = 0;
    const cursor = new Date(todayIso);
    if (!covered(todayIso)) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!covered(iso)) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  };
  const liveStreak = calcLiveStreak();

  // 달력 셀
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  const rem = cells.length % 7;
  if (rem > 0) for (let i = 0; i < 7 - rem; i++) cells.push(null);

  const moveMon = (delta) => {
    const base = new Date(calYear, calMon + delta, 1);
    setCalYear(base.getFullYear());
    setCalMon(base.getMonth());
  };

  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.07),rgba(245,158,11,0.04))', border: '1px solid rgba(251,191,36,0.22)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => moveMon(-1)} className="text-gray-500 hover:text-white transition-colors text-xs px-1">◀</button>
          <span className="text-[11px] font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>
            {calYear}.{String(calMon+1).padStart(2,'0')} 출석
          </span>
          <button
            onClick={() => moveMon(1)}
            disabled={isCurrentMonth}
            className="text-gray-500 hover:text-white transition-colors text-xs px-1 disabled:opacity-20"
          >▶</button>
        </div>
        <span className="text-[11px] font-bold" style={liveStreak >= 7 ? { color: '#fbbf24', textShadow: '0 0 6px rgba(251,191,36,0.6)' } : { color: 'rgba(107,114,128,1)' }}>
          {liveStreak > 0 ? `${liveStreak}일 연속 🔥` : '시작! 🌱'}
        </span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d, idx) => (
          <div key={d} className="text-center text-[9px] font-bold"
            style={{ color: idx === 0 ? 'rgba(248,113,113,0.8)' : idx === 6 ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.35)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square rounded" style={{ background: 'rgba(255,255,255,0.01)' }} />;
          const isToday   = isCurrentMonth && d === todayDate;
          const attended  = attendedDates.has(d);
          const isFuture  = isCurrentMonth && d > todayDate;
          const col       = i % 7;
          const isFrozen  = frozenDates.has(d) && !attended;

          if (isFrozen) return (
            <div key={i} className="aspect-square relative flex items-center justify-center rounded text-[9px]"
              style={{ background: 'linear-gradient(145deg,rgba(147,210,255,0.4),rgba(86,156,214,0.25))', border: '1px solid rgba(147,210,255,0.7)' }}>
              🧊
            </div>
          );
          if (attended) return (
            <div key={i} className="aspect-square flex items-center justify-center rounded text-[9px]"
              style={{ background: isToday ? 'linear-gradient(135deg,#4ec9b0,#38bdf8)' : 'rgba(78,201,176,0.2)', border: isToday ? 'none' : '1px solid rgba(78,201,176,0.5)' }}>
              {isToday ? <span style={{ color: '#0d1117', fontSize: '10px' }}>✓</span> : <span style={{ color: '#4ec9b0', fontSize: '10px' }}>✓</span>}
            </div>
          );
          if (isFuture || (isCurrentMonth && d > todayDate)) return (
            <div key={i} className="aspect-square flex items-center justify-center rounded text-[9px] text-gray-700"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              {d}
            </div>
          );
          // 과거 결석
          return (
            <div key={i} className="aspect-square flex items-center justify-center rounded text-[9px]"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.5)' }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 오늘의 XP 섹션 ─────────────────────────────────────────────────────
function DailyXPSection({ dailyXP }) {
  const xpPercent = Math.min((dailyXP.total / DAILY_XP_CAP) * 100, 100);

  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>오늘의 XP</span>
        <span className="text-[11px] font-bold text-gray-400">{dailyXP.total} / {DAILY_XP_CAP}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500">
        <span className={dailyXP.login > 0 ? 'text-green-400' : ''}>
          접속 {dailyXP.login > 0 ? '✓' : `+${dailyXP.login}`}
        </span>
        <span>퀘스트 {dailyXP.quest}/200</span>
        <span>문제 {dailyXP.levelup}/250</span>
      </div>
    </div>
  );
}

// ─── 원두(빈) 섹션 ──────────────────────────────────────────────────────
function BeansSection({ beanCount }) {
  return (
    <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl">☕</span>
          <span className="text-[10px] text-gray-500">아메리카노</span>
        </div>
        <div className="flex-1 text-center">
          <div className="text-xs text-gray-500">→ 교환 가능</div>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[22px] font-black" style={{ color: '#f59e0b' }}>{beanCount}</span>
          <span className="text-[10px] text-gray-500">원두</span>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function ProfileTab() {
  const { user, userData, onLogout, streak, beanCount, dailyXP, freezeCount } =
    useContext(StudentContext) ?? {};
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── 사용자 정보 ──────────────────────────────────────────────────────
  const displayName = user?.displayName ?? userData?.name ?? '게스트';
  const email       = user?.email ?? '';
  const photoURL    = user?.photoURL;

  // ── XP / 레벨 ────────────────────────────────────────────────────────
  const subjectTiers = userData?.subjectTiers ?? {};
  const totalXP = userData?.totalXP
    ?? Object.values(subjectTiers).reduce((s, t) => s + (t?.xp ?? 0), 0);

  const level         = calcLevel(totalXP);
  const currentLvXP   = LEVEL_TABLE.find(r => r.level === level)?.xp || 0;
  const nextLvXP      = LEVEL_TABLE.find(r => r.level === level + 1)?.xp || currentLvXP;
  const xpInLevel     = totalXP - currentLvXP;
  const xpForNext     = nextLvXP - currentLvXP;
  const xpPercent     = xpForNext > 0 ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100;

  // ── 날짜 ─────────────────────────────────────────────────────────────
  const now       = new Date();
  const dayNames  = ['일','월','화','수','목','금','토'];
  const dayName   = dayNames[now.getDay()];

  // ── 배지 ─────────────────────────────────────────────────────────────
  const hasCheating = !!userData?.badges?.cheatBadge;
  const hasStreak   = (userData?.streak ?? 0) >= 7;

  // ── 로그아웃 ─────────────────────────────────────────────────────────
  const handleLogoutRequest = () => { haptic.warning(); setConfirmOpen(true); };
  const handleLogout        = () => { haptic.warning(); onLogout?.(); };

  return (
    <>
      <Screen
        bottomTab
        appBar={<MobileTopBar title="프로필" largeTitle blurBg leading={null} />}
        animate="fade"
      >
        {/* ── 헤더: Lucid 워드마크 ── */}
        <div className="px-4 pt-1 pb-3 flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-lg border border-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#p-logo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="p-logo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ec9b0" />
                  <stop offset="100%" stopColor="#569cd6" />
                </linearGradient>
              </defs>
              <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
            </svg>
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">Lucid</h1>
        </div>

        {/* ── 프로필 + 레벨 카드 ── */}
        <div className="mx-4 mb-3 relative p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(167,139,250,0.12),rgba(139,92,246,0.06))', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.1)' }}>

          {/* 배지들 */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {hasCheating && (
              <div className="flex items-center gap-0.5 px-1.5 h-[20px] rounded"
                style={{ background: 'linear-gradient(135deg,rgba(148,163,184,0.18),rgba(148,163,184,0.06))', border: '1px solid rgba(148,163,184,0.6)' }}>
                <span className="text-[10px]">🤫</span>
                <span className="text-[10px] font-black" style={{ color: 'rgba(148,163,184,1)' }}>개발자정신</span>
              </div>
            )}
            <TypingBadge typingStats={userData?.typingStats} />
            {hasStreak && (
              <div className="flex items-center gap-0.5 px-1.5 h-[20px] rounded"
                style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.18),rgba(251,191,36,0.06))', border: '1px solid rgba(251,191,36,0.6)' }}>
                <span className="text-[10px]">🔥</span>
                <span className="text-[10px] font-black" style={{ color: 'rgba(251,191,36,1)' }}>{userData?.streak}일</span>
              </div>
            )}
          </div>

          {/* LV 배지 + 이름 */}
          <div className="flex items-center gap-3 mb-2 pr-24">
            {/* 아바타 or LV */}
            <div className="w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0 overflow-hidden"
              style={{ background: photoURL ? undefined : 'linear-gradient(135deg,rgba(167,139,250,0.3),rgba(139,92,246,0.2))', border: '2px solid rgba(167,139,250,0.6)', boxShadow: '0 0 16px rgba(139,92,246,0.5)' }}>
              {photoURL ? (
                <img src={photoURL} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-[8px] font-bold leading-none" style={{ color: 'rgba(216,180,254,0.7)' }}>LV</span>
                  <span className="text-lg font-black leading-none" style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(216,180,254,0.8)' }}>{level}</span>
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-black text-white truncate">{displayName}</div>
              {email && <div className="text-[10px] text-gray-500 truncate">{email}</div>}
            </div>
          </div>

          {/* XP 진행바 */}
          <div className="flex justify-between text-[9px] mb-1 px-0.5" style={{ color: 'rgba(216,180,254,0.5)' }}>
            <span>{xpInLevel} XP</span>
            <span>다음 레벨까지 {Math.max(0, xpForNext - xpInLevel)} XP</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg,#a78bfa,#7c3aed)', boxShadow: '0 0 10px rgba(139,92,246,0.7)' }} />
          </div>
        </div>

        {/* ── 날짜 + 얼리기 그리드 ── */}
        <div className="mx-4 grid grid-cols-2 gap-2 mb-3">
          <div className="text-center p-3 rounded-xl border border-theme-primary/20"
            style={{ background: 'linear-gradient(135deg,rgba(78,201,176,0.18),rgba(78,201,176,0.06))' }}>
            <div className="text-[8px] font-bold text-gray-500 tracking-widest mb-0.5">
              {now.getFullYear()}.{String(now.getMonth()+1).padStart(2,'0')}
            </div>
            <div className="text-2xl font-black text-white leading-none">{now.getDate()}</div>
            <div className="text-[10px] font-bold mt-0.5"
              style={{ color: now.getDay()===0 ? 'rgba(248,113,113,0.9)' : now.getDay()===6 ? 'rgba(96,165,250,0.9)' : 'rgba(255,255,255,0.5)' }}>
              {dayName}요일
            </div>
          </div>
          <div className="text-center p-3 rounded-xl"
            style={{ background: 'rgba(147,197,253,0.08)', border: '1px solid rgba(147,197,253,0.35)' }}>
            <div className="text-2xl font-black" style={{ color: '#93c5fd' }}>{freezeCount ?? 0}</div>
            <div className="text-[10px] font-semibold text-gray-400 mt-0.5">얼리기 🧊</div>
          </div>
        </div>

        {/* ── 출석 달력 ── */}
        <div className="mx-4">
          <AttendanceCalendar userData={userData} />
        </div>

        {/* ── 오늘의 XP ── */}
        <div className="mx-4">
          <DailyXPSection dailyXP={dailyXP ?? { total: 0, quest: 0, levelup: 0, login: 0 }} />
        </div>

        {/* ── 원두 ── */}
        <div className="mx-4">
          <BeansSection beanCount={beanCount ?? 0} />
        </div>

        {/* ── 로그아웃 ── */}
        <div className="mx-4 mt-4 mb-4">
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

      {/* 로그아웃 확인 */}
      <ActionSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="정말 로그아웃 할까요?"
        actions={[{ label: '로그아웃', onPress: handleLogout, destructive: true }]}
        cancelLabel="취소"
      />
    </>
  );
}
