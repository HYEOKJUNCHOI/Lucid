import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ChatView from './ChatView';
import ResultView from './ResultView';
import useLearningStore from '../../store/useLearningStore';

// GPT로 코드 분석 → 주제 라벨 반환
const analyzeChapterLabel = async (code) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '너는 개발자들의 코드를 분석하여 핵심 학습 주제를 파악하는 AI야. 제공되는 소스 코드를 읽고, 해당 코드에서 배우는 중심 기술 개념(예: 클래스 기초, 인스턴스 변수, 생성자, 메서드 오버라이딩 등)을 한국어 1~3단어 명사형으로만 답해. 만약 핵심 개념을 파악하기 어렵거나 폴더명과 차이가 없다면 빈 문자열("")을 반환해. 절대로 부연 설명이나 마침표를 넣지 마.',
        },
        { role: 'user', content: code.slice(0, 3000) }, // 코드 분석 범위를 3000자로 확대
      ],
      max_tokens: 30,
      temperature: 0,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '?';
};

const StudentPage = ({ user, userData, onLogout }) => {
  const navigate = useNavigate();
  const groupIDs = userData?.groupIDs || [];
  const {
    teacher, setTeacher,
    repo, setRepo,
    chapters, setChapters,
    chaptersLoading, setChaptersLoading,
    expandedChapters, setExpandedChapters,
    chapterFilesMap, setChapterFilesMap,
    chapterFilesLoadingMap, setChapterFilesLoadingMap,
    step, setStep,
    concept, setConcept,
    result, setResult,
    reset: storeReset
  } = useLearningStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 레포 목록
  const [classData, setClassData] = useState([]);
  const [classLoading, setClassLoading] = useState(true);

  // 레포 목록 로드
  useEffect(() => {
    if (!groupIDs || groupIDs.length === 0) { setClassLoading(false); return; }
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
              const t = { id: tSnap.id, ...tSnap.data() };
              const genMatch = group.name.match(/(\d+)기/);
              const gen = genMatch ? genMatch[1] : null;
              const res = await fetch(`https://api.github.com/users/${t.githubUsername}/repos?per_page=100&sort=updated`);
              let repos = [];
              if (res.ok) {
                const data = await res.json();
                repos = data.filter(r => !r.fork).map(r => {
                  const m = r.name.match(/^korit_(\d+)_gov_(.+)$/);
                  if (!m || !gen || m[1] !== gen) return null;
                  return { name: r.name, label: `${m[1]}기 · ${m[2].replace(/_/g, ' ').toUpperCase()}` };
                }).filter(Boolean);
              }
              return { id: gId, group, teacher: t, repos };
            } catch { return null; }
          })
        );
        setClassData(results.filter(Boolean));
      } finally { setClassLoading(false); }
    };
    fetchData();
  }, [groupIDs]);

  // 챕터 로딩 로직 (선점/복원용)
  useEffect(() => {
    if (repo && teacher && chapters.length === 0 && !chaptersLoading) {
      handleRepoSelect(teacher, repo);
    }
  }, [repo, teacher, chapters, chaptersLoading]);

  // 레포 선택 → 챕터 목록 로드
  const handleRepoSelect = async (t, r) => {
    setTeacher(t);
    setRepo(r);
    setChapters([]);
    setExpandedChapters({});
    setChapterFilesMap({});
    setChapterFilesLoadingMap({});
    setChaptersLoading(true);
    setStep(1);
    setConcept(null);

    try {
      const headers = {};
      if (import.meta.env.VITE_GITHUB_TOKEN) {
        headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
      }

      const treeRes = await fetch(
        `https://api.github.com/repos/${t.githubUsername}/${r.name}/git/trees/HEAD?recursive=1`,
        { headers }
      );
      const treeData = await treeRes.json();
      const tree = treeData.tree || [];

      // ch\d+ 폴더 탐색
      const chDirs = tree
        .filter(item => item.type === 'tree' && /(?:^|\/)(ch\d+)$/.test(item.path))
        .map(item => ({
          name: item.path.split('/').pop(),
          fullPath: item.path,
          parent: item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '',
        }));

      if (chDirs.length === 0) {
        setChapters([]);
        setChaptersLoading(false);
        return;
      }

      // 가장 많은 챕터를 가진 부모 경로
      const parentCounts = {};
      chDirs.forEach(d => { parentCounts[d.parent] = (parentCounts[d.parent] || 0) + 1; });
      const root = Object.entries(parentCounts).sort((a, b) => b[1] - a[1])[0][0];

      const rootChapters = chDirs
        .filter(d => d.parent === root)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      // 챕터 목록 표시 (라벨 로딩 중)
      const initialChapters = rootChapters.map(ch => ({ ...ch, label: null, labelLoading: true }));
      setChapters(initialChapters);
      setChaptersLoading(false);

      // 각 챕터 라벨 병렬 분석
      rootChapters.forEach(async (ch, idx) => {
        try {
          const cacheId = `${t.githubUsername}_${r.name}_${ch.name}`;

          // 커밋 해시 확인 (헤더 추가)
          const commitRes = await fetch(
            `https://api.github.com/repos/${t.githubUsername}/${r.name}/commits?path=${ch.fullPath}&per_page=1`,
            { headers }
          );
          const commits = await commitRes.json();
          const commitHash = Array.isArray(commits) ? (commits[0]?.sha?.slice(0, 7) || '') : '';

          // Firebase 캐시 확인
          const cacheSnap = await getDoc(doc(db, 'chapterLabels', cacheId));
          if (cacheSnap.exists() && cacheSnap.data().commitHash === commitHash) {
            setChapters(prev => prev.map((c, i) =>
              i === idx ? { ...c, label: cacheSnap.data().label, labelLoading: false } : c
            ));
            return;
          }

          // 파일 목록 가져오기
          const filesRes = await fetch(
            `https://api.github.com/repos/${t.githubUsername}/${r.name}/contents/${ch.fullPath}`
          );
          const files = await filesRes.json();
          const codeFile = Array.isArray(files)
            ? files.find(f => /\.(java|js|jsx|ts|tsx|py)$/.test(f.name))
            : null;

          let label = ch.name;
          if (codeFile) {
            const codeRes = await fetch(codeFile.download_url);
            const code = await codeRes.text();
            label = await analyzeChapterLabel(code);
          }

          // Firebase 캐시 저장
          await setDoc(doc(db, 'chapterLabels', cacheId), { label, commitHash });

          setChapters(prev => prev.map((c, i) =>
            i === idx ? { ...c, label, labelLoading: false } : c
          ));
        } catch {
          setChapters(prev => prev.map((c, i) =>
            i === idx ? { ...c, label: ch.name, labelLoading: false } : c
          ));
        }
      });
    } catch (e) {
      console.error('챕터 로드 실패:', e);
      setChaptersLoading(false);
    }
  };

  // 챕터 클릭 → 아코디언 토글 + 파일 지연 로드
  const handleChapterToggle = async (ch) => {
    const isExpanded = expandedChapters[ch.name];
    setExpandedChapters(prev => ({ ...prev, [ch.name]: !isExpanded }));

    // 접을 때 또는 이미 파일이 로드된 경우 추가 fetch 불필요
    // (단, 파일 목록이 비어있다면 에러 상황일 수 있으므로 재요청 허용)
    if (isExpanded || (chapterFilesMap[ch.name] && chapterFilesMap[ch.name].length > 0)) return;

    setChapterFilesLoadingMap(prev => ({ ...prev, [ch.name]: true }));
    try {
      const headers = {};
      if (import.meta.env.VITE_GITHUB_TOKEN) {
        headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
      }

      const res = await fetch(
        `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${ch.fullPath}`,
        { headers }
      );
      
      if (!res.ok) {
        if (res.status === 403) console.warn('GitHub API Rate Limit 초과');
        throw new Error(`GitHub API Error: ${res.status}`);
      }

      const files = await res.json();
      const codeFiles = Array.isArray(files)
        ? files.filter(f => f.type === 'file' && /\.(java|js|jsx|ts|tsx|py)$/.test(f.name))
        : [];

      setChapterFilesMap(prev => ({
        ...prev,
        [ch.name]: codeFiles.map(f => ({ name: f.name, downloadUrl: f.download_url, path: f.path }))
      }));
    } catch (e) {
      console.error('파일 로드 실패:', e);
      // 실패 시 빈 배열을 넣지 않고 undefined로 두어 다음 클릭 시 재시도하게 함
    } finally {
      setChapterFilesLoadingMap(prev => ({ ...prev, [ch.name]: false }));
    }
  };

  // 파일 선택 → ChatView
  const handleFileSelect = (file, ch) => {
    setConcept({
      type: 'file',
      downloadUrl: file.downloadUrl,
      name: file.name,
      path: file.path,
      chapterLabel: ch.label || ch.name,
    });
    setStep(2);
  };

  const reset = () => {
    storeReset();
  };

  // 사이드바 콘텐츠
  const renderSidebar = () => {
    // 레포 미선택: 레포 목록
    if (!repo) {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {groupIDs.length === 0 ? null : classLoading ? (
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="w-3.5 h-3.5 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-gray-500 text-xs">불러오는 중...</span>
            </div>
          ) : (
            classData.map(({ id, group, teacher: t, repos }) => (
              <div key={id} className="mb-4">
                <div className="px-2 mb-1.5">
                  <p className="text-[11px] font-bold text-gray-400 truncate">{group.name}</p>
                  <p className="text-[10px] text-gray-600">@{t.githubUsername}</p>
                </div>
                {repos.map(r => (
                  <button
                    key={r.name}
                    onClick={() => handleRepoSelect(t, r)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2.5 group mb-1.5 bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-[#4ec9b0]/25 hover:text-white hover:shadow-[0_0_10px_rgba(78,201,176,0.1)]"
                  >
                    <div className="shrink-0 p-1.5 rounded-lg bg-white/5 group-hover:bg-[#4ec9b0]/10 transition-colors">
                      <svg className="w-3 h-3 text-gray-500 group-hover:text-[#4ec9b0]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold break-words min-w-0">{r.label}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      );
    }

    // 레포 선택됨: 아코디언 트리뷰
    return (
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* 뒤로가기 */}
        <button
          onClick={() => { reset(); }}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-[11px] px-2 py-1.5 mb-1 transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          레포 목록
        </button>
        <p className="text-[10px] font-bold text-gray-500 px-2 mb-2 truncate">{repo.label}</p>

        {chaptersLoading ? (
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="w-3.5 h-3.5 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-gray-500 text-xs">챕터 로딩 중...</span>
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-gray-600 text-xs px-2">챕터 없음</p>
        ) : (
          chapters.map((ch) => {
            const isExpanded = expandedChapters[ch.name];
            const files = chapterFilesMap[ch.name] || [];
            const isLoadingFiles = chapterFilesLoadingMap[ch.name];

            return (
              <div key={ch.name} className="mb-0.5">
                {/* 챕터 행 */}
                <button
                  onClick={() => handleChapterToggle(ch)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-all group"
                >
                  <svg
                    className={`w-2.5 h-2.5 text-gray-600 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M8 5l8 7-8 7V5z" />
                  </svg>
                  <svg className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: '#569cd6' }}>
                    {ch.name.replace('ch', 'ch.')}
                  </span>
                  {ch.labelLoading ? (
                    <div className="w-2.5 h-2.5 border border-gray-600 border-t-transparent rounded-full animate-spin shrink-0 ml-1" />
                  ) : (
                    ch.label && ch.label !== ch.name && (
                      <span className="text-[10px] truncate min-w-0 opacity-80 font-medium ml-1.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/5" style={{ color: '#ce9178' }}>
                        {ch.label}
                      </span>
                    )
                  )}
                </button>

                {/* 파일 목록 (확장 시) */}
                {isExpanded && (
                  <div className="ml-5 border-l border-white/[0.06] pl-2 mt-0.5 mb-1">
                    {isLoadingFiles ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <div className="w-2.5 h-2.5 border border-gray-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="text-gray-600 text-[10px]">로딩 중...</span>
                      </div>
                    ) : files.length === 0 ? (
                      <p className="text-gray-600 text-[10px] px-2 py-1">파일 없음</p>
                    ) : (
                      files.map((file) => (
                        <button
                          key={file.name}
                          onClick={() => handleFileSelect(file, ch)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group mb-0.5 ${
                            concept?.name === file.name
                              ? 'bg-[#4ec9b0]/10'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <svg className="w-3 h-3 shrink-0 text-gray-600 group-hover:text-[#dcdcaa] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span
                            className="text-[11px] truncate"
                            style={{ color: concept?.name === file.name ? '#4ec9b0' : '#dcdcaa' }}
                          >
                            {file.name}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

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

        {/* 사이드바 콘텐츠 */}
        {renderSidebar()}

        {/* 하단 프로필 */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#mob-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="mob-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ec9b0" />
                  <stop offset="100%" stopColor="#569cd6" />
                </linearGradient>
              </defs>
              <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
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
      <main className="flex-1 overflow-hidden p-2 pt-16 md:pt-2 md:p-2 flex justify-center bg-theme-bg">
        <div className="w-full max-w-[95%] xl:max-w-[1400px] h-full flex flex-col justify-center pb-2">

          {groupIDs.length === 0 ? (
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
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <div className="mb-6 p-4 bg-gradient-to-br from-theme-primary/10 to-theme-icon/10 rounded-2xl border border-white/5">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#welcome-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="welcome-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ec9b0" />
                      <stop offset="100%" stopColor="#569cd6" />
                    </linearGradient>
                  </defs>
                  <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">오늘 배운 파일을 선택해주세요</h2>
              <p className="text-gray-500 text-sm">
                {!repo ? '왼쪽에서 과목을 선택하면 챕터 목록이 나타납니다.' : '챕터를 펼쳐 파일을 선택하면 AI 학습이 시작됩니다.'}
              </p>
            </div>

          ) : step === 2 ? (
            <ChatView
              teacher={teacher}
              repo={repo}
              concept={concept}
              onComplete={(r) => { setResult(r); setStep(3); }}
              onBack={() => setStep(1)}
            />

          ) : (
            <ResultView result={result} onReset={reset} />
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentPage;
