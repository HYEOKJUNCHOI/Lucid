import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';

// 활성도 티어
const getActivityTier = (lastStudiedAt) => {
  if (!lastStudiedAt) return { color: '#ef4444', border: 'border-[#ef4444]/50', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]', bg: 'bg-[#ef4444]/[0.08]', label: '미접속' };
  const days = (Date.now() - (lastStudiedAt?.toDate ? lastStudiedAt.toDate().getTime() : new Date(lastStudiedAt).getTime())) / 86400000;
  if (days < 1)  return { color: '#4ec9b0', border: 'border-[#4ec9b0]/60', glow: 'shadow-[0_0_12px_rgba(78,201,176,0.35)]',  bg: 'bg-[#4ec9b0]/[0.08]', label: '오늘' };
  if (days < 3)  return { color: '#569cd6', border: 'border-[#569cd6]/60', glow: 'shadow-[0_0_10px_rgba(86,156,214,0.3)]',  bg: 'bg-[#569cd6]/[0.08]', label: '3일내' };
  if (days < 7)  return { color: '#dcdcaa', border: 'border-[#dcdcaa]/50', glow: 'shadow-[0_0_10px_rgba(220,220,170,0.25)]', bg: 'bg-[#dcdcaa]/[0.06]', label: '7일내' };
  return         { color: '#ef4444', border: 'border-[#ef4444]/50', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]', bg: 'bg-[#ef4444]/[0.08]', label: '이탈위험' };
};

// 5테이블 × 2줄 = 10테이블, 각 4석 = 40석
// seatId 형식: "R{row}T{table}S{seat}" (row:1-5, table:1-2, seat:1-4)
const ROWS = 5;
const TABLES_PER_ROW = 2;
const SEATS_PER_TABLE = 4; // 1×4

// 강사 테이블은 칠판 아래 별도 UI로 표시 — 학생 좌석에 강사석 없음
const TEACHER_SEATS = new Set();

const generateSeatIds = () => {
  const ids = [];
  for (let r = 1; r <= ROWS; r++)
    for (let t = 1; t <= TABLES_PER_ROW; t++)
      for (let s = 1; s <= SEATS_PER_TABLE; s++)
        ids.push(`R${r}T${t}S${s}`);
  return ids;
};

const SeatChart = () => {
  const [users, setUsers]     = useState([]);
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('');
  // seatMap: { seatId: userId }
  const [seatMap, setSeatMap] = useState({});
  const [saving, setSaving]   = useState(false);
  // 배정 팝업
  const [activeSeat, setActiveSeat] = useState(null); // seatId
  const [search, setSearch]   = useState('');

  useEffect(() => {
    let ul = false, gl = false;
    const check = () => { if (ul && gl) setLoading(false); };
    const unU = onSnapshot(collection(db, 'users'), s => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'admin'));
      ul = true; check();
    }, () => { ul = true; check(); });
    const unG = onSnapshot(collection(db, 'groups'), s => {
      const gs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(gs);
      if (gs.length > 0 && !selectedGroup) setSelectedGroup(gs[0].id);
      gl = true; check();
    }, () => { gl = true; check(); });
    return () => { unU(); unG(); };
  }, []);

  // 그룹 바뀔 때 Firestore에서 좌석 불러오기
  useEffect(() => {
    if (!selectedGroup) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'seating', selectedGroup));
        setSeatMap(snap.exists() ? (snap.data().seats || {}) : {});
      } catch { setSeatMap({}); }
    };
    load();
  }, [selectedGroup]);

  const saveSeatMap = async (newMap) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'seating', selectedGroup), { seats: newMap, groupId: selectedGroup });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const assignSeat = (seatId, userId) => {
    // 같은 유저가 다른 자리에 있으면 제거
    const cleaned = Object.fromEntries(Object.entries(seatMap).filter(([, v]) => v !== userId));
    const newMap = userId ? { ...cleaned, [seatId]: userId } : { ...cleaned };
    if (!userId) delete newMap[seatId];
    setSeatMap(newMap);
    saveSeatMap(newMap);
    setActiveSeat(null);
    setSearch('');
  };

  const clearSeat = (seatId) => {
    const newMap = { ...seatMap };
    delete newMap[seatId];
    setSeatMap(newMap);
    saveSeatMap(newMap);
    setActiveSeat(null);
  };

  const groupStudents = users.filter(u => u.groupIDs?.includes(selectedGroup));
  const assignedUserIds = new Set(Object.values(seatMap));
  const unassignedStudents = groupStudents.filter(u => !assignedUserIds.has(u.id));
  const searchedStudents = (search
    ? groupStudents.filter(u => (u.displayName || '').includes(search) || (u.email || '').includes(search))
    : unassignedStudents
  ).slice(0, 20);

  const getUserById = (uid) => users.find(u => u.id === uid);

  // 사진 업로드 (base64 → Firestore)
  const handlePhotoUpload = async (userId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      try {
        await updateDoc(doc(db, 'users', userId), { photoBase64: base64 });
      } catch (err) { console.error('사진 저장 실패:', err); }
    };
    reader.readAsDataURL(file);
  };

  // 자리 렌더
  const renderSeat = (seatId) => {
    // 강사석
    if (TEACHER_SEATS.has(seatId)) {
      return (
        <div key={seatId} className="w-full rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/[0.07] text-center py-3">
          <span className="text-[9px] font-bold text-[#f59e0b]">강사</span>
        </div>
      );
    }

    const uid = seatMap[seatId];
    const student = uid ? getUserById(uid) : null;
    const tier = student ? getActivityTier(student.lastStudiedAt) : null;
    const isActive = activeSeat === seatId;
    const level = student ? Math.floor((student.visitedFilesCount || 0) / 5) + 1 : null;

    if (student && tier) {
      const fifaBg = level >= 10 ? 'linear-gradient(160deg,#1a1200,#4a3200 60%,#c8860a)'
                   : level >= 7  ? 'linear-gradient(160deg,#001a2e,#003a5c 60%,#1e8bc3)'
                   : level >= 5  ? 'linear-gradient(160deg,#001a16,#003328 60%,#0d9974)'
                   : level >= 3  ? 'linear-gradient(160deg,#1a1600,#3a3200 60%,#9a8600)'
                   : level >= 2  ? 'linear-gradient(160deg,#111,#252525 60%,#555)'
                   :               'linear-gradient(160deg,#1a0d00,#3a2000 60%,#8b5a00)';
      const shine  = level >= 10 ? '#ffd700' : level >= 7 ? '#60c8ff' : level >= 5 ? '#4ec9b0' : level >= 3 ? '#dcdcaa' : level >= 2 ? '#aaaaaa' : '#ce9178';

      return (
        <div
          key={seatId}
          className={`relative rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] cursor-pointer ${isActive ? 'ring-2 ring-white/40' : ''}`}
          style={{ background: fifaBg, boxShadow: `0 2px 12px rgba(0,0,0,0.6), 0 0 0 1px ${shine}25`, aspectRatio: '2/3' }}
          onClick={() => setActiveSeat(isActive ? null : seatId)}
        >
          {/* 포일 */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 20%, ${shine}18 0%, transparent 65%)` }} />

          {/* 레벨 */}
          <div className="absolute top-1.5 left-2 leading-none">
            <span className="text-base font-black" style={{ color: shine, textShadow: `0 0 8px ${shine}` }}>{level}</span>
          </div>

          {/* 활성도 점 */}
          <div className="absolute top-1.5 right-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${tier.label === '오늘' ? 'animate-pulse' : ''}`}
              style={{ background: tier.color, boxShadow: `0 0 4px ${tier.color}` }} />
          </div>

          {/* 아바타 */}
          <div className="absolute flex items-center justify-center" style={{ inset: '22% 0 32% 0' }}>
            {student.photoBase64 ? (
              <label className="w-full h-full cursor-pointer group/p" title="사진 변경">
                <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(student.id, e.target.files[0])} />
                <img src={student.photoBase64} alt="" className="w-full h-full object-cover object-top"
                  style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
              </label>
            ) : (
              <label className="cursor-pointer" title="사진 추가">
                <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(student.id, e.target.files[0])} />
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: `${shine}20`, border: `1px solid ${shine}35` }}>
                  <span className="text-xl font-black" style={{ color: shine }}>{(student.displayName||'?')[0]}</span>
                </div>
              </label>
            )}
          </div>

          {/* 하단 */}
          <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 pt-4"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
            <p className="text-center text-[9px] font-black text-white truncate tracking-wide"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
              {(student.displayName || '?').toUpperCase()}
            </p>
            {student.studentType === 'major' && (
              <p className="text-center text-[7px] font-bold text-purple-300" style={{ textShadow: '0 0 4px rgba(168,85,247,0.6)' }}>🎓 전공</p>
            )}
            {student.studentType === 'experienced' && (
              <p className="text-center text-[7px] font-bold text-yellow-300" style={{ textShadow: '0 0 4px rgba(250,204,21,0.6)' }}>⚡ 경험자</p>
            )}
            {(!student.studentType || student.studentType === 'beginner') && (
              <p className="text-center text-[7px] font-bold text-gray-500">일반</p>
            )}
            <div className="h-px my-1" style={{ background: `linear-gradient(to right, transparent, ${shine}50, transparent)` }} />
            <div className="grid grid-cols-3 text-center">
              {[['출석', student.streak||0], ['파일', student.visitedFilesCount||0], ['XP', (student.visitedFilesCount||0)*100]].map(([l,v]) => (
                <div key={l}>
                  <div className="text-[9px] font-black" style={{ color: shine }}>{v}</div>
                  <div className="text-[6px] text-white/30 font-bold">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* X 해제 */}
          {isActive && (
            <button onClick={e => { e.stopPropagation(); clearSeat(seatId); }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] rounded-full flex items-center justify-center text-white text-[9px] font-black z-10 hover:bg-red-400">×</button>
          )}
        </div>
      );
    }

    return (
      <button
        key={seatId}
        onClick={() => setActiveSeat(isActive ? null : seatId)}
        className={`w-full rounded-lg border border-dashed transition-all text-center py-3 ${
          isActive
            ? 'border-white/30 bg-white/[0.05]'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }`}
      >
        <span className="text-[10px] text-gray-700">빈 자리</span>
      </button>
    );
  };

  if (loading) return <LucidLoader text="Loading Seats..." />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">좌석 배치도</h2>
          <p className="text-gray-400 text-sm mt-1">강의장 B — 2테이블 × 5줄 (40석 · 강사 테이블 별도)</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-500 animate-pulse">저장 중...</span>}
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="bg-[#111] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#4ec9b0]/40"
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
        {[['#4ec9b0','오늘'],['#569cd6','3일내'],['#dcdcaa','7일내'],['#ef4444','이탈위험']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span>{l}</span>
          </div>
        ))}
        <div className="ml-auto text-gray-600">
          배정 {Object.keys(seatMap).length} / 40석 · 미배정 {unassignedStudents.length}명
        </div>
      </div>

      <div className="flex gap-6">
        {/* 강의장 */}
        <div className="flex-1 min-w-0">
          {/* 1행: 칠판 — 전체 너비 */}
          <div className="mb-2 flex items-center justify-center py-2.5 rounded-xl border border-[#569cd6]/25 bg-[#569cd6]/[0.05]">
            <span className="text-[10px] font-bold tracking-widest text-[#569cd6] uppercase">⬜ 칠판</span>
          </div>

          {/* 2행: 강사 테이블 — T2 위, 오른쪽 정렬 */}
          <div className="mb-3 grid grid-cols-2 gap-6">
            <div /> {/* T1 위 빈 공간 */}
            <div className="flex justify-end">
              <div className="flex items-center justify-center px-5 py-2 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08]">
                <span className="text-[10px] font-bold text-[#f59e0b] whitespace-nowrap">👨‍🏫 강사</span>
              </div>
            </div>
          </div>

          {/* 좌석 그리드: 2줄 × 5테이블 */}
          <div className="flex flex-col gap-3">
            {[1,2,3,4,5].map(row => (
              <div key={row} className="flex gap-4 items-center">
                {/* 줄 번호 */}
                <div className="w-5 shrink-0 text-center">
                  <span className="text-[10px] text-gray-700 font-bold">{row}</span>
                </div>
                {/* 2테이블 (좌/우) */}
                <div className="flex-1 grid grid-cols-2 gap-6">
                  {[1,2].map(table => (
                    <div key={table} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
                      {/* 테이블 번호 */}
                      <div className="text-center text-[9px] text-gray-700 font-bold mb-1.5">
                        T{(row - 1) * 2 + table}
                      </div>
                      {/* 1×4 가로 배열 (자리번호: T1=1~4, T2=5~8) */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1,2,3,4].map(seat => {
                          const seatId = `R${row}T${table}S${seat}`;
                          const globalNum = table === 1 ? seat : seat + 4;
                          return (
                            <div key={seatId} className="flex flex-col items-center gap-0.5">
                              <span className="text-[8px] text-gray-700 font-bold">{globalNum}</span>
                              {renderSeat(seatId)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 출입구 */}
          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-700">🚪 출입구</span>
          </div>
        </div>

        {/* 학생 배정 패널 */}
        <div className="w-52 shrink-0">
          <div className="sticky top-0 flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs font-bold text-gray-400 mb-2">
                {activeSeat ? `📍 ${activeSeat} 배정` : '자리를 클릭하세요'}
              </p>
              {activeSeat && (
                <>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="이름 검색..."
                    className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0]/40 mb-2"
                  />
                  <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                    {seatMap[activeSeat] && (
                      <button
                        onClick={() => clearSeat(activeSeat)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#ef4444] bg-[#ef4444]/[0.06] border border-[#ef4444]/20 hover:bg-[#ef4444]/10 transition font-bold"
                      >
                        ✕ 배정 해제
                      </button>
                    )}
                    {searchedStudents.map(u => {
                      const tier = getActivityTier(u.lastStudiedAt);
                      const isAssigned = assignedUserIds.has(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => assignSeat(activeSeat, u.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition border ${
                            isAssigned
                              ? 'border-white/[0.04] bg-white/[0.02] text-gray-600'
                              : 'border-white/[0.06] bg-white/[0.03] text-white hover:bg-white/[0.07]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.color }} />
                            <span className="truncate font-semibold">{u.displayName || u.email}</span>
                            {u.studentType === 'major' && <span className="text-[8px] text-purple-400 shrink-0">🎓</span>}
                            {u.studentType === 'experienced' && <span className="text-[8px] text-yellow-400 shrink-0">⚡</span>}
                            {(!u.studentType || u.studentType === 'beginner') && <span className="text-[8px] text-gray-600 shrink-0">일반</span>}
                            {isAssigned && <span className="text-[9px] text-gray-600 ml-auto shrink-0">배정됨</span>}
                          </div>
                        </button>
                      );
                    })}
                    {searchedStudents.length === 0 && (
                      <p className="text-xs text-gray-600 text-center py-3">학생 없음</p>
                    )}
                  </div>
                </>
              )}
              {!activeSeat && (
                <div className="flex flex-col gap-1 mt-2">
                  <p className="text-[10px] text-gray-600 mb-1">미배정 학생 ({unassignedStudents.length}명)</p>
                  {unassignedStudents.slice(0, 15).map(u => {
                    const tier = getActivityTier(u.lastStudiedAt);
                    return (
                      <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.color }} />
                        <span className="truncate">{u.displayName || u.email}</span>
                        {u.studentType === 'major' && <span className="text-[9px] text-purple-400 shrink-0">🎓</span>}
                        {u.studentType === 'experienced' && <span className="text-[9px] text-yellow-400 shrink-0">⚡</span>}
                        {(!u.studentType || u.studentType === 'beginner') && <span className="text-[9px] text-gray-600 shrink-0">일반</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatChart;
