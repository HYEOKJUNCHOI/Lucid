import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const RepoSelect = ({ groupIDs, onSelect }) => {
  const [classData, setClassData] = useState([]); // [{ group, teacher, repos, error }]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupIDs || groupIDs.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          groupIDs.map(async (gId) => {
            try {
              // 1. 그룹 정보 조회
              const gSnap = await getDoc(doc(db, 'groups', gId));
              if (!gSnap.exists()) return null;
              const group = gSnap.data();

              // 2. 강사 정보 조회
              const tSnap = await getDoc(doc(db, 'teachers', group.teacherId));
              if (!tSnap.exists()) return null;
              const teacher = tSnap.data();

              // 3. 그룹명에서 기수 추출 (예: "국비_KORIT_9기" → "9")
              const genMatch = group.name.match(/(\d+)기/);
              const groupGeneration = genMatch ? genMatch[1] : null;

              // 4. GitHub 레포지토리 조회
              const res = await fetch(
                `https://api.github.com/users/${teacher.githubUsername}/repos?per_page=100&sort=updated`
              );
              let repos = [];
              if (res.ok) {
                const data = await res.json();
                repos = data
                  .filter((r) => !r.fork)
                  .map((r) => {
                    const match = r.name.match(/^korit_(\d+)_gov_(.+)$/);
                    if (!match) return null;
                    if (!groupGeneration || match[1] !== groupGeneration) return null; // 기수 불일치 또는 미확인 제외
                    const subject = match[2].replace(/_/g, ' ').toUpperCase();
                    return {
                      name: r.name,
                      label: `${match[1]}기 · ${subject}`,
                      description: r.description || '레포지토리 설명이 없습니다.',
                    };
                  })
                  .filter(Boolean);
              }

              return { id: gId, group, teacher, repos };
            } catch (err) {
              console.error(`그룹 ${gId} 로드 실패:`, err);
              return null;
            }
          })
        );

        setClassData(results.filter(Boolean));
      } catch (e) {
        console.error('전체 데이터 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupIDs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-cyan-400 font-medium">강의 정보 및 레포지토리를 불러오는 중...</p>
      </div>
    );
  }

  if (classData.length === 0) {
    return (
      <div className="text-center p-10 text-gray-400">
        배정된 강사나 그룹 정보를 찾을 수 없습니다. (관리자 문의 요망)
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 animate-fade-in-up">
      <div className="flex flex-col gap-8">
        
        <div className="flex flex-col gap-2 mb-4">
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            학습 과목 선택
          </h2>
          <p className="text-gray-400">
            소속된 그룹의 강사님과 연결된 레포지토리를 선택해 주세요.
          </p>
        </div>

        <div className={`grid grid-cols-1 ${classData.length > 1 ? 'lg:grid-cols-2' : ''} gap-6 items-start`}>
          {classData.map(({ id, group, teacher, repos }) => (
            <div key={id} className="relative p-5 md:p-6 rounded-[1.5rem] bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_0_rgba(0,0,0,0.3)] hover:bg-white/[0.04] transition-all">
              {/* 그룹별 헤더 (강사 이름 + 반 이름) 슬림화 */}
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-cyan-400 truncate">{group.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-300 font-medium">{teacher.name} 강사님</span>
                    <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded border border-white/5 text-gray-500 truncate">@{teacher.githubUsername}</span>
                  </div>
                </div>
              </div>

              {/* 레포 목록 - 텍스트 기반 슬림 리스트 */}
              {repos.length === 0 ? (
                <p className="text-gray-500 text-xs italic py-2">등록된 레포지토리가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-1">
                  {repos.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => onSelect(teacher, r)}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left"
                    >
                      <div className="shrink-0 p-2 rounded-lg bg-white/5 group-hover:bg-cyan-400/10">
                        <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576.474.017.931-.194 1.258-.556A11.966 11.966 0 0 0 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-cyan-400 text-sm font-bold truncate block group-hover:text-cyan-300 transition-colors">
                          {r.label}
                        </span>
                        <p className="text-gray-500 text-[10px] truncate">
                          {r.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default RepoSelect;
