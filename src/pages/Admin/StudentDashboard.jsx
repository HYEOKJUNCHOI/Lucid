import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';
import CustomSelect from '../../components/common/CustomSelect';
import { getActivityTier } from '../../components/admin/FifaCard';

// ── 학생 카드 (간단 디자인) ─────────────────────────────────────
const StudentCard = ({ student, onPhotoUpload, onPhotoDelete }) => {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const type = student.studentType || 'beginner';
  const badge =
    type === 'major'       ? { label: '전공자', cls: 'text-amber-300 bg-amber-400/[0.18] border-amber-400/40' } :
    type === 'experienced' ? { label: '경험자', cls: 'text-sky-300 bg-sky-400/[0.18] border-sky-400/40' } :
                             { label: '일반',   cls: 'text-white/70 bg-white/[0.08] border-white/20' };
  const borderCls =
    type === 'major'       ? 'border-amber-400/25 hover:border-amber-400/50' :
    type === 'experienced' ? 'border-sky-400/25 hover:border-sky-400/50' :
                             'border-white/30 hover:border-white/60';
  const displayName = student.displayName || student.email || '?';
  const level = student.level ?? 1;
  const activity = getActivityTier(student.lastStudiedAt);

  return (
    <div className={`relative rounded-xl border bg-white/[0.03] flex flex-col items-center justify-center gap-1 pt-5 pb-3 px-2 select-none transition-all hover:bg-white/[0.06] group/card ${borderCls}`}>
      {/* 왼쪽 위: 접속 색상 dot (ping) */}
      <div className="absolute top-2 left-2 w-2 h-2">
        <div className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: activity.color }} />
        <div className="relative w-2 h-2 rounded-full" style={{ background: activity.color }} />
      </div>
      {/* 오른쪽 위: 타입 뱃지 */}
      <span className={`absolute top-2 right-2 text-[7px] font-bold px-1 py-0.5 rounded border leading-none ${badge.cls}`}>
        {badge.label}
      </span>
      {/* 중앙: 사진 래퍼 (overflow 없음 — 버튼이 밖으로 나올 수 있게) */}
      <div className="relative mt-1 group/photo">
        <div
          className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/[0.12] bg-white/[0.04] flex items-center justify-center cursor-pointer transition-all"
          onDoubleClick={e => { if (!student.photoBase64) { e.stopPropagation(); fileInputRef.current?.click(); } }}
          title={student.photoBase64 ? '호버 후 아이콘 클릭' : '더블클릭으로 사진 등록'}
        >
          {student.photoBase64
            ? <img src={student.photoBase64} alt="" draggable={false} className="w-full h-full object-cover" />
            : <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/photo:opacity-100 transition-opacity bg-white/[0.08] rounded-full">
                <span className="text-[12px] leading-none">📷</span>
                <span className="text-[6.5px] text-white/60 leading-none font-medium">더블클릭</span>
              </div>
          }
        </div>

        {/* 사진 있을 때: 원 바깥 버튼 3개 */}
        {student.photoBase64 && (
          <>
            {/* 위: 🔍 미리보기 */}
            <button
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#1a1f2e] border border-white/20 text-[11px] flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity hover:bg-white/20 cursor-pointer"
              onClick={e => { e.stopPropagation(); setShowPreview(v => !v); }}
              title="사진 보기"
            >🔍</button>
            {/* 좌: ✓ 변경 */}
            <button
              className="absolute top-1/2 -translate-y-1/2 -left-5 w-6 h-6 rounded-full bg-[#1a1f2e] border border-green-400/40 text-green-300 text-[13px] font-black flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity hover:bg-green-400/20 cursor-pointer"
              onDoubleClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              title="더블클릭으로 사진 변경"
            >✓</button>
            {/* 우: ✕ 삭제 */}
            <button
              className="absolute top-1/2 -translate-y-1/2 -right-5 w-6 h-6 rounded-full bg-[#1a1f2e] border border-red-400/40 text-red-300 text-[13px] font-black flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity hover:bg-red-400/20 cursor-pointer"
              onDoubleClick={e => { e.stopPropagation(); onPhotoDelete?.(); }}
              title="더블클릭으로 사진 삭제"
            >✕</button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onClick={e => e.stopPropagation()}
          onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoUpload?.(f); e.target.value = ''; }}
        />
      </div>
      {/* 하단: Lv + 이름 */}
      <div className="flex items-baseline gap-1 px-1 max-w-full mt-2">
        <span className="text-[8px] font-bold text-white/35 shrink-0">Lv{level}&nbsp;</span>
        <span className="text-[13px] font-bold text-white/85 leading-tight truncate">{displayName}</span>
      </div>


      {/* 사진 팝업 (클릭 토글) */}
      {showPreview && student.photoBase64 && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-white/25 shadow-2xl shadow-black/70">
            <img src={student.photoBase64} alt={displayName} draggable={false} className="w-full h-full object-cover" />
            <button
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white/70 hover:text-white text-[9px] font-bold flex items-center justify-center transition-all"
              onClick={() => setShowPreview(false)}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

const SORT_OPTIONS = [
  { value: 'type',  label: '유형순' },
  { value: 'name',  label: 'ㄱㄴㄷ순' },
  { value: 'level', label: '레벨순' },
];

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
  const [sortMode, setSortMode] = useState('type');
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

  // ── 이미지 압축 (Canvas 640px / JPEG 88%) ───────────────────
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

  // ── 정렬 ──────────────────────────────────────────────────────
  const sortStudents = (arr) => {
    if (sortMode === 'type') {
      const order = { major: 0, experienced: 1, beginner: 2 };
      return [...arr].sort((a, b) => {
        const ta = order[a.studentType || 'beginner'] ?? 2;
        const tb = order[b.studentType || 'beginner'] ?? 2;
        if (ta !== tb) return ta - tb;
        return (a.displayName || '').localeCompare(b.displayName || '', 'ko');
      });
    }
    if (sortMode === 'name') {
      return [...arr].sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || '', 'ko')
      );
    }
    if (sortMode === 'level') {
      return [...arr].sort((a, b) => (b.level ?? 1) - (a.level ?? 1));
    }
    return arr;
  };

  // 그룹별 학생
  const groupedStudents = groups
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(g => ({
      ...g,
      students: users.filter(u => u.groupIDs?.includes(g.id)),
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
    ? Math.round(users.reduce((s, u) => s + (u.dailyXPTotal ?? (typeof u.dailyXP === 'number' ? u.dailyXP : 0)), 0) / users.length)
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

        {/* 우측: 통계 카드 */}
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

      {/* 그룹 필터 드롭다운 + 정렬 + 버튼 */}
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

        {/* 우측 버튼 3개 */}
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


      {loading ? (
        <LucidLoader text="Loading Dashboard..." />
      ) : (
        <div className="flex flex-col gap-10">
          {displayGroups.map(g => {
            const sorted = sortStudents(g.students);
            const todayCount = g.students.filter(s => {
              if (!s.lastStudiedAt) return false;
              const ts = s.lastStudiedAt?.toDate ? s.lastStudiedAt.toDate() : new Date(s.lastStudiedAt);
              return (Date.now() - ts) / 86400000 < 1;
            }).length;
            const majorCount    = g.students.filter(s => s.studentType === 'major').length;
            const expCount      = g.students.filter(s => s.studentType === 'experienced').length;
            const beginnerCount = g.students.filter(s => !s.studentType || s.studentType === 'beginner').length;

            return (
              <div key={g.id}>
                {/* 그룹 헤더 위: 오늘 접속 + 범례 */}
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[13px] font-black" style={{ color: '#fbbf24' }}>오늘 {todayCount}명 접속</span>
                  <div className="flex items-center gap-2.5">
                    {[
                      { color: '#4ec9b0', label: '오늘' },
                      { color: '#569cd6', label: '3일 이내' },
                      { color: '#dcdcaa', label: '7일 이내' },
                      { color: '#ef4444', label: '이탈 위험' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[9px] text-white/60">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <h3 className="text-base font-black text-white">{g.name}</h3>
                  <span className="text-xs text-gray-500 font-semibold">{g.students.length}명</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  {/* 정렬 버튼 — 선 오른쪽 끝 */}
                  <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSortMode(opt.value)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md transition-all ${
                          sortMode === opt.value
                            ? 'bg-white/10 text-white'
                            : 'text-white/30 hover:text-white/60'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                {sorted.length === 0 ? (
                  <p className="text-gray-600 text-sm px-2">배정된 학생 없음</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {sorted.map(s => (
                      <StudentCard
                        key={s.id}
                        student={s}
                        onPhotoUpload={file => handlePhotoUpload(s.id, file)}
                        onPhotoDelete={() => handlePhotoDelete(s.id)}
                      />
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {sortStudents(ungrouped).map(s => (
                  <StudentCard key={s.id} student={s} />
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
