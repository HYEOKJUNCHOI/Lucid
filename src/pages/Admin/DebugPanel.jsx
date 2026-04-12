/**
 * DebugPanel.jsx ⚠️ Dev Only
 * 관리자 전용 — 학생 Firestore 상태를 직접 편집하는 디버그 패널
 * MySQL phpMyAdmin 처럼 필드를 직접 수정하면 → Firestore 즉시 반영
 * 학생 화면은 onSnapshot으로 새로고침 없이 자동 갱신됨
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { debugSetUserFields, debugResetUser, getUserState } from '../../services/userStateService';
import LucidSelect from '../../components/common/LucidSelect';

// 편집 가능한 숫자 필드 목록
const NUMBER_FIELDS = [
  { key: 'streak',            label: '연속일 (streak)' },
  { key: 'streakFreezes',     label: '얼리기 개수 (streakFreezes)' },
  { key: 'repairCount',       label: '복구 퀘스트 (-1=비활성)' },
  { key: 'streakBeforeBreak', label: '끊기 전 streak 백업' },
  { key: 'beanCount',         label: '원두 개수 (beanCount)' },
  { key: 'difficultyLevel',   label: '퀘스트 난이도 (0~4)' },
  { key: 'totalXP',           label: '누적 XP (totalXP)' },
  { key: 'level',             label: '레벨 (level)' },
];

// 편집 가능한 문자열 필드
const STRING_FIELDS = [
  { key: 'lastRoutineDate', label: '마지막 퀘스트 날짜 (YYYY-MM-DD)' },
];

export default function DebugPanel() {
  const [users, setUsers] = useState([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [userState, setUserState] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // 전체 학생 목록
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.role !== 'admin' || (u.groupIDs?.length > 0))
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
      );
    });
    return () => unsub();
  }, []);

  // 선택된 학생 상태 로드
  useEffect(() => {
    if (!selectedUid) { setUserState(null); setFieldValues({}); return; }
    setLoading(true);
    getUserState(selectedUid).then(data => {
      setUserState(data);
      const vals = {};
      [...NUMBER_FIELDS, ...STRING_FIELDS].forEach(({ key }) => {
        vals[key] = data?.[key] ?? '';
      });
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
      // 재로드
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
    [...NUMBER_FIELDS, ...STRING_FIELDS].forEach(({ key }) => {
      vals[key] = fresh?.[key] ?? '';
    });
    setFieldValues(vals);
    setResetConfirm(false);
  };

  const selected = users.find(u => u.uid === selectedUid);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30">
          ⚠️ DEV ONLY
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">디버그 패널</h2>
          <p className="text-gray-400 text-sm mt-0.5">학생 Firestore 상태 직접 편집 — 적용 즉시 학생 화면에 반영됨</p>
        </div>
      </div>

      {/* 학생 선택 */}
      <div className="flex items-center gap-3">
        <label className="text-[12px] font-bold text-gray-400 shrink-0">학생 선택</label>
        <LucidSelect
          value={selectedUid}
          onChange={val => setSelectedUid(val)}
          placeholder="-- 학생을 선택하세요 --"
          options={users.map(u => ({
            value: u.uid,
            label: u.displayName || u.name || '이름없음',
            sublabel: u.email || '',
          }))}
        />
        {selected && (
          <span className="text-[11px] text-gray-500 font-mono">{selectedUid}</span>
        )}
      </div>

      {loading && (
        <div className="text-[13px] text-gray-400">불러오는 중...</div>
      )}

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
                  >
                    {saving[key] ? '...' : '적용'}
                  </button>
                  <span className="text-[11px] text-gray-600 ml-1">
                    현재: <span className="text-gray-400 font-mono">{String(userState?.[key] ?? '—')}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 문자열 필드 */}
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
                  >
                    {saving[key] ? '...' : '적용'}
                  </button>
                  <span className="text-[11px] text-gray-600 ml-1">
                    현재: <span className="text-gray-400 font-mono">{userState?.[key] || '—'}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 배열 필드 (읽기 전용 미리보기) */}
          <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">배열 필드 (미리보기)</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[
                { key: 'attendedDates', label: '출석 날짜' },
                { key: 'frozenDates', label: '얼린 날짜' },
                { key: 'weakFiles', label: '취약 파일' },
              ].map(({ key, label }) => (
                <div key={key} className="px-4 py-2.5">
                  <div className="text-[12px] text-gray-400 mb-1">{label}</div>
                  <div className="text-[11px] font-mono text-gray-500 bg-white/[0.02] rounded px-2 py-1 max-h-16 overflow-y-auto">
                    {(userState?.[key] || []).length === 0
                      ? '(비어있음)'
                      : (userState?.[key] || []).join(', ')}
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
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-black text-white bg-[#ef4444]/80 hover:bg-[#ef4444] transition-colors"
                  >
                    확인, 초기화
                  </button>
                  <button
                    onClick={() => setResetConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10 transition-colors"
                >
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
