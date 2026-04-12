/**
 * DebugPanel.jsx ⚠️ Dev Only
 * 관리자 전용 — 학생 Firestore 상태를 직접 편집하는 디버그 패널
 */

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { debugSetUserFields, debugResetUser, getUserState, debugAddAttendedDate, debugRemoveAttendedDate } from '../../services/userStateService';

// ── 전체 테스트 데이터 시드 (랜덤) ──────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const todayStr = () => new Date().toISOString().slice(0, 10);

const seedAllUsers = async (users) => {
  const batch = writeBatch(db);
  users.forEach((u) => {
    const totalXP   = rInt(50, 5000);
    const level     = Math.max(1, Math.floor(totalXP / 500) + 1);
    const streak    = rInt(0, 30);
    const beanCount = rInt(0, 25);

    // streak 만큼 연속 출석 날짜 생성
    const attended = [];
    for (let d = 0; d < streak; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      attended.push(dt.toISOString().slice(0, 10));
    }

    const bestCpm = rInt(0, 600);
    batch.update(doc(db, 'users', u.uid), {
      totalXP,
      level,
      streak,
      beanCount,
      americanoCount:  rInt(0, 8),
      streakFreezes:   rInt(0, 3),
      difficultyLevel: rInt(0, 4),
      attendedDates:   attended,
      lastRoutineDate: streak > 0 ? todayStr() : '',
      lastStudiedAt:   streak > 0 ? Date.now() - rInt(0, 86400000) : null,
      typingStats: {
        bestCpm,
        bestAccuracy: bestCpm > 0 ? rInt(80, 100) : 0,
        sessionCount: rInt(0, 80),
        totalChars:   rInt(0, 50000),
      },
    });
  });
  await batch.commit();
};
import AttendanceCalendar from '../../components/admin/AttendanceCalendar';
import { getActivityTier } from '../../components/admin/FifaCard';

const NUMBER_FIELDS = [
  { key: 'streak',            label: '연속일 (streak)' },
  { key: 'streakFreezes',     label: '얼리기 개수 (streakFreezes)' },
  { key: 'repairCount',       label: '복구 퀘스트 (-1=비활성)' },
  { key: 'streakBeforeBreak', label: '끊기 전 streak 백업' },
  { key: 'beanCount',         label: '원두 개수 (beanCount)' },
  { key: 'americanoCount',   label: '아메리카노 잔수 (americanoCount)' },
  { key: 'difficultyLevel',   label: '퀘스트 난이도 (0~4)' },
  { key: 'totalXP',           label: '누적 XP (totalXP)' },
  { key: 'level',             label: '레벨 (level)' },
];
const STRING_FIELDS = [
  { key: 'lastRoutineDate', label: '마지막 퀘스트 날짜 (YYYY-MM-DD)' },
];

const TYPING_FIELDS = [
  { key: 'bestCpm',      label: '최고 타수 (CPM)' },
  { key: 'bestAccuracy', label: '최고 정확도 (%)' },
  { key: 'sessionCount', label: '플레이 횟수' },
  { key: 'totalChars',   label: '총 입력 글자수' },
];

const TypingStatsEditor = ({ uid, typingStats, onSaved }) => {
  const ts = typingStats || {};
  const [vals, setVals] = useState({
    bestCpm:      ts.bestCpm      ?? 0,
    bestAccuracy: ts.bestAccuracy ?? 0,
    sessionCount: ts.sessionCount ?? 0,
    totalChars:   ts.totalChars   ?? 0,
  });
  const [sv, setSv] = useState({});

  useEffect(() => {
    const t = typingStats || {};
    setVals({ bestCpm: t.bestCpm ?? 0, bestAccuracy: t.bestAccuracy ?? 0, sessionCount: t.sessionCount ?? 0, totalChars: t.totalChars ?? 0 });
  }, [typingStats]);

  const apply = async (key) => {
    setSv(s => ({ ...s, [key]: true }));
    try {
      await debugSetUserFields(uid, { [`typingStats.${key}`]: Number(vals[key]) });
      await onSaved?.();
    } catch (e) { alert('저장 실패: ' + e.message); }
    finally { setSv(s => ({ ...s, [key]: false })); }
  };

  return (
    <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">타자 기록</span>
        {ts.bestCpm > 0 && <span className="text-[10px] text-gray-600">현재 {ts.bestCpm} CPM</span>}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {TYPING_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[12px] text-gray-400 w-52 shrink-0">{label}</span>
            <input
              type="number"
              value={vals[key]}
              onChange={e => setVals(v => ({ ...v, [key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && apply(key)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[13px] text-white w-28 focus:outline-none focus:border-[#4ec9b0]/50"
            />
            <button
              onClick={() => apply(key)}
              disabled={sv[key]}
              className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 hover:bg-[#4ec9b0]/30 transition-colors disabled:opacity-50"
            >{sv[key] ? '...' : '적용'}</button>
            <span className="text-[11px] text-gray-600 ml-1">
              현재: <span className="text-gray-400 font-mono">{String(ts[key] ?? '—')}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── 미니 학생 카드 ──────────────────────────────────────────────
const MiniStudentCard = ({ student, selected, onClick }) => {
  const type = student.studentType || 'beginner';
  const activity = getActivityTier(student.lastStudiedAt);
  const borderCls = selected
    ? 'border-[#4ec9b0] bg-[#4ec9b0]/[0.08] shadow-[0_0_12px_rgba(78,201,176,0.2)]'
    : type === 'major'       ? 'border-amber-400/25 hover:border-amber-400/50'
    : type === 'experienced' ? 'border-sky-400/25 hover:border-sky-400/50'
    :                          'border-white/20 hover:border-white/40';
  const displayName = student.displayName || student.email || '?';
  const level = student.level ?? 1;

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border bg-white/[0.03] flex flex-col items-center justify-center gap-0.5 pt-4 pb-2.5 px-2 cursor-pointer select-none transition-all hover:bg-white/[0.06] ${borderCls}`}
    >
      {/* 접속 dot */}
      <div className="absolute top-2 left-2 w-1.5 h-1.5">
        <div className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: activity.color }} />
        <div className="relative w-1.5 h-1.5 rounded-full" style={{ background: activity.color }} />
      </div>
      {/* 사진 or 이니셜 */}
      <div className="w-9 h-9 rounded-full overflow-hidden border border-white/[0.12] bg-white/[0.04] flex items-center justify-center shrink-0">
        {student.photoBase64
          ? <img src={student.photoBase64} alt="" draggable={false} className="w-full h-full object-cover" />
          : <span className="text-[13px] font-black text-white/30">{displayName[0]?.toUpperCase()}</span>
        }
      </div>
      {/* Lv + 이름 */}
      <div className="flex items-baseline gap-0.5 px-1 max-w-full mt-1">
        <span className="text-[7px] font-bold text-sky-400 shrink-0">Lv{level}</span>
        <span className="text-[11px] font-bold text-white/80 leading-tight truncate">{displayName}</span>
      </div>
      {/* 선택 체크 */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#4ec9b0] flex items-center justify-center">
          <span className="text-[8px] text-black font-black">✓</span>
        </div>
      )}
    </div>
  );
};

export default function DebugPanel() {
  const [users, setUsers]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedUid, setSelectedUid]     = useState('');
  const [userState, setUserState]         = useState(null);
  const [fieldValues, setFieldValues]     = useState({});
  const [saving, setSaving]               = useState({});
  const [loading, setLoading]             = useState(false);
  const [resetConfirm, setResetConfirm]   = useState(false);
  const [seeding, setSeeding]             = useState(false);
  const [seedDone, setSeedDone]           = useState(false);

  const handleSeedAll = async () => {
    if (!users.length) return;
    setSeeding(true);
    try {
      await seedAllUsers(users);
      setSeedDone(true);
      setTimeout(() => setSeedDone(false), 3000);
    } catch (e) {
      alert('시드 실패: ' + e.message);
    } finally {
      setSeeding(false);
    }
  };

  // 실시간 데이터 로드
  useEffect(() => {
    const unU = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u =>
        u.role !== 'admin' || (u.groupIDs?.length > 0)
      ));
    });
    const unG = onSnapshot(collection(db, 'groups'), snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => { unU(); unG(); };
  }, []);

  // 선택된 학생 상태 로드
  useEffect(() => {
    if (!selectedUid) { setUserState(null); setFieldValues({}); return; }
    setLoading(true);
    getUserState(selectedUid).then(data => {
      setUserState(data);
      const vals = {};
      [...NUMBER_FIELDS, ...STRING_FIELDS].forEach(({ key }) => { vals[key] = data?.[key] ?? ''; });
      setFieldValues(vals);
      setLoading(false);
    });
  }, [selectedUid]);

  const handleApply = async (key) => {
    if (!selectedUid) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const raw = fieldValues[key];
      const isNum = NUMBER_FIELDS.find(f => f.key === key);
      const value = isNum ? (raw === '' ? 0 : Number(raw)) : raw;
      await debugSetUserFields(selectedUid, { [key]: value });
      const fresh = await getUserState(selectedUid);
      setUserState(fresh);
    } catch (e) {
      alert('저장 실패: ' + e.message);
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const handleReset = async () => {
    if (!selectedUid) return;
    await debugResetUser(selectedUid);
    const fresh = await getUserState(selectedUid);
    setUserState(fresh);
    const vals = {};
    [...NUMBER_FIELDS, ...STRING_FIELDS].forEach(({ key }) => { vals[key] = fresh?.[key] ?? ''; });
    setFieldValues(vals);
    setResetConfirm(false);
  };

  // 기수별 필터링
  const filteredUsers = selectedGroup === 'all'
    ? users
    : users.filter(u => u.groupIDs?.includes(selectedGroup));

  const sortedUsers = [...filteredUsers].sort((a, b) =>
    (a.displayName || '').localeCompare(b.displayName || '', 'ko')
  );

  const selectedUser = users.find(u => u.uid === selectedUid);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30">
          ⚠️ DEV ONLY
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">디버그 패널</h2>
          <p className="text-gray-400 text-sm mt-0.5">학생 Firestore 상태 직접 편집 — 적용 즉시 학생 화면에 반영됨</p>
        </div>
        <button
          onClick={handleSeedAll}
          disabled={seeding || !users.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all border disabled:opacity-40"
          style={seedDone
            ? { background: 'rgba(78,201,176,0.15)', borderColor: 'rgba(78,201,176,0.4)', color: '#4ec9b0' }
            : { background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.35)', color: '#a78bfa' }}
        >
          {seeding ? '적용 중...' : seedDone ? '✓ 완료!' : `🎲 전체 테스트 데이터 (${users.length}명)`}
        </button>
      </div>

      {/* 기수 선택 탭 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
            selectedGroup === 'all'
              ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/40 text-[#4ec9b0]'
              : 'border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
          }`}
        >전체</button>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              selectedGroup === g.id
                ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/40 text-[#4ec9b0]'
                : 'border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
            }`}
          >{g.name}</button>
        ))}
      </div>

      {/* 학생 카드 그리드 */}
      <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">학생 선택</span>
          {selectedUser && (
            <span className="text-[10px] text-[#4ec9b0] font-bold">
              {selectedUser.displayName || selectedUser.email} 선택됨
            </span>
          )}
        </div>
        <div className="p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {sortedUsers.length === 0
            ? <p className="col-span-full text-[12px] text-gray-600 py-4 text-center">학생 없음</p>
            : sortedUsers.map(u => (
              <MiniStudentCard
                key={u.uid}
                student={u}
                selected={u.uid === selectedUid}
                onClick={() => setSelectedUid(u.uid === selectedUid ? '' : u.uid)}
              />
            ))
          }
        </div>
      </section>

      {loading && <div className="text-[13px] text-gray-400">불러오는 중...</div>}

      {!loading && selectedUid && userState && (
        <>
          {/* 숫자 필드 */}
          <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">숫자 필드</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {NUMBER_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[12px] text-gray-400 w-52 shrink-0">{label}</span>
                  <input
                    type="number"
                    value={fieldValues[key] ?? ''}
                    onChange={e => setFieldValues(v => ({ ...v, [key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleApply(key)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[13px] text-white w-28 focus:outline-none focus:border-[#4ec9b0]/50"
                  />
                  <button
                    onClick={() => handleApply(key)}
                    disabled={saving[key]}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 hover:bg-[#4ec9b0]/30 transition-colors disabled:opacity-50"
                  >{saving[key] ? '...' : '적용'}</button>
                  <span className="text-[11px] text-gray-600 ml-1">
                    현재: <span className="text-gray-400 font-mono">{String(userState?.[key] ?? '—')}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 날짜 필드 */}
          <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">날짜 필드</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {STRING_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[12px] text-gray-400 w-52 shrink-0">{label}</span>
                  <input
                    type="date"
                    value={fieldValues[key] ?? ''}
                    onChange={e => setFieldValues(v => ({ ...v, [key]: e.target.value }))}
                    className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[13px] text-white focus:outline-none focus:border-[#4ec9b0]/50"
                  />
                  <button
                    onClick={() => handleApply(key)}
                    disabled={saving[key]}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 hover:bg-[#4ec9b0]/30 transition-colors disabled:opacity-50"
                  >{saving[key] ? '...' : '적용'}</button>
                  <span className="text-[11px] text-gray-600 ml-1">
                    현재: <span className="text-gray-400 font-mono">{userState?.[key] || '—'}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 출석 달력 */}
          <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">출석 날짜 편집</span>
              <span className="text-[10px] text-gray-600">({(userState?.attendedDates || []).length}일 누적)</span>
            </div>
            <div className="px-4 py-3">
              <AttendanceCalendar
                attendedDates={userState?.attendedDates || []}
                onAdd={async (dateStr) => {
                  await debugAddAttendedDate(selectedUid, dateStr);
                  const fresh = await getUserState(selectedUid);
                  setUserState(fresh);
                }}
                onRemove={async (dateStr) => {
                  await debugRemoveAttendedDate(selectedUid, dateStr);
                  const fresh = await getUserState(selectedUid);
                  setUserState(fresh);
                }}
              />
            </div>
          </section>

          {/* 타자 기록 편집 */}
          <TypingStatsEditor
            uid={selectedUid}
            typingStats={userState?.typingStats}
            onSaved={async () => {
              const fresh = await getUserState(selectedUid);
              setUserState(fresh);
            }}
          />

          {/* 배열 미리보기 */}
          <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">배열 필드 (미리보기)</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[{ key: 'frozenDates', label: '얼린 날짜' }, { key: 'weakFiles', label: '취약 파일' }].map(({ key, label }) => (
                <div key={key} className="px-4 py-2.5">
                  <div className="text-[12px] text-gray-400 mb-1">{label}</div>
                  <div className="text-[11px] font-mono text-gray-500 bg-white/[0.02] rounded px-2 py-1 max-h-16 overflow-y-auto">
                    {(userState?.[key] || []).length === 0 ? '(비어있음)' : (userState?.[key] || []).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 위험 액션 */}
          <section className="rounded-xl bg-[#ef4444]/[0.04] border border-[#ef4444]/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ef4444]/20">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#ef4444]/70">⚠️ 위험한 액션</span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              {resetConfirm ? (
                <>
                  <span className="text-[12px] text-[#ef4444]">정말 초기화할까요? 되돌릴 수 없습니다.</span>
                  <button onClick={handleReset} className="px-3 py-1.5 rounded-lg text-[12px] font-black text-white bg-[#ef4444]/80 hover:bg-[#ef4444] transition-colors">확인, 초기화</button>
                  <button onClick={() => setResetConfirm(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-400 hover:text-white transition-colors">취소</button>
                </>
              ) : (
                <button onClick={() => setResetConfirm(true)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10 transition-colors">
                  🧹 이 학생 상태 초기화
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
