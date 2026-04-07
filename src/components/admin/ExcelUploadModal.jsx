import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ExcelUploadModal = ({ onClose, onComplete }) => {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]); // 매칭 안 된 기수 경고
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [groups, setGroups] = useState([]); // Firestore groups 목록
  const fileRef = useRef();

  // 그룹 목록 로드
  useEffect(() => {
    getDocs(collection(db, 'groups')).then(snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, []);

  // 기수명 → groupID 매칭 (부분 일치 허용)
  const resolveGroupId = (groupName) => {
    if (!groupName) return null;
    const name = groupName.toString().trim();
    // 완전 일치 우선
    const exact = groups.find(g => g.name === name);
    if (exact) return exact.id;
    // 부분 일치
    const partial = groups.find(g =>
      g.name.includes(name) || name.includes(g.name)
    );
    return partial?.id || null;
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const normalized = raw.map((r, i) => {
          const name      = (r['이름'] || r['name'] || r['Name'] || '').toString().trim();
          const email     = (r['이메일'] || r['email'] || r['Email'] || '').toString().trim().toLowerCase();
          const phone     = (r['전화번호'] || r['phone'] || r['Phone'] || r['연락처'] || '').toString().trim();
          const groupName = (r['기수'] || r['그룹'] || r['반'] || r['group'] || '').toString().trim();
          const groupId   = resolveGroupId(groupName);
          return { _row: i + 2, name, email, phone, groupName, groupId };
        }).filter(r => r.name || r.email);

        // 유효성 오류
        const errs = [];
        const emailSet = new Set();
        normalized.forEach(r => {
          if (!r.name)  errs.push(`${r._row}행: 이름 없음`);
          if (!r.email) errs.push(`${r._row}행: 이메일 없음`);
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) errs.push(`${r._row}행: 이메일 형식 오류 (${r.email})`);
          if (emailSet.has(r.email)) errs.push(`${r._row}행: 중복 이메일 (${r.email})`);
          emailSet.add(r.email);
        });

        // 기수 매칭 경고 (오류는 아님)
        const warns = [];
        const unmatchedGroups = [...new Set(
          normalized.filter(r => r.groupName && !r.groupId).map(r => r.groupName)
        )];
        unmatchedGroups.forEach(g => warns.push(`기수 "${g}" — 시스템에 없는 그룹, 빈 배정으로 등록됩니다`));

        setErrors(errs);
        setWarnings(warns);
        setRows(normalized);
      } catch {
        setErrors(['파일을 읽는 중 오류가 발생했습니다. xlsx/xls/csv 파일인지 확인해주세요.']);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    parseFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) { setResult(null); parseFile(file); }
  };

  const handleSave = async () => {
    if (errors.length > 0 || rows.length === 0) return;
    setSaving(true);
    let saved = 0, updated = 0;
    try {
      for (const r of rows) {
        const ref = doc(db, 'invited_students', r.email);
        const snap = await getDoc(ref);
        const newGroupIDs = r.groupId ? [r.groupId] : [];

        if (snap.exists()) {
          const existing = snap.data();
          // 기존 그룹 유지 + 새 그룹 병합
          const mergedGroups = [...new Set([...(existing.groupIDs || []), ...newGroupIDs])];
          await setDoc(ref, { name: r.name, phone: r.phone, groupIDs: mergedGroups }, { merge: true });
          updated++;
        } else {
          await setDoc(ref, { email: r.email, name: r.name, phone: r.phone, groupIDs: newGroupIDs });
          saved++;
        }
      }
      setResult({ saved, updated });
      onComplete?.();
    } catch (err) {
      setErrors([`저장 중 오류: ${err.message}`]);
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = errors.length > 0;
  const canSave = rows.length > 0 && !hasErrors && !result;
  const hasGroup = rows.some(r => r.groupName);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-bold text-base">엑셀 일괄 등록</h2>
            <p className="text-gray-500 text-xs mt-0.5">xlsx · xls · csv 파일 지원</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* 양식 안내 */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium mb-2">엑셀 열 이름 (첫 번째 행)</p>
            <div className="flex gap-2 flex-wrap">
              {['이름 *', '이메일 *', '전화번호', '기수'].map(col => (
                <span key={col} className="text-[11px] font-mono bg-black/40 border border-white/10 rounded px-2 py-0.5 text-gray-300">{col}</span>
              ))}
            </div>
            <p className="text-gray-600 text-[11px] mt-2">* 필수 항목 · 열 순서 무관 · 기수는 시스템에 등록된 그룹명과 일치해야 자동 배정됩니다</p>
          </div>

          {/* 드래그 업로드 */}
          {rows.length === 0 && (
            <div
              className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="text-3xl mb-2">📂</div>
              <p className="text-gray-400 text-sm">파일을 여기에 끌어다 놓거나 클릭해서 선택</p>
              <p className="text-gray-600 text-xs mt-1">xlsx / xls / csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>
          )}

          {rows.length > 0 && (
            <button
              onClick={() => { setRows([]); setErrors([]); setWarnings([]); setResult(null); fileRef.current.value = ''; fileRef.current?.click(); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
            >
              ↩ 다른 파일 선택
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </button>
          )}

          {/* 오류 */}
          {hasErrors && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-red-400 text-xs font-bold mb-1">⚠️ {errors.length}개 오류 — 수정 후 다시 업로드해주세요</p>
              {errors.map((e, i) => <p key={i} className="text-red-400/80 text-xs">{e}</p>)}
            </div>
          )}

          {/* 기수 경고 */}
          {warnings.length > 0 && !hasErrors && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-yellow-400 text-xs font-bold mb-1">⚠️ 기수 매칭 주의</p>
              {warnings.map((w, i) => <p key={i} className="text-yellow-400/80 text-xs">{w}</p>)}
            </div>
          )}

          {/* 미리보기 */}
          {rows.length > 0 && !hasErrors && (
            <div className="flex flex-col gap-2">
              <p className="text-gray-400 text-xs font-medium">
                미리보기 — 총 <span className="text-white font-bold">{rows.length}명</span>
                {hasGroup && <span className="ml-2 text-emerald-400">· 기수 자동 배정 포함</span>}
              </p>
              <div className="border border-white/[0.06] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/[0.06] sticky top-0">
                    <tr>
                      {['#', '이름', '이메일', '전화번호', '기수'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                        <td className="px-3 py-2 text-white font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-gray-400 font-mono text-[11px]">{r.email}</td>
                        <td className="px-3 py-2 text-gray-500">{r.phone || '—'}</td>
                        <td className="px-3 py-2">
                          {r.groupName ? (
                            r.groupId
                              ? <span className="text-emerald-400 text-[11px]">✓ {r.groupName}</span>
                              : <span className="text-yellow-500 text-[11px]">✗ {r.groupName}</span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 완료 */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-emerald-400 font-bold text-sm">✅ 등록 완료</p>
              <p className="text-gray-400 text-xs mt-1">신규 {result.saved}명 · 업데이트 {result.updated}명</p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-6 py-4 border-t border-white/[0.06]">
          {canSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#4ec9b0] hover:bg-[#3db79e] text-black font-bold text-sm transition-colors disabled:opacity-50"
            >
              {saving ? '등록 중...' : `${rows.length}명 일괄 등록`}
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 text-sm transition-colors"
          >
            {result ? '닫기' : '취소'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadModal;
