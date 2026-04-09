import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';

// 마지막 접속 기준 활성도 티어
const getActivityTier = (lastStudiedAt) => {
  if (!lastStudiedAt) return { label: '미접속', color: '#ef4444', dot: 'bg-[#ef4444]' };
  const days = (Date.now() - (lastStudiedAt?.toDate ? lastStudiedAt.toDate().getTime() : new Date(lastStudiedAt).getTime())) / 86400000;
  if (days < 1)  return { label: '오늘',     color: '#4ec9b0', dot: 'bg-[#4ec9b0]' };
  if (days < 3)  return { label: '3일 이내', color: '#569cd6', dot: 'bg-[#569cd6]' };
  if (days < 7)  return { label: '7일 이내', color: '#dcdcaa', dot: 'bg-[#dcdcaa]' };
  return         { label: '이탈 위험', color: '#ef4444', dot: 'bg-[#ef4444]' };
};

const getTierBadge = (level) => {
  if (level >= 10) return { label: '마스터',  color: '#f59e0b' };
  if (level >= 7)  return { label: '다이아',  color: '#569cd6' };
  if (level >= 5)  return { label: '플래티넘', color: '#4ec9b0' };
  if (level >= 3)  return { label: '골드',    color: '#dcdcaa' };
  if (level >= 2)  return { label: '실버',    color: '#aaaaaa' };
  return                  { label: '브론즈',  color: '#ce9178' };
};

const getFifaTheme = (level) => {
  if (level >= 10) return { bg: 'linear-gradient(160deg, #1a1200 0%, #4a3200 40%, #c8860a 100%)', shine: '#ffd700', foil: 'rgba(255,215,0,0.15)' };
  if (level >= 7)  return { bg: 'linear-gradient(160deg, #001a2e 0%, #003a5c 40%, #1e8bc3 100%)', shine: '#60c8ff', foil: 'rgba(96,200,255,0.12)' };
  if (level >= 5)  return { bg: 'linear-gradient(160deg, #001a16 0%, #003328 40%, #0d9974 100%)', shine: '#4ec9b0', foil: 'rgba(78,201,176,0.12)' };
  if (level >= 3)  return { bg: 'linear-gradient(160deg, #1a1600 0%, #3a3200 40%, #9a8600 100%)', shine: '#dcdcaa', foil: 'rgba(220,220,100,0.12)' };
  if (level >= 2)  return { bg: 'linear-gradient(160deg, #111111 0%, #252525 40%, #555555 100%)', shine: '#aaaaaa', foil: 'rgba(180,180,180,0.1)' };
  return             { bg: 'linear-gradient(160deg, #1a0d00 0%, #3a2000 40%, #8b5a00 100%)', shine: '#ce9178', foil: 'rgba(180,120,80,0.12)' };
};

const FifaCard = ({ student }) => {
  // syncUserStatus가 저장한 level만 사용 (미설정 시 1로 고정 — 방문 파일 수로 추정하지 않음)
  const level   = student.level != null ? student.level : 1;
  const activity = getActivityTier(student.lastStudiedAt);
  const badge   = getTierBadge(level);
  const theme   = getFifaTheme(level);
  const streak  = student.streak || 0;
  const dailyXP = student.dailyXP || 0;
  const weeklyRoutine = student.weeklyRoutineClear || 0;
  const initials = (student.displayName || '?')[0].toUpperCase();

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-2 hover:scale-[1.03] select-none print-card"
      style={{
        background: theme.bg,
        boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px ${theme.shine}30, inset 0 1px 0 ${theme.shine}25`,
        width: '100%',
        aspectRatio: '2/3',
      }}
    >
      {/* 홀로그램 포일 */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 20%, ${theme.foil} 0%, transparent 60%)` }} />

      {/* 상단: 레벨 + 티어 */}
      <div className="absolute top-3 left-3 flex flex-col items-center leading-none">
        <span className="text-2xl font-black drop-shadow-lg" style={{ color: theme.shine, textShadow: `0 0 12px ${theme.shine}` }}>
          {level}
        </span>
        <span className="text-[8px] font-black tracking-wider mt-0.5" style={{ color: theme.shine, opacity: 0.85 }}>
          {badge.label.toUpperCase()}
        </span>
      </div>

      {/* 우상단: 활성도 점 + studentType 뱃지 */}
      <div className="absolute top-3 right-2 flex flex-col items-end gap-1">
        <div className={`w-2 h-2 rounded-full ${activity.label === '오늘' ? 'animate-pulse' : ''}`}
          style={{ background: activity.color, boxShadow: `0 0 6px ${activity.color}` }} />
        {student.studentType === 'major' && (
          <span className="text-[7px] font-black text-purple-300 leading-none" style={{ textShadow: '0 0 4px rgba(168,85,247,0.8)' }}>🎓</span>
        )}
        {student.studentType === 'experienced' && (
          <span className="text-[7px] font-black text-yellow-300 leading-none" style={{ textShadow: '0 0 4px rgba(250,204,21,0.8)' }}>⚡</span>
        )}
        {(!student.studentType || student.studentType === 'beginner') && (
          <span className="text-[7px] font-black text-gray-400 leading-none">일반</span>
        )}
      </div>

      {/* 아바타 */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '15%', bottom: '32%' }}>
        {student.photoBase64 ? (
          <img src={student.photoBase64} alt={student.displayName}
            className="w-full h-full object-cover object-top"
            style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }} />
        ) : (
          <div className="flex items-center justify-center w-16 h-16 rounded-full"
            style={{ background: `radial-gradient(circle, ${theme.shine}30, ${theme.shine}10)`, border: `2px solid ${theme.shine}40` }}>
            <span className="text-4xl font-black" style={{ color: theme.shine, textShadow: `0 0 20px ${theme.shine}` }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* 하단 패널 */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)' }}>

        {/* 이름 */}
        <p className="text-center text-[11px] font-black tracking-wide text-white truncate mb-0.5"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          {(student.displayName || '이름 없음').toUpperCase()}
        </p>

        {/* 루틴 진행 바 (주간) */}
        <div className="flex items-center gap-1 mb-1.5 px-0.5">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex-1 h-0.5 rounded-full" style={{
              background: i <= weeklyRoutine ? theme.shine : `${theme.shine}20`
            }} />
          ))}
        </div>

        {/* 구분선 */}
        <div className="h-px mb-2 mx-1" style={{ background: `linear-gradient(to right, transparent, ${theme.shine}60, transparent)` }} />

        {/* 스탯 3개 */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            { val: streak,       label: '연속' },
            { val: dailyXP,      label: '오늘XP' },
            { val: weeklyRoutine + '/5', label: '루틴' },
          ].map(({ val, label }) => (
            <div key={label}>
              <div className="text-[11px] font-black leading-none" style={{ color: theme.shine }}>{val}</div>
              <div className="text-[6px] font-bold text-white/40 tracking-widest mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StudentDashboard = () => {
  const [users, setUsers]   = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const printRef = useRef();

  useEffect(() => {
    let ul = false, gl = false;
    const check = () => { if (ul && gl) setLoading(false); };
    const unU = onSnapshot(collection(db, 'users'), s => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'admin'));
      ul = true; check();
    }, () => { ul = true; check(); });
    const unG = onSnapshot(collection(db, 'groups'), s => {
      setGroups(s.docs.map(d => ({ id: d.id, ...d.data() })));
      gl = true; check();
    }, () => { gl = true; check(); });
    return () => { unU(); unG(); };
  }, []);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'lucid-print-style';
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #lucid-print-target { display: block !important; }
        #lucid-print-target { color: black; background: white; }
        .print-card { break-inside: avoid; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    const el = printRef.current;
    if (el) el.id = 'lucid-print-target';
    window.print();
    setTimeout(() => {
      document.getElementById('lucid-print-style')?.remove();
      if (el) el.removeAttribute('id');
    }, 1000);
  };

  // 그룹별 학생
  const groupedStudents = groups
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(g => ({
      ...g,
      students: users
        .filter(u => u.groupIDs?.includes(g.id))
        .sort((a, b) => {
          const ta = a.lastStudiedAt?.toDate?.() || new Date(0);
          const tb = b.lastStudiedAt?.toDate?.() || new Date(0);
          return tb - ta;
        }),
    }));

  const ungrouped = users.filter(u => !u.groupIDs || u.groupIDs.length === 0);

  // 요약 통계
  const today = users.filter(u => {
    if (!u.lastStudiedAt) return false;
    const ts = u.lastStudiedAt?.toDate ? u.lastStudiedAt.toDate() : new Date(u.lastStudiedAt);
    return (Date.now() - ts) / 86400000 < 1;
  }).length;

  const atRisk = users.filter(u => {
    if (!u.lastStudiedAt) return true;
    const ts = u.lastStudiedAt?.toDate ? u.lastStudiedAt.toDate() : new Date(u.lastStudiedAt);
    return (Date.now() - ts) / 86400000 >= 7;
  }).length;

  const avgDailyXP = users.length > 0
    ? Math.round(users.reduce((s, u) => s + (u.dailyXP || 0), 0) / users.length)
    : 0;

  const displayGroups = selectedGroup === 'all'
    ? groupedStudents
    : groupedStudents.filter(g => g.id === selectedGroup);

  return (
    <div className="flex flex-col gap-6 animate-fade-in" ref={printRef}>
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">학생 현황 대시보드</h2>
          <p className="text-gray-400 text-sm mt-1">기수/반별 학습 활성도를 한눈에 확인합니다</p>
        </div>

        <div className="flex items-center gap-3">
          {/* 통계 카드 */}
          <div className="text-center px-4 py-2 rounded-xl bg-[#4ec9b0]/[0.07] border border-[#4ec9b0]/20">
            <div className="text-lg font-black" style={{ color: '#4ec9b0' }}>{today}</div>
            <div className="text-[9px] text-gray-500 font-bold">오늘 접속</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="text-lg font-black text-white">{users.length}</div>
            <div className="text-[9px] text-gray-500 font-bold">전체 학생</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-[#569cd6]/[0.07] border border-[#569cd6]/20">
            <div className="text-lg font-black" style={{ color: '#569cd6' }}>{avgDailyXP}</div>
            <div className="text-[9px] text-gray-500 font-bold">평균 오늘XP</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-[#ef4444]/[0.07] border border-[#ef4444]/20">
            <div className="text-lg font-black" style={{ color: '#ef4444' }}>{atRisk}</div>
            <div className="text-[9px] text-gray-500 font-bold">이탈 위험</div>
          </div>

          {/* PDF 출력 버튼 */}
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            출력
          </button>
        </div>
      </div>

      {/* 그룹 필터 탭 */}
      <div className="no-print flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
            selectedGroup === 'all'
              ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/40 text-[#4ec9b0]'
              : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white'
          }`}
        >
          전체
        </button>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedGroup === g.id
                ? 'bg-[#569cd6]/15 border-[#569cd6]/40 text-[#569cd6]'
                : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* 범례 + 뱃지 설명 */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
        {[
          { color: '#4ec9b0', label: '오늘 접속' },
          { color: '#569cd6', label: '3일 이내' },
          { color: '#dcdcaa', label: '7일 이내' },
          { color: '#ef4444', label: '이탈 위험' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="ml-2 flex items-center gap-3 text-gray-600">
          <span>🎓 전공</span>
          <span>⚡ 경험자</span>
          <span>일반</span>
          <span className="text-gray-700">루틴 바 = 주간 5일</span>
        </div>
      </div>

      {loading ? (
        <LucidLoader text="Loading Dashboard..." />
      ) : (
        <div className="flex flex-col gap-10">
          {displayGroups.map(g => {
            const todayCount = g.students.filter(s => {
              if (!s.lastStudiedAt) return false;
              const ts = s.lastStudiedAt?.toDate ? s.lastStudiedAt.toDate() : new Date(s.lastStudiedAt);
              return (Date.now() - ts) / 86400000 < 1;
            }).length;

            const majorCount   = g.students.filter(s => s.studentType === 'major').length;
            const expCount     = g.students.filter(s => s.studentType === 'experienced').length;
            const beginnerCount = g.students.filter(s => !s.studentType || s.studentType === 'beginner').length;

            return (
              <div key={g.id}>
                {/* 그룹 헤더 */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <h3 className="text-base font-black text-white">{g.name}</h3>
                  <span className="text-xs text-gray-500 font-semibold">{g.students.length}명</span>
                  {majorCount > 0 && (
                    <span className="text-[10px] font-bold text-purple-400">🎓 전공 {majorCount}명</span>
                  )}
                  {expCount > 0 && (
                    <span className="text-[10px] font-bold text-yellow-400">⚡ 경험자 {expCount}명</span>
                  )}
                  {beginnerCount > 0 && (
                    <span className="text-[10px] font-bold text-gray-500">일반 {beginnerCount}명</span>
                  )}
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] font-bold" style={{ color: '#4ec9b0' }}>
                    오늘 {todayCount}명 접속
                  </span>
                </div>

                {g.students.length === 0 ? (
                  <p className="text-gray-600 text-sm px-2">배정된 학생 없음</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {g.students.map(s => (
                      <FifaCard key={s.id} student={s} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 미배정 */}
          {selectedGroup === 'all' && ungrouped.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-base font-black text-[#ef4444]">미배정</h3>
                <span className="text-xs text-gray-500 font-semibold">{ungrouped.length}명</span>
                <div className="flex-1 h-px bg-[#ef4444]/20" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {ungrouped.map(s => (
                  <FifaCard key={s.id} student={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
