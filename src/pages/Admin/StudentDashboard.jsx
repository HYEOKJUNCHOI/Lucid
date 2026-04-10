import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';
import CustomSelect from '../../components/common/CustomSelect';
import FifaCard, { getActivityTier } from '../../components/admin/FifaCard';

const StudentDashboard = () => {
  const [, setSearchParams] = useSearchParams();
  const [users, setUsers]   = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(
    () => localStorage.getItem('dashboard_pinned') === 'true'
      ? (localStorage.getItem('dashboard_pinned_group') || 'all')
      : 'all'
  );
  const [pinned, setPinned] = useState(
    () => localStorage.getItem('dashboard_pinned') === 'true'
  );
  const printRef = useRef();

  const handleGroupChange = (val) => {
    setSelectedGroup(val);
    if (pinned) localStorage.setItem('dashboard_pinned_group', val);
  };

  const handlePinToggle = () => {
    const next = !pinned;
    setPinned(next);
    if (next) {
      localStorage.setItem('dashboard_pinned', 'true');
      localStorage.setItem('dashboard_pinned_group', selectedGroup);
    } else {
      localStorage.removeItem('dashboard_pinned');
      localStorage.removeItem('dashboard_pinned_group');
    }
  };

  useEffect(() => {
    let ul = false, gl = false;
    const check = () => { if (ul && gl) setLoading(false); };
    const unU = onSnapshot(collection(db, 'users'), s => {
      // groupIDs가 있으면 관리자여도 학생으로 표시
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(u =>
        u.role !== 'admin' || (u.groupIDs && u.groupIDs.length > 0)
      ));
      ul = true; check();
    }, () => { ul = true; check(); });
    const unG = onSnapshot(collection(db, 'groups'), s => {
      setGroups(s.docs.map(d => ({ id: d.id, ...d.data() })));
      gl = true; check();
    }, () => { gl = true; check(); });
    return () => { unU(); unG(); };
  }, []);

  // ── 이미지 압축 (Canvas 320px / JPEG 88%) ───────────────────
  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 640;
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handlePhotoUpload = async (userId, file) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      await updateDoc(doc(db, 'users', userId), { photoBase64: compressed });
    } catch (err) {
      console.error('사진 저장 실패:', err);
    }
  };

  const handlePhotoDelete = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), { photoBase64: null });
    } catch (err) {
      console.error('사진 삭제 실패:', err);
    }
  };

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
    <>
    <div className="flex flex-col gap-6 animate-fade-in" ref={printRef}>
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">학생 현황 대시보드</h2>
          <p className="text-gray-400 text-sm mt-1">기수/반별 학습 활성도를 한눈에 확인합니다</p>
        </div>

        {/* 우측: 통계 카드 + 버튼 */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* 그룹 필터 드롭다운 + 버튼 */}
      <div className="no-print border-t border-white/[0.06] pt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <CustomSelect
            value={selectedGroup}
            onChange={handleGroupChange}
            className="w-48"
            options={[
              { value: 'all', label: '전체' },
              ...groups.map(g => ({ value: g.id, label: g.name }))
            ]}
          />
          {/* 고정 체크박스 */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none group">
            <div
              onClick={handlePinToggle}
              className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                pinned
                  ? 'bg-[#4ec9b0] border-[#4ec9b0]'
                  : 'bg-transparent border-white/20 group-hover:border-white/40'
              }`}
            >
              {pinned && (
                <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span onClick={handlePinToggle} className="text-[11px] text-gray-500 group-hover:text-gray-300 transition-colors">
              이 반 고정
            </span>
          </label>

        </div>
        {/* 우측 버튼 3개 — 동일 크기 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSearchParams({ tab: 'groups' })}
            className="no-print w-32 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4ec9b0]/10 hover:bg-[#4ec9b0] border border-[#4ec9b0]/30 text-xs text-[#4ec9b0] hover:text-black font-bold transition-all"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            수업 등록
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'students' })}
            className="no-print w-32 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500 border border-purple-500/30 text-xs text-purple-400 hover:text-white font-bold transition-all"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            학생 정보 관리
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'seats', group: selectedGroup })}
            className="no-print w-32 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-xs text-gray-400 hover:text-white font-bold transition-all"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            좌석 배치도
          </button>
        </div>
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
          <span className="text-gray-700">퀘스트 바 = 주간 5일</span>
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
                      <FifaCard key={s.id} student={s} onPhotoUpload={file => handlePhotoUpload(s.id, file)} onPhotoDelete={() => handlePhotoDelete(s.id)} />
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

    </>
  );
};

export default StudentDashboard;
