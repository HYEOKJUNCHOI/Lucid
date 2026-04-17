import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';
import CustomSelect from '../../components/common/CustomSelect';
import FifaCard, { getActivityTier } from '../../components/admin/FifaCard';
import Toast, { showToast } from '../../components/common/Toast';
import { MODELS, OPENAI_CHAT_URL } from '../../lib/aiConfig';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';

const ROWS = 5;
const TABLES_PER_ROW = 2;
const SEATS_PER_TABLE = 4;

const generateSeatIds = () => {
  const ids = [];
  for (let r = 1; r <= ROWS; r++)
    for (let t = 1; t <= TABLES_PER_ROW; t++)
      for (let s = 1; s <= SEATS_PER_TABLE; s++)
        ids.push(`R${r}T${t}S${s}`);
  return ids;
};
const ALL_SEAT_IDS = generateSeatIds();

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// OpenAI 기반 레벨 분산 재배치
const aiAssignSeats = async (students, tableCount, seatsPerTable) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_KEY_MISSING');

  const studentData = students.map(u => ({
    id: u.id,
    name: u.displayName || u.email,
    level: u.level || 1,
    type: u.studentType || 'beginner',
  }));

  const prompt = `
당신은 학원 좌석 배치 최적화 AI입니다.
학생 목록과 테이블 구성이 주어지면, 각 테이블에 레벨이 고르게 분산되도록 배치하세요.

규칙:
1. 각 테이블에 전공자(type: major)를 최소 1명 포함 (가능한 경우)
2. 레벨이 고르게 분산되도록 배치 (높은 레벨과 낮은 레벨이 같은 테이블에)
3. 총 테이블: ${tableCount}개, 테이블당 자리: ${seatsPerTable}개

학생 목록 (JSON):
${JSON.stringify(studentData, null, 2)}

응답 형식 (JSON만, 설명 없이):
{
  "assignments": [
    { "studentId": "...", "tableIndex": 0, "seatIndex": 0 },
    ...
  ]
}
tableIndex: 0 ~ ${tableCount - 1}, seatIndex: 0 ~ ${seatsPerTable - 1}
`;

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.VERIFY,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error('OPENAI_API_ERROR');
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
};

// ── 대기석 아이템 ──────────────────────────────────────────────
const PoolItem = ({ u, onDragStart, onDragEnd, large }) => {
  const tier = getActivityTier(u.lastStudiedAt);
  const badge =
    u.studentType === 'major'       ? { label: '전공', color: 'text-amber-400 bg-amber-400/15' } :
    u.studentType === 'experienced' ? { label: '경험', color: 'text-blue-400 bg-blue-400/15' } :
                                      { label: '일반', color: 'text-white/40 bg-white/10' };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center bg-white/[0.05] border border-white/[0.08] cursor-grab active:cursor-grabbing hover:bg-white/[0.1] hover:border-white/20 transition-all select-none ${large ? 'px-4 py-3 rounded-xl' : 'px-2 py-1.5 rounded-lg'}`}
    >
      {/* 좌: 활성 dot + 이름 */}
      <div className={`flex items-center flex-1 min-w-0 ${large ? 'gap-2.5' : 'gap-1.5'}`}>
        <div className={`rounded-full shrink-0 ${large ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} style={{ background: tier.color }} />
        <span className={`font-semibold text-white/80 ${large ? 'text-[20px] font-bold text-white/90' : 'text-[11px]'}`}>{u.displayName || u.email}</span>
      </div>
      {/* 우: 뱃지 */}
      <div className={`flex justify-end shrink-0 ${large ? 'ml-2' : ''}`}>
        <span className={`rounded font-bold ${badge.color} ${large ? 'px-2.5 py-1 text-[12px]' : 'px-1.5 py-0.5 text-[9px]'}`}>{badge.label}</span>
      </div>
    </div>
  );
};

const SeatChart = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [users, setUsers]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(
    () => searchParams.get('group') || ''
  );
  const [seatMap, setSeatMap]         = useState({});
  const [saving, setSaving]           = useState(false);
  const [draggingSeat, setDraggingSeat] = useState(null);
  const [draggingPool, setDraggingPool] = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [seatMode, setSeatMode]       = useState(false);
  const [seatScale, setSeatScale]     = useState(1);
  const isMobile                      = useIsMobile();
  const isTablet                      = useIsTablet();
  const frameRef                      = useRef();
  // 드래그 상태를 ref로도 동기 추적 (stale closure 방지)
  const draggingSeatRef  = useRef(null);
  const draggingPoolRef  = useRef(null);

  // ── 데이터 로드 ──────────────────────────────────────────────
  useEffect(() => {
    let ul = false, gl = false, tl = false;
    const check = () => { if (ul && gl && tl) setLoading(false); };
    const unU = onSnapshot(collection(db, 'users'), s => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(u =>
        u.role !== 'admin' || (u.groupIDs && u.groupIDs.length > 0)
      ));
      ul = true; check();
    }, () => { ul = true; check(); });
    const unG = onSnapshot(collection(db, 'groups'), s => {
      const gs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(gs);
      if (gs.length > 0 && !selectedGroup) setSelectedGroup(gs[0].id);
      gl = true; check();
    }, () => { gl = true; check(); });
    const unT = onSnapshot(collection(db, 'teachers'), s => {
      setTeachers(s.docs.map(d => ({ id: d.id, ...d.data() })));
      tl = true; check();
    }, () => { tl = true; check(); });
    return () => { unU(); unG(); unT(); };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSeatMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 프레임 전체(대기석+강의장+버튼) auto-scale
  useEffect(() => {
    if (!seatMode) { setSeatScale(1); return; }
    setSeatScale(1);
    const id = setTimeout(() => {
      if (!frameRef.current) return;
      const el = frameRef.current;
      const availH = window.innerHeight - 52 - 24;
      const availW = window.innerWidth - 32;
      const scale = Math.min(availH / el.offsetHeight, availW / el.offsetWidth, 1);
      setSeatScale(scale);
    }, 60);
    return () => clearTimeout(id);
  }, [seatMode, isMobile, isTablet]);

  // ── 그룹별 좌석 로드 ─────────────────────────────────────────
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


  // ── 저장 ────────────────────────────────────────────────────
  const saveSeatMap = async (newMap) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'seating', selectedGroup), { seats: newMap, groupId: selectedGroup });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const clearSeat = (seatId) => {
    const newMap = { ...seatMap };
    delete newMap[seatId];
    setSeatMap(newMap);
    saveSeatMap(newMap);
  };

  const getUserById = (uid) => users.find(u => u.id === uid);

  const groupStudents   = users.filter(u => u.groupIDs?.includes(selectedGroup));
  const majorCount      = groupStudents.filter(u => u.studentType === 'major').length;
  const expCount        = groupStudents.filter(u => u.studentType === 'experienced').length;
  const beginnerCount   = groupStudents.filter(u => !u.studentType || u.studentType === 'beginner').length;
  const assignedUserIds = new Set(Object.values(seatMap));
  const unassigned      = groupStudents.filter(u => !assignedUserIds.has(u.id));

  const currentGroup   = groups.find(g => g.id === selectedGroup);
  const currentTeacher = currentGroup?.teacherId
    ? teachers.find(t => t.id === currentGroup.teacherId)
    : null;

  // ── AI 재배치 ───────────────────────────────────────────────
  const handleAIAssign = async () => {
    if (groupStudents.length === 0) return;
    setAiLoading(true);
    try {
      const totalTables = ROWS * TABLES_PER_ROW;
      const result = await aiAssignSeats(groupStudents, totalTables, SEATS_PER_TABLE);
      const newMap = {};

      result.assignments?.forEach(({ studentId, tableIndex, seatIndex }) => {
        const row   = Math.floor(tableIndex / TABLES_PER_ROW) + 1;
        const table = (tableIndex % TABLES_PER_ROW) + 1;
        const seat  = seatIndex + 1;
        const seatId = `R${row}T${table}S${seat}`;
        if (row <= ROWS && table <= TABLES_PER_ROW && seat <= SEATS_PER_TABLE) {
          newMap[seatId] = studentId;
        }
      });

      setSeatMap(newMap);
      saveSeatMap(newMap);
    } catch (err) {
      if (err.message === 'OPENAI_KEY_MISSING') {
        showToast('.env에 VITE_OPENAI_API_KEY를 설정해주세요', 'warn');
      } else {
        showToast('AI 재배치 중 오류가 발생했습니다', 'error');
        console.error(err);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ── 랜덤 배치 ──────────────────────────────────────────────
  // 규칙:
  //  1. 전공(major)   → 테이블 중앙 좌석, 바로 옆에 경험자 1명 배치
  //  2. 남은 경험자   → 퐁당퐁당 (각자 새 테이블 중앙, 초보자 봐주기)
  //  3. 초보자        → 앞 줄부터 빈 자리 채우기 (전원 배치, 대기석 0)
  const handleRandomAssign = () => {
    const newMap = {};

    // 테이블별 좌석 목록 (좌석 번호 오름차순 정렬)
    const tableSeats = {};
    ALL_SEAT_IDS.forEach(id => {
      const m = id.match(/R(\d+)T(\d+)S(\d+)/);
      const key = `R${m[1]}T${m[2]}`;
      if (!tableSeats[key]) tableSeats[key] = [];
      tableSeats[key].push(id);
    });
    Object.values(tableSeats).forEach(seats =>
      seats.sort((a, b) => parseInt(a.match(/S(\d+)/)[1]) - parseInt(b.match(/S(\d+)/)[1]))
    );

    // 앞 줄(Row 오름차순) → 같은 줄 내 테이블 순 정렬
    const tableKeys = Object.keys(tableSeats).sort((a, b) => {
      const ra = parseInt(a.match(/R(\d+)/)[1]), rb = parseInt(b.match(/R(\d+)/)[1]);
      if (ra !== rb) return ra - rb;
      return parseInt(a.match(/T(\d+)/)[1]) - parseInt(b.match(/T(\d+)/)[1]);
    });

    // 중앙 인덱스: S2(index 1) / S3(index 2) 랜덤 선택
    const centerIdx = Math.random() < 0.5 ? 1 : 2;

    // 중앙 기준 인접 순 정렬 헬퍼
    const sortByProximity = (seats, ci) =>
      seats
        .map((s, i) => ({ s, i }))
        .filter(({ i }) => i !== ci)
        .sort((a, b) => Math.abs(a.i - ci) - Math.abs(b.i - ci))
        .map(({ s }) => s);

    // 퐁당퐁당 앵커 큐: 전공-경험자 번갈아 (M, E, M, E...)
    const mArr = shuffle(groupStudents.filter(u => u.studentType === 'major'));
    const eArr = shuffle(groupStudents.filter(u => u.studentType === 'experienced'));
    const anchorAll = [];
    for (let i = 0; i < Math.max(mArr.length, eArr.length); i++) {
      if (i < mArr.length) anchorAll.push(mArr[i]);
      if (i < eArr.length) anchorAll.push(eArr[i]);
    }
    const beginAll = shuffle(groupStudents.filter(u => !u.studentType || u.studentType === 'beginner'));

    // 필요 테이블 수 (올림, 최대 실제 테이블 수)
    const tablesNeeded = Math.min(
      Math.ceil(groupStudents.length / SEATS_PER_TABLE),
      tableKeys.length
    );

    // 테이블당 앵커 1명 배분 — 초과 앵커는 fillQueue 앞에 넣어 남은 자리 채움
    const primaryAnchors = anchorAll.splice(0, Math.min(anchorAll.length, tablesNeeded));
    const fillQueue = [...anchorAll, ...beginAll]; // 남은 앵커 + 일반

    for (let ti = 0; ti < tablesNeeded; ti++) {
      const seats  = tableSeats[tableKeys[ti]];
      const center = seats[centerIdx];
      const others = sortByProximity(seats, centerIdx);

      if (ti < primaryAnchors.length) {
        // 앵커 → 중앙, 나머지 → fillQueue (인접 순)
        newMap[center] = primaryAnchors[ti].id;
        others.forEach(s => { if (fillQueue.length > 0) newMap[s] = fillQueue.shift().id; });
      } else {
        // 앵커 부족 (앵커 < 테이블 수) — fillQueue로만 채우기
        seats.forEach(s => { if (fillQueue.length > 0) newMap[s] = fillQueue.shift().id; });
      }
    }

    setSeatMap(newMap);
    saveSeatMap(newMap);
  };

  // ── 이미지 압축 (Canvas 180px / JPEG 75%) ───────────────────
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

  // ── 사진 업로드 ─────────────────────────────────────────────
  const handlePhotoUpload = async (userId, file) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      await updateDoc(doc(db, 'users', userId), { photoBase64: compressed });
    } catch (err) {
      console.error('사진 저장 실패:', err);
      showToast('사진 저장에 실패했습니다', 'error');
    }
  };

  const handlePhotoDelete = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), { photoBase64: null });
    } catch (err) {
      console.error('사진 삭제 실패:', err);
      showToast('사진 삭제에 실패했습니다', 'error');
    }
  };

  // ── 드래그 시작 헬퍼 ────────────────────────────────────────
  const startDragSeat = (seatId) => {
    draggingSeatRef.current = seatId;
    setDraggingSeat(seatId);
  };
  const endDragSeat = () => {
    draggingSeatRef.current = null;
    setDraggingSeat(null);
  };
  const startDragPool = (uid) => {
    draggingPoolRef.current = uid;
    setDraggingPool(uid);
  };
  const endDragPool = () => {
    draggingPoolRef.current = null;
    setDraggingPool(null);
  };

  // ── 드롭 처리 ───────────────────────────────────────────────
  const handleDrop = (targetSeatId, e) => {
    e.preventDefault();
    const pool = draggingPoolRef.current;
    const seat = draggingSeatRef.current;
    const m = { ...seatMap };

    if (pool) {
      Object.keys(m).forEach(k => { if (m[k] === pool) delete m[k]; });
      m[targetSeatId] = pool;
    } else if (seat && seat !== targetSeatId) {
      const u1 = m[seat];
      const u2 = m[targetSeatId];
      if (u1) m[targetSeatId] = u1; else delete m[targetSeatId];
      if (u2) m[seat]  = u2; else delete m[seat];
    }

    setSeatMap(m);
    saveSeatMap(m);
    draggingSeatRef.current = null;
    draggingPoolRef.current = null;
    setDraggingSeat(null);
    setDraggingPool(null);
  };

  // ── 학생 카드 (단순 뱃지 디자인) ────────────────────────────
  const StudentCard = ({ student, faded }) => {
    const type = student.studentType || 'beginner';
    const badge =
      type === 'major'       ? { label: '전공자', cls: 'text-amber-300 bg-amber-400/[0.18] border-amber-400/40' } :
      type === 'experienced' ? { label: '경험자', cls: 'text-sky-300 bg-sky-400/[0.18] border-sky-400/40' } :
                               { label: '일반',   cls: 'text-white/70 bg-white/[0.08] border-white/20' };
    const borderCls =
      type === 'major'       ? 'border-amber-400/25 hover:border-amber-400/50' :
      type === 'experienced' ? 'border-sky-400/25 hover:border-sky-400/50' :
                               'border-white/[0.08] hover:border-white/20';
    const initBg =
      type === 'major'       ? 'bg-amber-400/[0.1] text-amber-300' :
      type === 'experienced' ? 'bg-sky-400/[0.1] text-sky-300' :
                               'bg-white/[0.06] text-white/50';
    const displayName = student.displayName || student.email || '?';
    const level = student.level ?? 1;
    const activity = getActivityTier(student.lastStudiedAt);

    return (
      <div
        className={`relative w-full h-full rounded-xl border bg-white/[0.03] flex flex-col items-center justify-center gap-1.5 py-2 select-none transition-all hover:bg-white/[0.06] ${borderCls} ${faded ? 'opacity-25' : ''}`}
      >
        {/* 오른쪽 위: 타입 뱃지 */}
        <span className={`absolute top-1.5 right-1.5 text-[7px] font-bold px-1 py-0.5 rounded border ${badge.cls}`}>
          {badge.label}
        </span>
        {/* 중앙: 사진 (읽기 전용) */}
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/[0.1] bg-white/[0.04] flex items-center justify-center">
          {student.photoBase64
            ? <img src={student.photoBase64} alt="" draggable={false} className="w-full h-full object-cover" />
            : null
          }
        </div>
        {/* 하단: Lv + 이름 */}
        <div className="flex items-baseline gap-1 px-1 max-w-full mt-1.5">
          <span className="text-[8px] font-bold text-sky-400 shrink-0">Lv{level}&nbsp;</span>
          <span className="text-[13px] font-bold text-white/85 leading-tight truncate">{displayName}</span>
        </div>
      </div>
    );
  };

  // ── 자리 렌더 ───────────────────────────────────────────────
  const renderSeat = (seatId) => {
    const uid      = seatMap[seatId];
    const student  = uid ? getUserById(uid) : null;
    const isDragging = (draggingSeat || draggingPool) && draggingSeat !== seatId;

    if (student) {
      return (
        <div
          key={seatId}
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); startDragSeat(seatId); }}
          onDragEnd={endDragSeat}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(seatId, e)}
          className="relative w-full h-full group cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={e => { e.stopPropagation(); clearSeat(seatId); }}
            className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-[#ef4444] text-white z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400 flex items-center justify-center font-bold ${seatMode ? '-top-5 w-9 h-9 text-[18px]' : '-top-3 w-6 h-6 text-[13px]'}`}
          >{seatMode ? '↵' : '↑'}</button>
          <StudentCard
            student={student}
            faded={draggingSeat === seatId}
            onPhotoUpload={file => handlePhotoUpload(student.id, file)}
            onPhotoDelete={() => handlePhotoDelete(student.id)}
          />
        </div>
      );
    }

    return (
      <button
        key={seatId}
        onDragOver={e => e.preventDefault()}
        onDrop={e => handleDrop(seatId, e)}
        className={`w-full h-full rounded-xl border border-dashed transition-all flex flex-col items-center justify-center ${
          isDragging
            ? 'border-[#4ec9b0]/60 bg-[#4ec9b0]/[0.07]'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }`}
      >
        <span className="text-[10px] text-gray-600">
          {isDragging ? '놓기' : '빈 자리'}
        </span>
      </button>
    );
  };

  // ── 강의장 레이아웃 ───────────────────────────────────────────
  // T 번호: 행 기준 — T1/T2, T3/T4, T5/T6, T7/T8, T9/T10
  const renderTableBox = (tNum) => {
    const row   = Math.ceil(tNum / 2);
    const table = tNum % 2 === 1 ? 1 : 2;
    return (
      <div key={tNum} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
        <div className="text-center text-[9px] text-gray-400 font-bold mb-1.5">T{tNum}</div>
        <div className="flex gap-1.5 items-stretch">
          {[1,2,3,4].map(seat => {
            const seatId    = `R${row}T${table}S${seat}`;
            const globalNum = table === 1 ? seat : seat + 4;
            return (
              <div key={seatId} className="flex flex-col items-center gap-0.5 w-[120px] shrink-0">
                <span className="text-[8px] text-gray-400 font-bold shrink-0">{globalNum}</span>
                <div className={`w-full flex-1 ${seatMode ? 'min-h-[88px]' : 'min-h-[96px]'}`}>
                  {renderSeat(seatId)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderClassroom = () => {
    if (seatMode) {
      // 자리배치 모드: 왼쪽 컬럼 / 중앙통로 하나 / 오른쪽 컬럼
      const aisleW = '60px';
      return (
        <div>
          <div className="flex items-stretch gap-5">
            <div className="flex flex-col gap-3">
              {[1,3,5,7,9].map(tNum => renderTableBox(tNum))}
            </div>
            <div className="flex items-center justify-center shrink-0 rounded-xl border border-white/[0.05] bg-white/[0.01]"
              style={{ width: aisleW }}>
              <span className="text-[12px] font-bold text-gray-600" style={{ writingMode: 'vertical-rl', letterSpacing: '0.15em' }}>중앙통로</span>
            </div>
            <div className="flex flex-col gap-3">
              {[2,4,6,8,10].map(tNum => renderTableBox(tNum))}
            </div>
          </div>
          <div className="mt-3 flex items-stretch gap-5">
            <div className="flex gap-1.5 items-stretch p-2">
              <div className="flex flex-col items-center justify-center py-3 rounded-lg border border-white/20 bg-white/[0.04]"
                style={{ width: '222px' }}>
                <span className="text-[10px]">🚪</span>
                <span className="text-[15px] font-bold text-gray-300">출입구</span>
              </div>
              <div style={{ width: '222px' }} />
            </div>
            <div className="shrink-0" style={{ width: aisleW }} />
            <div className="invisible bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
              <div className="flex gap-1.5">
                {[1,2,3,4].map(i => <div key={i} className="w-[120px] min-h-[1px]" />)}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 일반 뷰: 중앙통로 포함 3컬럼
    return (
      <div>
        <div className="flex items-stretch gap-5">
          <div className="flex flex-col gap-3">
            {[1,3,5,7,9].map(tNum => renderTableBox(tNum))}
          </div>
          <div className="flex items-center justify-center shrink-0 rounded-xl border border-white/[0.05] bg-white/[0.01]"
            style={{ width: '60px' }}>
            <span className="text-[12px] font-bold text-gray-600" style={{ writingMode: 'vertical-rl', letterSpacing: '0.15em' }}>중앙통로</span>
          </div>
          <div className="flex flex-col gap-3">
            {[2,4,6,8,10].map(tNum => renderTableBox(tNum))}
          </div>
        </div>
        <div className="mt-3 flex items-stretch gap-5">
          <div className="flex gap-1.5 items-stretch p-2">
            <div className="flex flex-col items-center justify-center py-3 rounded-lg border border-white/20 bg-white/[0.04]"
              style={{ width: '222px' }}>
              <span className="text-[10px]">🚪</span>
              <span className="text-[15px] font-bold text-gray-300">출입구</span>
            </div>
            <div style={{ width: '222px' }} />
          </div>
          <div className="shrink-0" style={{ width: '60px' }} />
          <div className="invisible bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
            <div className="flex gap-1.5">
              {[1,2,3,4].map(i => <div key={i} className="w-[120px] min-h-[1px]" />)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── 범례 ────────────────────────────────────────────────────
  const Legend = () => (
    <div className="flex items-center gap-4 text-[10px] text-gray-500">
      {[['#4ec9b0','오늘'],['#569cd6','3일내'],['#dcdcaa','7일내'],['#ef4444','이탈위험']].map(([c,l]) => (
        <div key={l} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: c }} />
          <span>{l}</span>
        </div>
      ))}
    </div>
  );

  if (loading) return <LucidLoader text="Loading Seats..." />;

  return (
    <>
      <Toast />

      {/* ── 자리배치 모드 ──────────────────────────────────────── */}
      {seatMode && (
        <div className="fixed inset-0 z-[500] bg-[#0e1512] flex flex-col overflow-hidden">

          {/* 상단 슬림 바 */}
          <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-4 text-[10px] text-gray-500">
              <span className="text-white font-bold text-sm mr-1">🪑 자리배치 모드</span>
              <Legend />
            </div>
            <div className="flex items-center gap-2">
              {saving && <span className="text-xs text-gray-500 animate-pulse">저장 중...</span>}
              {groupStudents.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  {majorCount > 0    && <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">🎓 {majorCount}</span>}
                  {expCount > 0      && <span className="px-1.5 py-0.5 rounded bg-[#569cd6]/10 text-[#569cd6] border border-[#569cd6]/20">⚡ {expCount}</span>}
                  {beginnerCount > 0 && <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.08]">일 {beginnerCount}</span>}
                </div>
              )}
              <CustomSelect value={selectedGroup} onChange={val => setSelectedGroup(val)}
                className="w-40" options={groups.map(g => ({ value: g.id, label: g.name }))} />
              <button onClick={() => setSeatMode(false)}
                className="ml-1 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-white text-xs font-bold transition-all">
                ↩ 나가기
              </button>
            </div>
          </div>

          {/* 본문: 프레임 전체 auto-scale, 오른쪽 정렬 */}
          <div className="flex-1 flex justify-center items-start pt-3 pr-4 pl-4 overflow-auto">
            <div ref={frameRef} style={{ zoom: seatScale, transformOrigin: 'top right' }}>
              {/* 전체: 대기석 고정 + 오른쪽 공간 중앙정렬 */}
              <div className="flex gap-3">

                {/* 대기석 */}
                <div
                  className={`w-[180px] shrink-0 flex flex-col gap-1 p-2.5 rounded-xl border transition-all ${
                    draggingSeat ? 'border-[#ef4444]/50 bg-[#ef4444]/[0.04]' : 'border-white/20 bg-white/[0.02]'
                  }`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (draggingSeatRef.current) { clearSeat(draggingSeatRef.current); endDragSeat(); }
                    endDragPool();
                  }}
                >
                  <p className="text-[15px] text-gray-400 font-bold text-center shrink-0 mb-2">
                    🪑 대기석{unassigned.length > 0 ? ` · ${unassigned.length}명` : ''}
                  </p>
                  {draggingSeat && <p className="text-[15px] text-[#ef4444] text-center shrink-0">여기에 놓기</p>}
                  <div className="flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {unassigned.map(u => <PoolItem key={u.id} u={u} onDragStart={() => startDragPool(u.id)} onDragEnd={endDragPool} large />)}
                    {unassigned.length === 0 && (
                      <span className="text-[9px] text-gray-600 text-center mt-2">전원 배정됨</span>
                    )}
                  </div>
                </div>

                {/* 큰 둥근 컨테이너: 칠판+강사+그리드 */}
                <div className="flex gap-3 items-start">
                <div className="border border-white/[0.08] rounded-2xl p-3 flex flex-col gap-3 bg-white/[0.01]">
                  <div className="flex items-stretch gap-3">
                    <div className="flex-[4] flex items-center justify-center py-[15px] rounded-xl border border-[#569cd6]/25 bg-[#569cd6]/[0.05]">
                      <span className="text-[15px] font-bold tracking-widest text-[#569cd6] uppercase">⬜ 칠판</span>
                    </div>
                    <div className="w-[248px] flex items-center justify-center py-[15px] rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] shrink-0">
                      <span className="text-[15px] font-bold text-[#f59e0b]">👨‍🏫 강사</span>
                    </div>
                  </div>
                  <div>{renderClassroom()}</div>
                </div>
                {/* 랜덤 배치 버튼 — 윗패딩으로 T2 시트 레벨에 맞춤 */}
                <div style={{ paddingTop: '123px' }}>
                  <button onClick={handleRandomAssign}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#4ec9b0]/10 hover:bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 text-[12px] text-[#4ec9b0] font-bold transition-all"
                    style={{ width: '108px', height: '110px' }}>
                    <span className="text-2xl">🎲</span>
                    <span>랜덤 배치</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── 일반 뷰 ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 animate-fade-in w-fit mx-auto">

        {/* ── 고정 헤더 블록 ───────────────────────────────────── */}
        <div className="sticky top-0 z-[200] flex flex-col gap-0 pt-0 pb-3" style={{ background: '#0e1512', boxShadow: '0 -200px 0 200px #0e1512' }}>

          {/* 헤더 + 범례 */}
          <div className="flex items-start justify-between gap-3">
            {/* 왼쪽: 제목 + 부제 */}
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-white">좌석 배치도</h2>
              <div className="flex items-center gap-2 text-[16px] text-gray-400 font-medium">
                <span>🏫 B강의장</span>
                {currentTeacher && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>👨‍🏫 {currentTeacher.name}</span>
                  </>
                )}
              </div>
            </div>
            {/* 오른쪽: 국비 + 나가기 */}
            <div className="flex items-center gap-2 shrink-0">
              {saving && <span className="text-xs text-gray-500 animate-pulse">저장 중...</span>}
              <CustomSelect value={selectedGroup} onChange={val => setSelectedGroup(val)}
                className="w-44" options={groups.map(g => ({ value: g.id, label: g.name }))} />
              <button onClick={() => navigate('/admin?tab=dashboard')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-sm text-white/70 font-bold transition-all h-full">
                ↩ 뒤로가기
              </button>
            </div>
          </div>

          {/* 칠판 / [대기석 + 강사] */}
          <div className="flex flex-col gap-2 w-full">
            {/* 범례 + 랜덤 + 자리배치 모드 */}
            <div className="flex items-center gap-2 justify-between">
              <Legend />
              <div className="flex items-center gap-2">
              {groupStudents.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  {majorCount > 0    && <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">🎓 전공 {majorCount}명</span>}
                  {expCount > 0      && <span className="px-1.5 py-0.5 rounded bg-[#569cd6]/10 text-[#569cd6] border border-[#569cd6]/20">⚡ 경험 {expCount}명</span>}
                  {beginnerCount > 0 && <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.08]">일반 {beginnerCount}명</span>}
                </div>
              )}
              <button onClick={handleRandomAssign}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4ec9b0]/10 hover:bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 text-sm text-[#4ec9b0] font-bold transition-all">
                🎲 랜덤 배치
              </button>
              <button onClick={() => setSeatMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-sm text-purple-400 font-bold transition-all">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                자리배치 모드
              </button>
              </div>
            </div>
            <div className="w-full flex items-center justify-center py-2.5 rounded-xl border border-[#569cd6]/25 bg-[#569cd6]/[0.05]">
              <span className="text-[10px] font-bold tracking-widest text-[#569cd6] uppercase">⬜ 칠판</span>
            </div>
            <div className="flex gap-3 items-stretch">
              <div
                className={`flex-1 py-2 px-3 rounded-xl border transition-all ${
                  draggingSeat ? 'border-[#ef4444]/60 bg-[#ef4444]/[0.04]' : 'border-white/[0.06] bg-white/[0.015]'
                }`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (draggingSeat) { clearSeat(draggingSeat); setDraggingSeat(null); }
                  setDraggingPool(null);
                }}
              >
                <p className="text-[10px] text-gray-500 font-semibold mb-1.5 text-center">
                  🪑 대기석{unassigned.length > 0 ? ` · ${unassigned.length}명` : ''}
                  {draggingSeat && <span className="ml-2 text-[#ef4444]">여기에 놓으면 대기석으로</span>}
                </p>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {unassigned.slice(0, 10).map(u => <PoolItem key={u.id} u={u} onDragStart={() => startDragPool(u.id)} onDragEnd={endDragPool} />)}
                  {unassigned.length > 10 && (
                    <div className="flex items-center px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-gray-500 font-bold select-none">
                      +{unassigned.length - 10}명
                    </div>
                  )}
                  {unassigned.length === 0 && <span className="text-[10px] text-gray-600">전원 배정됨</span>}
                </div>
              </div>
              <div className="w-[248px] flex items-center justify-center py-2.5 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] shrink-0">
                <span className="text-[10px] font-bold text-[#f59e0b]">👨‍🏫 강사</span>
              </div>
            </div>
          </div>

        </div>{/* ── /고정 헤더 블록 end ── */}

        {/* 강의장 */}
        <div>{renderClassroom()}</div>

      </div>
    </>
  );
};

export default SeatChart;
