import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import CustomSelect from '../../components/common/CustomSelect';
import Toast, { showToast } from '../../components/common/Toast';

// Wilson Score 하한 (95% 신뢰구간) — 좋아요 정렬에 사용
const wilsonScore = (likes, dislikes) => {
  const n = likes + dislikes;
  if (n === 0) return 0;
  const p = likes / n;
  const z = 1.96; // 95% 신뢰구간
  return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n);
};

const MetaphorLibrary = () => {
  const [metaphors, setMetaphors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [sortBy, setSortBy] = useState('wilson'); // 'wilson' | 'likes' | 'recent'
  const [filterConcept, setFilterConcept] = useState('all');

  const handleClearAll = async () => {
    if (!window.confirm(`메타포 라이브러리의 모든 항목(${metaphors.length}개)을 삭제합니다. 복구 불가능합니다. 계속할까요?`)) return;
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, 'metaphors'));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'metaphors', d.id))));
      setMetaphors([]);
    } catch (e) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'metaphors'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => {
          const raw = d.data();
          const funcLikes = raw.functional?.likes || 0;
          const funcDislikes = raw.functional?.dislikes || 0;
          const metaLikes = raw.metaphor?.likes || 0;
          const metaDislikes = raw.metaphor?.dislikes || 0;
          return {
            id: d.id,
            ...raw,
            totalLikes: funcLikes + metaLikes,
            totalDislikes: funcDislikes + metaDislikes,
            wilson: wilsonScore(funcLikes + metaLikes, funcDislikes + metaDislikes),
          };
        });
        setMetaphors(data);
      } catch (e) {
        console.warn('메타포 라이브러리 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 파일 경로에서 개념 추출 (폴더명)
  const getConcept = (filePath) => {
    if (!filePath) return '기타';
    const parts = filePath.split('/');
    return parts.length >= 2 ? parts[parts.length - 2] : '기타';
  };

  // 고유 개념 목록
  const concepts = ['all', ...new Set(metaphors.map(m => getConcept(m.filePath)))];

  // 필터 + 정렬
  const filtered = metaphors
    .filter(m => filterConcept === 'all' || getConcept(m.filePath) === filterConcept)
    .sort((a, b) => {
      if (sortBy === 'wilson') return b.wilson - a.wilson;
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes;
      return 0; // recent는 Firestore 순서 유지
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4ec9b0]/30 border-t-[#4ec9b0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <Toast />
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-purple-400">📚</span> 메타포 라이브러리
          <span className="text-xs font-normal text-gray-500">총 {metaphors.length}개</span>
        </h2>

        <div className="flex items-center gap-2">
          {/* 비우기 버튼 */}
          <button
            onClick={handleClearAll}
            disabled={clearing || metaphors.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {clearing ? '삭제 중...' : '전체 비우기'}
          </button>
          {/* 정렬 */}
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            className="w-36"
            options={[
              { value: 'wilson', label: 'Wilson Score 순' },
              { value: 'likes',  label: '좋아요 순' },
              { value: 'recent', label: '최신 순' },
            ]}
          />

          {/* 개념 필터 */}
          <CustomSelect
            value={filterConcept}
            onChange={setFilterConcept}
            className="w-44"
            options={concepts.map(c => ({ value: c, label: c === 'all' ? '전체 개념' : c }))}
          />
        </div>
      </div>

      {/* 통계 요약 */}
      {metaphors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '총 비유', value: metaphors.length, color: '#4ec9b0' },
            { label: '평균 Wilson', value: (metaphors.reduce((s, m) => s + m.wilson, 0) / metaphors.length).toFixed(2), color: '#569cd6' },
            { label: '총 좋아요', value: metaphors.reduce((s, m) => s + m.totalLikes, 0), color: '#dcdcaa' },
            { label: '고품질 (W≥0.3)', value: metaphors.filter(m => m.wilson >= 0.3).length, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
              <div className="text-lg font-black" style={{ color }}>{value}</div>
              <div className="text-[9px] text-gray-500 font-bold mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">저장된 메타포가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(m => (
            <div
              key={m.id}
              className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden hover:border-[#4ec9b0]/30 transition-colors"
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#222] bg-[#0a0a0a]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold shrink-0">
                    {getConcept(m.filePath)}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">{m.filePath?.split('/').pop()}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[11px]">
                  <span className="text-green-400">👍 {m.totalLikes}</span>
                  <span className="text-red-400">👎 {m.totalDislikes}</span>
                  <span className="text-gray-500" title="Wilson Score">
                    W: {m.wilson.toFixed(2)}
                  </span>
                </div>
              </div>
              {/* 본문 미리보기 */}
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                  {m.content?.substring(0, 300) || m.functionalAnalysis?.substring(0, 300) || '내용 없음'}
                </p>
              </div>
              {/* 투표 상세 */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-[#1a1a1a] text-[10px] text-gray-600">
                <span>기능해석 👍{m.functional?.likes || 0} 👎{m.functional?.dislikes || 0}</span>
                <span>메타포 👍{m.metaphor?.likes || 0} 👎{m.metaphor?.dislikes || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
};

export default MetaphorLibrary;
