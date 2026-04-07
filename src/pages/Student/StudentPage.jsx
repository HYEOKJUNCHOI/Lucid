import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ModeSelect from './ModeSelect';
import ConceptSelect from './ConceptSelect';
import ChatView from './ChatView';
import ResultView from './ResultView';

const StudentPage = ({ user, userData, onLogout }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const groupIDs = userData?.groupIDs || [];
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 사이드바 레포 데이터
  const [classData, setClassData] = useState([]);
  const [classLoading, setClassLoading] = useState(true);

  // 단계별 선택 데이터
  const [teacher, setTeacher] = useState(null);
  const [repo, setRepo]       = useState(null);
  const [mode, setMode]       = useState(null);
  const [concept, setConcept] = useState(null);
  const [result, setResult]   = useState(null);

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => setStep((s) => Math.max(2, s - 1));
  const reset = () => {
    setStep(1);
    setTeacher(null);
    setRepo(null);
    setMode(null);
    setConcept(null);
    setResult(null);
  };

  const selectRepo = (t, r) => {
    setTeacher(t);
    setRepo(r);
    setMode(null);
    setConcept(null);
    setResult(null);
    setStep(2);
  };

  // 그룹 → 강사 → 레포 데이터 조회 (사이드바용)
  useEffect(() => {
    if (!groupIDs || groupIDs.length === 0) {
      setClassLoading(false);
      return;
    }

    const fetchData = async () => {
      setClassLoading(true);
      try {
        const results = await Promise.all(
          groupIDs.map(async (gId) => {
            try {
              const gSnap = await getDoc(doc(db, 'groups', gId));
              if (!gSnap.exists()) return null;
              const group = gSnap.data();

              const tSnap = await getDoc(doc(db, 'teachers', group.teacherId));
              if (!tSnap.exists()) return null;
              const teacher = { id: tSnap.id, ...tSnap.data() };

              const genMatch = group.name.match(/(\d+)기/);
              const groupGeneration = genMatch ? genMatch[1] : null;

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
                    if (!groupGeneration || match[1] !== groupGeneration) return null;
                    const subject = match[2].replace(/_/g, ' ').toUpperCase();
                    return {
                      name: r.name,
                      label: `${match[1]}기 · ${subject}`,
                      description: r.description || '',
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
        console.error('데이터 로드 실패:', e);
      } finally {
        setClassLoading(false);
      }
    };

    fetchData();
  }, [groupIDs]);

  return (
    <div className="flex h-svh bg-theme-bg text-white overflow-hidden">

      {/* 좌측 사이드바 */}
      <aside className="w-64 shrink-0 bg-theme-sidebar border-r border-theme-border flex flex-col hidden md:flex">

        {/* 로고 */}
        <div className="p-4 pb-2">
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition"
            onClick={reset}
          >
            <div className="p-2 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-xl backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shadow-[0_0_15px_rgba(78,201,176,0.2)] shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#student-logo-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="student-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ec9b0" />
                    <stop offset="100%" stopColor="#569cd6" />
                  </linearGradient>
                </defs>
                <path d="m18 16 4-4-4-4"/>
                <path d="m6 8-4 4 4 4"/>
                <path d="m14.5 4-5 16"/>
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Lucid</h1>
          </div>
        </div>

        {/* 레포 목록 */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {groupIDs.length === 0 ? (
            <p className="text-gray-600 text-xs px-2 py-2">배정된 그룹 없음</p>
          ) : classLoading ? (
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="w-3.5 h-3.5 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-gray-500 text-xs">불러오는 중...</span>
            </div>
          ) : classData.length === 0 ? (
            <p className="text-gray-600 text-xs px-2 py-2">레포지토리 없음</p>
          ) : (
            classData.map(({ id, group, teacher: t, repos }) => (
              <div key={id} className="mb-4">
                {/* 그룹 헤더 */}
                <div className="px-2 mb-1.5">
                  <p className="text-[11px] font-bold text-gray-400 truncate">{group.name}</p>
                  <p className="text-[10px] text-gray-600 truncate">@{t.githubUsername}</p>
                </div>
                {/* 레포 버튼 목록 */}
                {repos.length === 0 ? (
                  <p className="text-gray-600 text-[10px] px-2 italic">레포 없음</p>
                ) : (
                  repos.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => selectRepo(t, r)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2.5 group mb-1.5 ${
                        repo?.name === r.name
                          ? 'bg-cyan-400/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(78,201,176,0.15)]'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-cyan-500/25 hover:text-white hover:shadow-[0_0_10px_rgba(78,201,176,0.1)]'
                      }`}
                    >
                      <div className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        repo?.name === r.name ? 'bg-cyan-400/15' : 'bg-white/5 group-hover:bg-cyan-400/10'
                      }`}>
                        <svg className={`w-3 h-3 ${repo?.name === r.name ? 'text-cyan-400' : 'text-gray-500 group-hover:text-cyan-400'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold leading-snug break-words min-w-0">{r.label}</span>
                    </button>
                  ))
                )}
              </div>
            ))
          )}
        </div>

        {/* 하단 프로필 메뉴 */}
        <div className="relative p-3 border-t border-theme-border">
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-theme-card border border-theme-border rounded-xl shadow-2xl overflow-hidden py-1 z-50 animate-fade-in-up px-1">
              <button
                onClick={() => { setIsMenuOpen(false); navigate('/admin'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-theme-primary hover:bg-white/5 transition rounded-lg"
              >
                <svg className="w-4 h-4 text-theme-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                관리자 페이지
              </button>
              <div className="h-px w-full bg-theme-border/50 my-0.5" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-white/5 transition rounded-lg"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </button>
            </div>
          )}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E5E5E5] flex items-center justify-center shrink-0 text-xs font-bold text-[#171717]">
                {user?.displayName ? user.displayName[0] : 'U'}
              </div>
              <span className="text-sm font-medium truncate max-w-[100px] text-theme-primary">{user?.displayName}</span>
            </div>
            <svg className={`w-4 h-4 text-theme-secondary transition-transform shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* 모바일 상단 바 */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-theme-sidebar border-b border-theme-border absolute top-0 w-full z-10">
        <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-lg backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#student-logo-gradient-mob)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="student-logo-gradient-mob" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ec9b0" />
                  <stop offset="100%" stopColor="#569cd6" />
                </linearGradient>
              </defs>
              <path d="m18 16 4-4-4-4"/>
              <path d="m6 8-4 4 4 4"/>
              <path d="m14.5 4-5 16"/>
            </svg>
          </div>
          Lucid
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="text-theme-secondary hover:text-white transition p-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={onLogout} className="text-theme-secondary text-sm">로그아웃</button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-4 pt-16 md:pt-4 md:p-8 flex justify-center bg-theme-bg">
        <div className="w-full max-w-4xl h-full flex flex-col justify-center pb-12">

          {groupIDs.length === 0 ? (
            /* 그룹 미배정 */
            <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in-up mt-20 md:mt-0">
              <div className="bg-theme-card/90 border border-theme-border rounded-[2rem] p-10 max-w-md w-full shadow-2xl backdrop-blur-xl">
                <div className="w-16 h-16 mx-auto mb-6 bg-theme-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-theme-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">소속된 클래스가 없습니다.</h2>
                <p className="text-gray-400 text-sm leading-relaxed">관리자에게 문의해주세요.</p>
              </div>
            </div>

          ) : step === 1 ? (
            /* 레포 미선택 — 안내 메시지 */
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <div className="mb-6 p-4 bg-gradient-to-br from-theme-primary/10 to-theme-icon/10 rounded-2xl border border-white/5">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#welcome-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="welcome-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ec9b0" />
                      <stop offset="100%" stopColor="#569cd6" />
                    </linearGradient>
                  </defs>
                  <path d="m18 16 4-4-4-4"/>
                  <path d="m6 8-4 4 4 4"/>
                  <path d="m14.5 4-5 16"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">오늘 배운 과목을 선택해주세요</h2>
              <p className="text-gray-500 text-sm">왼쪽 사이드바에서 과목을 선택하면 학습이 시작됩니다.</p>
            </div>

          ) : (
            <>
              {step === 2 && (
                <ModeSelect
                  teacher={teacher}
                  repo={repo}
                  onSelect={(m) => { setMode(m); goNext(); }}
                  onBack={reset}
                />
              )}
              {step === 3 && (
                <ConceptSelect
                  teacher={teacher}
                  repo={repo}
                  mode={mode}
                  onSelect={(c) => { setConcept(c); goNext(); }}
                  onBack={goBack}
                />
              )}
              {step === 4 && (
                <ChatView
                  teacher={teacher}
                  repo={repo}
                  concept={concept}
                  onComplete={(r) => { setResult(r); goNext(); }}
                  onBack={goBack}
                />
              )}
              {step === 5 && (
                <ResultView
                  result={result}
                  onReset={reset}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentPage;
