import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const TeacherSelect = ({ onSelect }) => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const snap = await getDocs(collection(db, 'teachers'));
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTeachers(list);
    } catch (e) {
      console.error('강사 목록 로드 실패:', e);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // 강사 선택 시 GitHub API로 레포 목록 조회
  useEffect(() => {
    if (!selectedTeacher) return;
    const fetchRepos = async () => {
      setLoadingRepos(true);
      setRepos([]);
      try {
        const res = await fetch(
          `https://api.github.com/users/${selectedTeacher.githubUsername}/repos?per_page=100&sort=updated`
        );
        if (!res.ok) throw new Error('GitHub API Error');
        const data = await res.json();
        
        // 레포명에서 과목 라벨 파싱: "korit_9_gov_java" → "java"
        const parsed = data
          .filter((r) => !r.fork)
          .map((r) => {
            const match = r.name.match(/_gov_(.+)$/);
            const label = match ? match[1].toUpperCase() : r.name;
            return {
              name: r.name,
              label: label,
              description: r.description || '레포지토리 설명이 없습니다.',
            };
          });
        setRepos(parsed);
      } catch (e) {
        console.error('레포 목록 로드 실패:', e);
      } finally {
        setLoadingRepos(false);
      }
    };
    fetchRepos();
  }, [selectedTeacher]);

  return (
    <div className="max-w-4xl mx-auto mt-10 animate-fade-in-up">
      <div className="relative p-8 md:p-12 rounded-[2rem] bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* 장식용 빛번짐 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ec9b0]/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#569cd6]/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />

        <div className="relative z-10 flex flex-col gap-8">
          {/* 헤더 섹션 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              강사 및 과목 선택
            </h2>
            <p className="text-gray-400 text-sm">
              학습할 강사님과 GitHub 리포지토리를 선택해 주세요.
            </p>
          </div>

          {/* 1. 강사 목록 */}
          <div>
            {loadingTeachers ? (
              <div className="flex items-center gap-3 text-cyan-400 text-sm animate-pulse">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                강사 목록을 불러오는 중...
              </div>
            ) : teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-theme-border rounded-2xl bg-black/50">
                <p className="text-theme-secondary mb-2 text-sm">등록된 강사 정보가 없습니다.</p>
                <p className="text-theme-secondary text-xs">관리자에게 문의하여 강사를 등록하세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {teachers.map((t) => {
                  const isSelected = selectedTeacher?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacher(t)}
                      className={`relative overflow-hidden flex flex-col items-start gap-2 p-5 rounded-2xl border transition-all duration-300 text-left ${
                        isSelected
                          ? 'bg-white/[0.05] border-cyan-400 shadow-[0_0_20px_rgba(78,201,176,0.15)] ring-1 ring-cyan-400/50 -translate-y-1'
                          : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/20'
                      }`}
                    >
                      {/* 카드 내 장식 그라데이션 */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent pointer-events-none" />
                      )}
                      <span className={`text-lg font-bold ${isSelected ? 'text-cyan-400' : 'text-gray-200'}`}>
                        {t.name}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        @{t.githubUsername}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. 레포지토리 목록 (강사 선택 시 표시) */}
          {selectedTeacher && (
            <div className="flex flex-col gap-4 pt-6 border-t border-white/10 mt-2 animate-fade-in">
              <h3 className="text-lg font-semibold text-gray-200">
                과목 레포지토리 <span className="text-sm text-gray-500 font-normal ml-2">GitHub 연동</span>
              </h3>

              {loadingRepos ? (
                <div className="flex items-center gap-3 text-cyan-400 text-sm animate-pulse py-4">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  GitHub에서 목록을 불러오는 중...
                </div>
              ) : repos.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">선택할 수 있는 레포지토리가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {repos.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => onSelect(selectedTeacher, r)}
                      className="group flex flex-col items-start p-5 rounded-2xl bg-black/40 border border-gray-800 hover:border-cyan-500/50 hover:bg-black/60 transition-all duration-300 text-left hover:-translate-y-1 shadow-lg"
                    >
                      <div className="flex items-center gap-3 mb-2 w-full">
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576.474.017.931-.194 1.258-.556A11.966 11.966 0 0 0 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span className="text-cyan-400 font-bold tracking-wide truncate flex-1">
                          {r.label}
                        </span>
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 w-full">
                        {r.description}
                      </p>
                      <span className="text-[10px] text-gray-600 font-mono mt-3">
                        {r.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default TeacherSelect;
