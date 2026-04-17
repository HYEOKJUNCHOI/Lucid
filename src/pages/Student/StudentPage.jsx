import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import nightOwlTheme from '../../themes/nightOwl.json';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ChatView from './ChatView';
import ResultView from './ResultView';
import LevelUpView from './LevelUpView';
import QuestView from './QuestView';
import PlacementView from './PlacementView';
import DiagnosisView from './DiagnosisView';
import FreeStudyView from './FreeStudyView';
import useLearningStore from '../../store/useLearningStore';
import ApiKeyModal from '../../components/common/ApiKeyModal';
import { calcLevel, xpToNextLevel, LEVEL_TABLE, isWeekend, getRewardStatus, DAILY_XP_CAP, syncVisitedFile, syncUserStatus, getGithubFileCache, saveGithubFileCache } from '../../services/learningService';
import { calcStreakStatus, claimLoginXPFS, useFreezeOnDateFS, getDailyXPFromState, getUserState, updateUserState } from '../../services/userStateService';
import { getApiKey } from '../../lib/apiKey';
import Toast, { showToast } from '../../components/common/Toast';
import TypingBadge from '../../components/common/TypingBadge';
import MemoInventory from '../../components/memo/MemoInventory';
import MobileTopBar from '../../components/common/mobile/MobileTopBar';
import MobileBottomTab from '../../components/common/mobile/MobileBottomTab';
import SidebarDrawer from '../../components/common/mobile/SidebarDrawer';
import { useIsMobile } from '../../hooks/useMediaQuery';


const StudentPage = ({ user, userData, onLogout, forcedMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
    visitedFiles, markFileVisited,
    completedFiles, markFileCompleted,
    reset: storeReset,
    resetSession,
  } = useLearningStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  // 📱 모바일 전용 배지 툴팁 탭 토글
  const [showStreakTip, setShowStreakTip] = useState(false);
  const [showWeekTip, setShowWeekTip] = useState(false);
  // 📱 모바일 반응형 상태
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [streakStatus, setStreakStatus] = useState('ok'); // 'ok'|'grace1'|'grace2'|'broken'|'repair'
  const [repairCount, setRepairCount] = useState(-1);
  const [mode, setMode] = useState(() => {
    // forcedMode 가 App.jsx 에서 라우트별로 주입되면 우선 사용
    if (forcedMode !== undefined) return forcedMode;
    const p = window.location.pathname;
    if (p === '/chapter' || p === '/home/chapter') return 'chapter';
    if (p === '/home/quest') return 'quest';
    if (p === '/home/levelup') return 'levelup';
    if (p === '/study' || p === '/freestudy') return 'freeStudy';
    return null;
  });
  const [sidebarMini, setSidebarMini] = useState(false); // 사이드바 미니모드
  const [homeConfirm, setHomeConfirm] = useState(false); // 홈 이동 확인 모달
  const [questDoneModal, setQuestDoneModal] = useState(null);
  const [chapterModal, setChapterModal] = useState(false);
  const [freeStudyCode, setFreeStudyCode] = useState(null);
  const [chapterSelectedFile, setChapterSelectedFile] = useState(null); // { file, code }
  const [chapterCodeLoading, setChapterCodeLoading] = useState(false);
  const [freeStudySource, setFreeStudySource] = useState(null); // null | 'chapter' // { xp, count }

  const [dailyXP, setDailyXP] = useState({ total: 0, quest: 0, levelup: 0, login: 0 });
  const [freezeCount, setFreezeCount] = useState(0);
  const [beanCount, setBeanCount] = useState(0);
  const [loginXPClaimed, setLoginXPClaimed] = useState(false);

  // 로그인 시 1회 실행: 스트릭 계산 + 접속 XP + 파일 진도 복원
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setStreak(0); setStreakStatus('ok'); setRepairCount(-1);
      return;
    }
    getUserState(uid).then(async (state) => {
      if (!state) return;
      // 방문/완료 파일 복원
      (state.visitedFiles  || []).forEach(p => markFileVisited(p));
      (state.completedFiles || []).forEach(p => markFileCompleted(p));
      // 스트릭 상태 계산 (Firestore 기반 — 필요 시 FS 자동 갱신)
      const { streak: newStreak, status, repairCount: rc } = await calcStreakStatus(uid, state);
      setStreak(newStreak);
      setStreakStatus(status);
      setRepairCount(rc);
      // 접속 보상 50 XP (하루 1회) — calcStreakStatus가 FS를 수정했을 수 있으므로 재조회
      const freshState = await getUserState(uid);
      const xp = await claimLoginXPFS(uid, freshState);
      if (xp > 0) setLoginXPClaimed(true);
      syncUserStatus(uid, user?.displayName || user?.email?.split('@')[0] || '');
    });
  }, [user]);

  // userData(onSnapshot) 변경 시 UI 실시간 동기화
  useEffect(() => {
    if (!userData) return;
    setFreezeCount(userData.streakFreezes || 0);
    setBeanCount(userData.beanCount || 0);
    setDailyXP(getDailyXPFromState(userData));
    if (userData.streak != null) setStreak(userData.streak);
  }, [userData]);


  // mode 변경 시 URL 동기화
  useEffect(() => {
    const pathMap = { chapter: '/chapter', quest: '/home/quest', levelup: '/home/levelup', freeStudy: '/study' };
    const target = pathMap[mode] || '/home';
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [mode]);

  // 레포 목록
  const [classData, setClassData] = useState([]);
  const [classLoading, setClassLoading] = useState(true);
  const [selectedRepoKey, setSelectedRepoKey] = useState(null); // 클릭 애니메이션용
  const [visitedRepoKeys, setVisitedRepoKeys] = useState(new Set()); // 한번 이상 열어본 레포

  // 챕터 퀘스트 완료 토스트
  const [chapterQuestToast, setChapterQuestToast] = useState(null); // { name }
  const [questDevNotice, setQuestDevNotice] = useState(false);
  const prevCompletedRef = useRef([]);
  useEffect(() => {
    if (!completedFiles.length) return;
    Object.entries(chapterFilesMap).forEach(([chName, files]) => {
      if (!files.length) return;
      const allDone = files.every(f => completedFiles.includes(f.path));
      const wasDone = files.every(f => prevCompletedRef.current.includes(f.path));
      if (allDone && !wasDone) {
        setChapterQuestToast({ name: chName });
        const t = setTimeout(() => setChapterQuestToast(null), 3200);
        return () => clearTimeout(t);
      }
    });
    prevCompletedRef.current = completedFiles;
  }, [completedFiles, chapterFilesMap]);

  // completedFiles 기반으로 visited repo 자동 마킹
  useEffect(() => {
    if (!completedFiles.length || !classData.length) return;
    const keys = new Set();
    classData.forEach(({ id, repos }) => {
      repos.forEach((r) => {
        const repoKey = `${id}-${r.name}`;
        const files = Object.values(chapterFilesMap).flat();
        if (files.some(f => completedFiles.includes(f.path))) {
          if (selectedRepoKey === repoKey) keys.add(repoKey);
        }
      });
    });
    if (keys.size > 0) {
      setVisitedRepoKeys(prev => new Set([...prev, ...keys]));
    }
  }, [completedFiles, selectedRepoKey]);
  const [statusPop, setStatusPop] = useState(false); // 모드카드 클릭 시 스테이터스 박스 pop
  const [memoInventoryOpen, setMemoInventoryOpen] = useState(false); // 학습메모 인벤토리
  const [selectedChapter, setSelectedChapter] = useState(null); // 2패널: 선택된 챕터
  const [chapterHover, setChapterHover] = useState(null); // 챕터 호버 미리보기 { name, files, top, left }
  const [freezeHover, setFreezeHover] = useState(null); // 얼리기 호버 툴팁 { top, left }
  const [freezeConfirm, setFreezeConfirm] = useState(null); // 얼리기 사용 확인 모달 { dateStr, day }
  const [beanHover, setBeanHover] = useState(null); // 원두 호버 툴팁 { top, left }
  const [americanoHover, setAmericanoHover] = useState(null); // 아메리카노 호버 툴팁 { top, left }
  const [cheatHover, setCheatHover] = useState(null); // 개발자정신 배지 호버 { top, left }
  const [americanoPopup, setAmericanoPopup] = useState(false); // 아메리카노 교환 완료 팝업
  // frozenDates는 userData.frozenDates로 FS에서 직접 읽음 (별도 state 불필요)

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
              // GitHub API 인증 헤더 — 비인증 60/h → 인증 5000/h
              const ghHeaders = {};
              if (import.meta.env.VITE_GITHUB_TOKEN) ghHeaders['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
              const res = await fetch(
                `https://api.github.com/users/${t.githubUsername}/repos?per_page=100&sort=updated`,
                { headers: ghHeaders }
              );
              let repos = [];
              if (res.ok) {
                const data = await res.json();
                repos = data.filter(r => !r.fork).map(r => {
                  const m = r.name.match(/^korit_(\d+)_gov_(.+)$/);
                  if (!m || !gen || m[1] !== gen) return null;
                  return { name: r.name, label: `${m[1]}기 · ${m[2].replace(/_/g, ' ').toUpperCase()}` };
                }).filter(Boolean).reverse(); // 역순: 첫 수업이 위로
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

  // 챕터 로딩 로직 (새로고침 복원용 — 최초 마운트 시 1회만)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!hasRestoredRef.current && repo && teacher && chapters.length === 0 && !chaptersLoading) {
      hasRestoredRef.current = true;
      handleRepoSelect(teacher, repo);
    }
  }, [repo, teacher]);

  // GitHub API 남은 쿼터 체크
  const checkGitHubRateLimit = async (headers) => {
    try {
      const res = await fetch('https://api.github.com/rate_limit', { headers });
      const data = await res.json();
      return data.resources?.core?.remaining ?? 999;
    } catch { return 999; }
  };

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
    setSelectedChapter(null);

    try {
      const headers = {};
      if (import.meta.env.VITE_GITHUB_TOKEN) {
        headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
      }

      // API 쿼터 사전 체크 (챕터 수 × 3 정도 필요)
      const remaining = await checkGitHubRateLimit(headers);
      if (remaining < 10) {
        showToast(`GitHub API 한도 거의 소진 (남은 횟수: ${remaining}). 잠시 후 다시 시도해주세요.`, 'warn');
        setChaptersLoading(false);
        return;
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

      let rootChapters;

      if (chDirs.length > 0) {
        // ch\d+ 폴더가 있으면 기존 로직
        const parentCounts = {};
        chDirs.forEach(d => { parentCounts[d.parent] = (parentCounts[d.parent] || 0) + 1; });
        const root = Object.entries(parentCounts).sort((a, b) => b[1] - a[1])[0][0];

        rootChapters = chDirs
          .filter(d => d.parent === root)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      } else {
        // ch 폴더가 없으면 코드 파일이 있는 폴더를 찾아서 챕터로 표시
        const ignoreSet = new Set(['node_modules', 'build', 'dist', 'target', 'out', '.idea', '.gradle', '.git', '.vscode', '__pycache__', 'test', 'tests', '__tests__', 'resources']);
        const codeFiles = tree.filter(item =>
          item.type === 'blob' &&
          /\.(java|js|jsx|ts|tsx|py|html|css|jsp)$/.test(item.path) &&
          !item.path.split('/').some(seg => ignoreSet.has(seg))
        );

        // 코드 파일의 부모 폴더를 수집
        const folderPaths = new Set();
        codeFiles.forEach(f => {
          const parts = f.path.split('/');
          if (parts.length < 2) return;
          folderPaths.add(parts.slice(0, -1).join('/'));
        });

        // 하위 폴더가 있는 부모 폴더는 제거 (리프 폴더만 유지)
        const leafFolders = Array.from(folderPaths).filter(fp =>
          !Array.from(folderPaths).some(other => other !== fp && other.startsWith(fp + '/'))
        );

        // 이름 중복 체크 → 중복이면 부모 경로 포함
        const nameCount = {};
        leafFolders.forEach(fp => {
          const name = fp.split('/').pop();
          nameCount[name] = (nameCount[name] || 0) + 1;
        });

        rootChapters = leafFolders
          .map(fp => {
            const parts = fp.split('/');
            const lastName = parts.pop();
            const displayName = nameCount[lastName] > 1
              ? `${parts.pop() || ''}/${lastName}`
              : lastName;
            return { name: displayName, fullPath: fp, parent: '' };
          })
          .sort((a, b) => a.fullPath.localeCompare(b.fullPath, undefined, { numeric: true }));
      }

      const initialChapters = rootChapters.map(ch => ({ ...ch, label: null, labelLoading: false }));
      setChapters(initialChapters);

      // ch 폴더가 없는 레포: 모든 폴더를 열린 상태 + tree에서 파일 목록 프리로드
      if (chDirs.length === 0 && initialChapters.length > 0) {
        const expanded = {};
        const filesMap = {};
        initialChapters.forEach(ch => {
          expanded[ch.name] = true;
          // tree에서 해당 폴더의 코드 파일 직접 추출 (API 호출 없이)
          const folderFiles = tree
            .filter(item =>
              item.type === 'blob' &&
              item.path.startsWith(ch.fullPath + '/') &&
              !item.path.substring(ch.fullPath.length + 1).includes('/') &&
              /\.(java|js|jsx|ts|tsx|py|html|css|jsp)$/.test(item.path)
            )
            .map(item => ({
              name: item.path.split('/').pop(),
              downloadUrl: `https://raw.githubusercontent.com/${t.githubUsername}/${r.name}/HEAD/${item.path}`,
              path: item.path,
              sha: item.sha,
            }));
          filesMap[ch.name] = folderFiles;
        });
        setExpandedChapters(expanded);
        setChapterFilesMap(filesMap);
      }

      setChaptersLoading(false);
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
        [ch.name]: codeFiles.map(f => ({ name: f.name, downloadUrl: f.download_url, path: f.path, sha: f.sha }))
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
    markFileVisited(file.path);
    if (user?.uid) syncVisitedFile(user.uid, file.path);
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
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {groupIDs.length === 0 ? null : classLoading ? (
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="w-3.5 h-3.5 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-gray-500 text-xs">불러오는 중...</span>
            </div>
          ) : (
            classData.map(({ id, group, teacher: t, repos }, groupIdx) => (
              <div key={id} className="mb-4 sidebar-card-enter" style={{ animationDelay: `${groupIdx * 60}ms` }}>
                <div className="px-2 mb-1.5">
                  <p className="text-[13px] font-extrabold text-white/90 truncate">{group.name}</p>
                </div>
                {repos.map((r, repoIdx) => {
                  const repoKey = `${id}-${r.name}`;
                  const isSelected = selectedRepoKey === repoKey;
                  return (
                    <button
                      key={r.name}
                      onClick={() => {
                        setSelectedRepoKey(repoKey);
                        setVisitedRepoKeys(prev => new Set(prev).add(repoKey));
                        handleRepoSelect(t, r);
                      }}
                      className={`sidebar-card-enter w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2.5 group mb-1.5 relative overflow-hidden ${
                        isSelected
                          ? 'bg-white/[0.03] border-white/[0.07] text-gray-500'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-[#4ec9b0]/25 hover:text-white hover:shadow-[0_0_10px_rgba(78,201,176,0.1)]'
                      }`}
                      style={{ animationDelay: `${groupIdx * 60 + (repoIdx + 1) * 70}ms` }}
                    >
                      <div className={`shrink-0 p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-white/[0.04]' : 'bg-white/5 group-hover:bg-[#4ec9b0]/10'}`}>
                        {isSelected ? (
                          <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-gray-500 group-hover:text-[#4ec9b0]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-[11px] break-words min-w-0 ${isSelected ? 'font-normal text-gray-500' : 'font-semibold'}`}>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      );
    }

    // 레포 선택됨: 아코디언 트리뷰
    return (
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* 뒤로가기: 레포 목록 */}
        <button
          onClick={() => { reset(); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-semibold px-2 py-2 mb-1 rounded-lg hover:bg-white/[0.04] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          chapters.map((ch, chIdx) => {
            const isExpanded = expandedChapters[ch.name];
            const files = chapterFilesMap[ch.name] || [];
            const isLoadingFiles = chapterFilesLoadingMap[ch.name];

            return (
              <div key={ch.name} className="mb-0.5 sidebar-card-enter" style={{ animationDelay: `${chIdx * 50}ms` }}>
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
                      files.map((file) => {
                        const isActive = concept?.path === file.path;
                        const isVisited = visitedFiles.includes(file.path);
                        const isCompleted = completedFiles.includes(file.path);
                        return (
                          <button
                            key={file.name}
                            onClick={async () => {
                                          try {
                                            let code = file.sha ? await getGithubFileCache(file.sha) : null;
                                            if (!code) {
                                              const resp = await fetch(file.downloadUrl);
                                              code = await resp.text();
                                              if (file.sha) saveGithubFileCache(file.sha, code);
                                            }
                                            setFreeStudyCode(code);
                                            setFreeStudySource('chapter');
                                            setMode('freeStudy');
                                          } catch {
                                            setFreeStudyCode('// 코드를 불러오지 못했습니다');
                                            setFreeStudySource('chapter');
                                            setMode('freeStudy');
                                          }
                                        }}
                            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group mb-0.5 ${
                              isActive
                                ? 'bg-[#c586c0]/10'
                                : isCompleted
                                ? 'bg-[#4ec9b0]/5'
                                : isVisited
                                ? 'bg-[#f48ab8]/5'
                                : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            {isCompleted ? (
                              <svg className="w-3 h-3 shrink-0" style={{ color: '#4ec9b0' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg
                                className="w-3 h-3 shrink-0 transition-colors"
                                style={{ color: isActive ? '#c586c0' : isVisited ? '#f48ab8' : '#555' }}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                            <span
                              className="text-[11px] truncate"
                              style={{ color: isCompleted ? '#4ec9b0' : isActive ? '#c586c0' : isVisited ? '#f48ab8' : '#dcdcaa' }}
                            >
                              {file.name}
                            </span>
                          </button>
                        );
                      })
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
    <div className="flex h-svh md:h-svh min-h-dvh bg-theme-bg text-white overflow-hidden">

      {/* 챕터 호버 미리보기 (fixed) */}
      {chapterHover && chapterHover.files.length > 0 && (
        <div
          className="pointer-events-none z-[9999] fixed w-52 bg-[#1a1a1a] border border-white/[0.08] rounded-xl p-2.5 shadow-2xl"
          style={{ top: chapterHover.top, left: chapterHover.left + 8 }}
        >
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-0.5">
            {chapterHover.name.replace('ch', 'ch.')} · {chapterHover.files.length}개 파일
          </p>
          <div className="flex flex-col gap-0.5">
            {chapterHover.files.map((f) => {
              const fc = completedFiles.includes(f.path);
              const fv = visitedFiles.includes(f.path);
              return (
                <div key={f.name} className="flex items-center gap-1.5 px-1 py-0.5">
                  {fc ? (
                    <span className="text-[8px] shrink-0" style={{ color: '#4ec9b0' }}>✓</span>
                  ) : fv ? (
                    <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#f48ab8' }} />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                  )}
                  <span className="text-[10px] truncate" style={{ color: fc ? '#4ec9b0' : fv ? '#f48ab8' : '#9ca3af' }}>{f.name}</span>
                </div>
              );
            })}
          </div>
          {/* 말풍선 꼬리 */}
          <div className="absolute top-3 right-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-white/[0.08]" />
        </div>
      )}

      {/* 얼리기 사용 확인 모달 */}
      {freezeConfirm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setFreezeConfirm(null)}
        >
          <div
            className="w-[320px] rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1c2530 0%, #161c26 100%)', border: '1px solid rgba(147,210,255,0.35)', boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(147,210,255,0.1), 0 0 40px rgba(86,156,214,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-5 pt-5 pb-4 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-3xl mb-2">🧊</div>
              <div className="text-[15px] font-black text-white mb-1">지난 결석일 얼리기</div>
              <div className="text-[11px] text-gray-400">
                {freezeConfirm.dateStr.slice(0, 4)}년 {parseInt(freezeConfirm.dateStr.slice(5, 7), 10)}월 <span className="text-[#93d2ff] font-bold">{freezeConfirm.day}일</span>을 얼리겠습니까?
              </div>
            </div>
            {/* 본문 */}
            <div className="px-5 py-4 text-center">
              <p className="text-[11px] text-gray-300 leading-relaxed">
                얼리기 1개를 사용해 이 날을<br/>
                <span className="text-[#93d2ff] font-bold">연속 출석일</span>에 포함시킵니다
              </p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                <span>보유:</span>
                <span className="text-[#569cd6] font-black text-[12px]">🧊 {freezeCount}개</span>
                <span>→</span>
                <span className="text-[#569cd6]/60 font-black text-[12px]">{freezeCount - 1}개</span>
              </div>
            </div>
            {/* 버튼 */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => setFreezeConfirm(null)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-bold text-gray-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  const uid = user?.uid;
                  if (!uid) return;
                  const state = await getUserState(uid);
                  const { success, remaining, newStreak } = await useFreezeOnDateFS(uid, freezeConfirm.dateStr, state);
                  if (success) {
                    setFreezeCount(remaining);
                    setStreak(newStreak);
                  }
                  setFreezeConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-black text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #569cd6, #4a8bc2)', border: '1px solid rgba(147,210,255,0.6)', boxShadow: '0 0 16px rgba(86,156,214,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                🧊 사용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 얼리기 호버 툴팁 (fixed) */}
      {freezeHover && (
        <div
          className="pointer-events-none z-[9999] fixed w-52 rounded-2xl shadow-2xl"
          style={{ top: freezeHover.top, left: freezeHover.left + 10, background: 'linear-gradient(160deg, #1c1c2e 0%, #1a1a28 100%)', border: '1px solid rgba(86,156,214,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(86,156,214,0.08)' }}
        >
          {/* 헤더 */}
          <div className="px-3.5 pt-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">🧊</span>
              <span className="text-[11px] font-black text-white tracking-tight">얼리기</span>
            </div>
            <p className="text-[8.5px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ color: '#fbbf24' }}>연속출석</span>이 끊겨도 <span style={{ color: '#c084fc' }}>해당일</span>을 <span style={{ color: '#60a5fa' }}>얼려서</span> <span style={{ color: '#fbbf24' }}>연속출석</span>을 지켜주는 아이템
            </p>
          </div>

          {/* 획득 조건 */}
          <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>획득 조건</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[9px] mt-px">📅</span>
                <p className="text-[8.5px] leading-[1.5]" style={{ color: '#ffffff' }}>주말 <span style={{ color: '#60a5fa' }}>토</span>·<span style={{ color: '#f87171' }}>일</span> <span style={{ color: '#ffffff' }}>모두</span><br /><span style={{ color: 'rgba(255,255,255,0.7)' }}>퀘스트 완료</span> 시 1개</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[9px] mt-px">🔥</span>
                <p className="text-[8.5px] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.5)' }}><span style={{ color: '#fbbf24' }}>10일 연속 달성</span> 시<br />1개 추가 지급</p>
              </div>
            </div>
          </div>

          {/* 10일 진행 */}
          <div className="px-3.5 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[7.5px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>10일 달성까지</p>
              <p className="text-[8px] font-black" style={{ color: '#fbbf24' }}>{freezeHover.streak % 10}<span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> / 10</span></p>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(((freezeHover.streak % 10) / 10) * 100, 100)}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)', boxShadow: '0 0 6px rgba(251,191,36,0.6)' }} />
            </div>
            {freezeHover.streak >= 10 && (
              <p className="text-[7.5px] mt-1" style={{ color: 'rgba(251,191,36,0.6)' }}>✓ {Math.floor(freezeHover.streak / 10)}회 달성</p>
            )}
          </div>

          {/* 말풍선 꼬리 */}
          <div className="absolute top-5 right-full w-0 h-0 border-t-[5px] border-b-[5px] border-r-[5px] border-t-transparent border-b-transparent" style={{ borderRightColor: 'rgba(86,156,214,0.2)' }} />
        </div>
      )}

      {/* 원두 호버 툴팁 (fixed) */}
      {beanHover && (
        <div
          className="pointer-events-none z-[9999] fixed w-52 rounded-2xl shadow-2xl"
          style={{ top: Math.min(beanHover.top, window.innerHeight - 260), left: beanHover.left, background: 'linear-gradient(160deg, #1c1c2e 0%, #1a1a28 100%)', border: '1px solid rgba(245,158,11,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)' }}
        >
          {/* 헤더 */}
          <div className="px-3.5 pt-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">🫘</span>
              <span className="text-[11px] font-black text-white tracking-tight">원두</span>
            </div>
            <p className="text-[8.5px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              <span style={{ color: '#fbbf24' }}>원두 5개</span>를 모으면<br /><span style={{ color: '#ffffff' }}>학원에서</span> <span style={{ color: '#d97706' }}>아메리카노</span>를<br /><span style={{ color: '#60a5fa' }}>한 잔</span> 사줄지도 모릅니다(?)
            </p>
          </div>

          {/* 획득 조건 */}
          <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>획득 조건</p>
            <div className="flex items-start gap-2">
              <span className="text-[9px] mt-px">📋</span>
              <p className="text-[8.5px] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.5)' }}><span style={{ color: '#fbbf24' }}>오늘의 퀘스트</span> 진행 시<br /><span style={{ color: 'rgba(255,255,255,0.7)' }}>가끔씩 드랍</span>됩니다</p>
            </div>
          </div>

          {/* 5개 진행 */}
          <div className="px-3.5 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[7.5px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>아메리카노까지</p>
              <p className="text-[8px] font-black" style={{ color: '#f59e0b' }}>{beanCount}<span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> / 5</span></p>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i < beanCount ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.06)', boxShadow: i < beanCount ? '0 0 4px rgba(245,158,11,0.5)' : 'none' }} />
              ))}
            </div>
            {beanCount >= 5 && (
              <p className="text-[7.5px] mt-1" style={{ color: 'rgba(245,158,11,0.8)' }}>☕ 아메리카노 받을 준비 완료!</p>
            )}
          </div>

          {/* 말풍선 꼬리 */}
          <div className="absolute top-5 right-full w-0 h-0 border-t-[5px] border-b-[5px] border-r-[5px] border-t-transparent border-b-transparent" style={{ borderRightColor: 'rgba(245,158,11,0.2)' }} />
        </div>
      )}

      {/* 아메리카노 호버 툴팁 (fixed) */}
      {americanoHover && (
        <div
          className="pointer-events-none z-[9999] fixed w-48 rounded-2xl shadow-2xl"
          style={{ top: Math.min(americanoHover.top, window.innerHeight - 120), left: Math.max(8, americanoHover.left - 192 + 28), background: 'linear-gradient(160deg, #1c1507 0%, #181208 100%)', border: '1px solid rgba(217,119,6,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(217,119,6,0.08)' }}
        >
          <div className="px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base leading-none">☕</span>
              <span className="text-[11px] font-black text-white tracking-tight">아메리카노</span>
            </div>
            <p className="text-[8.5px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              <span style={{ color: '#fbbf24' }}>멘토</span>님에게<br />
              <span style={{ color: '#d97706' }}>아메리카노</span>를 <span style={{ color: '#60a5fa' }}>쫄라보세요</span> (?)
            </p>
          </div>
        </div>
      )}

      {/* 아메리카노 교환 완료 팝업 */}
      {americanoPopup && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, rgba(120,60,0,0.55) 0%, rgba(0,0,0,0.82) 100%)', backdropFilter: 'blur(8px)' }}
          onClick={() => setAmericanoPopup(false)}
        >
          <div
            className="relative text-center"
            style={{ animation: 'fadeScaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 배경 글로우 */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(217,119,6,0.18) 0%, transparent 70%)', filter: 'blur(20px)' }} />

            <div className="relative rounded-3xl px-10 py-9" style={{ background: 'linear-gradient(160deg, #1e1a0f 0%, #141008 100%)', border: '1px solid rgba(217,119,6,0.4)', boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(217,119,6,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

              {/* 스팀 라인들 */}
              <div className="flex justify-center gap-3 mb-1" style={{ height: 28 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-0.5 rounded-full" style={{
                    background: 'linear-gradient(to top, rgba(217,119,6,0.6), transparent)',
                    height: '100%',
                    animation: `steamRise 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>

              {/* 커피 이모지 */}
              <div className="text-6xl mb-4 leading-none" style={{ filter: 'drop-shadow(0 0 16px rgba(217,119,6,0.6))' }}>☕</div>

              {/* 원두 → 아메리카노 변환 표시 */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>🫘 ×5</span>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706', border: '1px solid rgba(217,119,6,0.25)' }}>☕ ×1</span>
              </div>

              {/* 메인 텍스트 */}
              <p className="text-[20px] font-black leading-snug mb-2">
                <span style={{ color: '#d97706' }}>아메리카노</span>{' '}
                <span style={{ color: '#60a5fa' }}>한 잔</span>{' '}
                <span className="text-white">얻으셨네요!</span>
              </p>
              <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ color: '#fbbf24' }}>멘토</span>
                <span>님께 쫄라보세요 (?)</span>
              </p>

              <button
                onClick={() => setAmericanoPopup(false)}
                className="w-full py-2.5 rounded-xl text-[13px] font-black text-white transition-all hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.5), rgba(180,83,9,0.35))', border: '1px solid rgba(217,119,6,0.4)' }}
              >확인</button>
            </div>
          </div>

          <style>{`
            @keyframes fadeScaleIn {
              from { opacity: 0; transform: scale(0.85); }
              to   { opacity: 1; transform: scale(1); }
            }
            @keyframes steamRise {
              0%   { transform: translateY(0) scaleX(1); opacity: 0.6; }
              50%  { transform: translateY(-10px) scaleX(1.4); opacity: 0.3; }
              100% { transform: translateY(-20px) scaleX(0.8); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* 개발자정신 배지 호버 툴팁 (fixed) */}
      {cheatHover && (
        <div
          className="pointer-events-none z-[9999] fixed rounded-xl shadow-2xl"
          style={{ top: Math.max(8, cheatHover.top - 80), left: cheatHover.left + 8, background: '#1a1f2e', border: '1px solid rgba(148,163,184,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', width: 180 }}
        >
          <div className="px-3.5 py-2.5">
            <div className="text-slate-300 text-[10px] font-black mb-1.5">🤫 개발자정신</div>
            <div className="text-gray-300 text-[10px] leading-relaxed">버그 쓰셨어요??</div>
          </div>
        </div>
      )}

      {/* 챕터 퀘스트 완료 토스트 */}
      {chapterQuestToast && (
        <div className="quest-complete-toast fixed bottom-10 left-1/2 z-[200] pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#f59e0b]/40 bg-[#0c0c0c] shadow-[0_0_40px_rgba(245,158,11,0.25)]">
            <span className="text-xl">⚔️</span>
            <div>
              <p className="text-[11px] font-black tracking-[0.15em] uppercase text-[#f59e0b]">챕터 완료</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{chapterQuestToast.name.replace('ch', 'ch.')} 모든 파일 학습 완료</p>
            </div>
            <span className="text-[#f59e0b]/60 text-lg ml-1">✦</span>
          </div>
        </div>
      )}

      {/* 좌측 사이드바 */}
      <aside className={`${sidebarMini ? 'w-[68px]' : 'w-64'} shrink-0 bg-theme-sidebar border-r border-theme-border flex flex-col hidden md:flex transition-all duration-300 overflow-hidden`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

        {/* 로고 + 사이드바 토글 (Claude 스타일) */}
        <div className={`${sidebarMini ? 'p-2' : 'px-4 py-3'} flex items-center ${sidebarMini ? 'justify-center' : 'justify-between'}`}>
          <div
            className={`flex items-center ${sidebarMini ? '' : 'gap-3'}`}
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
            {!sidebarMini && <h1 className="text-2xl font-black tracking-tight text-white">Lucid</h1>}
          </div>
          {!sidebarMini && (
            <button
              onClick={(e) => { e.stopPropagation(); setSidebarMini(true); }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all"
              title="사이드바 접기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
        </div>

        {/* 사이드바 콘텐츠: 모드에 따라 분기 (미니모드에서는 아이콘 카드) */}
        {sidebarMini ? (
          /* ─── 미니모드: 아이콘 카드 ─── */
          <div className="flex-1 flex flex-col items-center gap-1.5 py-2 px-1 overflow-hidden">
            {(() => {
              const totalXP = userData?.totalXP || 0;
              const lv = calcLevel(totalXP);
              const now = new Date();
              const dayNames = ['일','월','화','수','목','금','토'];
              const courseEnd = new Date('2025-09-30');
              const daysLeft = Math.max(0, Math.ceil((courseEnd - now) / 86400000));
              return (
                <>
                  {/* 펼치기 버튼 */}
                  <button
                    onClick={() => setSidebarMini(false)}
                    className="w-12 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all mb-1"
                    title="사이드바 펼치기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <path d="m14 9 3 3-3 3" />
                    </svg>
                    <span className="text-[6px] font-bold">펼치기</span>
                  </button>
                  {/* 날짜 */}
                  <div
                    onClick={() => setMemoInventoryOpen(true)}
                    className="w-12 h-12 rounded-xl bg-[#569cd6]/[0.08] border border-[#569cd6]/15 flex flex-col items-center justify-center hover:border-[#569cd6]/40 transition"
                    style={{ cursor: 'pointer' }}
                    title={`${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${dayNames[now.getDay()]}요일\n클릭하여 학습메모 보기`}
                  >
                    <span className="text-[15px] font-black text-white leading-none">{now.getDate()}</span>
                    <span className="text-[8px] font-bold text-[#569cd6]">{dayNames[now.getDay()]}</span>
                  </div>
                  {/* 레벨 */}
                  <div className="w-12 h-12 rounded-xl bg-[#4ec9b0]/[0.08] border border-[#4ec9b0]/25 flex flex-col items-center justify-center cursor-pointer hover:border-[#4ec9b0]/50 transition" title={`Lv.${lv}`}>
                    <span className="text-[15px] font-black leading-none text-[#4ec9b0]">{lv}</span>
                    <span className="text-[8px] font-bold text-gray-500">레벨</span>
                  </div>
                  {/* 오늘 XP */}
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/[0.06] border border-[#f59e0b]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#f59e0b]/40 transition" title={`오늘 ${dailyXP.total}/${DAILY_XP_CAP} XP`}>
                    <span className="text-[13px] font-black text-[#f59e0b] leading-none">{dailyXP.total}</span>
                    <span className="text-[8px] font-bold text-gray-500">XP</span>
                  </div>
                  {/* 연속 출석 */}
                  <div className="w-12 h-12 rounded-xl bg-[#c586c0]/[0.06] border border-[#c586c0]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#c586c0]/40 transition" title={`연속 출석 ${streak}일`}>
                    <span className="text-[15px] font-black text-[#c586c0] leading-none">{streak}</span>
                    <span className="text-[8px] font-bold text-gray-500">출석</span>
                  </div>
                  {/* 학습 파일 */}
                  <div className="w-12 h-12 rounded-xl bg-[#dcdcaa]/[0.06] border border-[#dcdcaa]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#dcdcaa]/40 transition" title={`학습 파일 ${visitedFiles.length}개`}>
                    <span className="text-[15px] font-black text-[#dcdcaa] leading-none">{visitedFiles.length}</span>
                    <span className="text-[8px] font-bold text-gray-500">파일</span>
                  </div>
                  {/* 얼리기 */}
                  <div className="w-12 h-12 rounded-xl bg-[#569cd6]/[0.06] border border-[#569cd6]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#569cd6]/40 transition" title={`얼리기 ${freezeCount}개`}>
                    <span className="text-[15px] font-black text-[#569cd6] leading-none">{freezeCount}</span>
                    <span className="text-[8px] font-bold text-gray-500">얼리기</span>
                  </div>
                  {/* 원두 */}
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/[0.06] border border-[#f59e0b]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#f59e0b]/40 transition" title={`원두 ${beanCount}개`}>
                    <span className="text-[15px] font-black text-[#f59e0b] leading-none">{beanCount}</span>
                    <span className="text-[8px] font-bold text-gray-500">원두</span>
                  </div>
                  {/* D-day */}
                  <div className="w-12 h-12 rounded-xl bg-[#ce9178]/[0.06] border border-[#ce9178]/15 flex flex-col items-center justify-center cursor-pointer hover:border-[#ce9178]/40 transition" title={`수료까지 D-${daysLeft}`}>
                    <span className="text-[11px] font-black text-[#ce9178] leading-none">D-{daysLeft}</span>
                    <span className="text-[8px] font-bold text-gray-500">수료</span>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* ─── 홈 / 레벨업: 풀 스테이터스 (듀오링고 스타일) ─── */
          <div className="flex-1 overflow-hidden flex flex-col px-2.5 py-2" style={{ overflowX: 'visible' }}>
            {(() => {
              const now = new Date();
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const month = now.getMonth() + 1;
              const date = now.getDate();
              const dayName = dayNames[now.getDay()];
              const courseEnd = new Date('2025-09-30');
              const daysLeft = Math.max(0, Math.ceil((courseEnd - now) / 86400000));

              const totalXP = userData?.totalXP || 0;
              const level = calcLevel(totalXP);
              const currentLevelXP = LEVEL_TABLE.find(r => r.level === level)?.xp || 0;
              const nextLevelXP = LEVEL_TABLE.find(r => r.level === level + 1)?.xp || currentLevelXP;
              const xpInLevel = totalXP - currentLevelXP;
              const xpForNext = nextLevelXP - currentLevelXP;
              const xpPercent = Math.min((xpInLevel / xpForNext) * 100, 100);

              // 티어 계산

              // 보상 현황
              const rewards = getRewardStatus(totalXP);

              return (
                <>

                  {/* 프로필 + 레벨 — 최상단 */}
                  <div className="relative p-3 rounded-xl mb-2" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(139,92,246,0.06) 100%)', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.1)' }}>
                    {/* ── 배지 트레이 ──────────────────────────────────────────
                         순서: 치팅(0) > 타자(1) > 성실(2)
                         각 배지는 독립 absolute. 위치는 자기 위에 있는 배지 수로 계산.
                         BADGE_STEP: 배지 1칸 높이(22px) + gap(6px) = 28px                 */}
                    {(() => {
                      const STEP = 20;
                      const BASE = 8;
                      const hasCheating = !!userData?.badges?.cheatBadge;
                      const hasTyping   = !!(userData?.typingStats?.bestCpm);
                      const hasStreak   = (userData?.streak ?? 0) >= 7;
                      // 각 배지 위치 = BASE + (자기 위에 있는 배지 수 × STEP)
                      const cheatTopPx  = BASE;
                      const typingTopPx = BASE + (hasCheating ? STEP : 0);
                      const streakTopPx = BASE + (hasCheating ? STEP : 0) + (hasTyping ? STEP : 0);
                      return (
                        <>
                          {/* 🤫 치팅 배지 */}
                          {hasCheating && (
                            <div
                              className="absolute right-2 scale-[0.77] origin-top-right"
                              style={{ top: cheatTopPx }}
                              onMouseEnter={e => { if (isMobile) return; const r = e.currentTarget.getBoundingClientRect(); setCheatHover({ top: r.top, left: r.right }); }}
                              onMouseLeave={() => { if (isMobile) return; setCheatHover(null); }}
                              onClick={isMobile ? e => { if (cheatHover) { setCheatHover(null); } else { const r = e.currentTarget.getBoundingClientRect(); setCheatHover({ top: r.top, left: r.right }); } } : undefined}
                            >
                              <div
                                className="flex items-center gap-0.5 px-1 h-[22px] rounded cursor-default select-none"
                                style={{
                                  background: `linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.06) 100%)`,
                                  border: `1px solid rgba(148,163,184,0.6)`,
                                  boxShadow: `0 0 8px rgba(148,163,184,0.3)`,
                                }}
                              >
                                <span className="text-[11px] leading-none">🤫</span>
                                <span className="text-[11px] font-black tracking-[-0.02em] leading-none" style={{ color: `rgba(148,163,184,1)` }}>개발자정신</span>
                              </div>
                            </div>
                          )}
                          {/* ⌨️ 타자 배지 */}
                          <div className="absolute right-2 scale-[0.77] origin-top-right" style={{ top: typingTopPx }}>
                            <TypingBadge typingStats={userData?.typingStats} />
                          </div>
                          {/* 🔥 성실 배지 */}
                          {hasStreak && (
                            <div
                              className="absolute right-2 scale-[0.77] origin-top-right group"
                              style={{ top: streakTopPx }}
                              onClick={isMobile ? (e) => { e.stopPropagation(); setShowStreakTip(v => !v); } : undefined}
                            >
                              <div
                                className="flex items-center gap-0.5 px-1.5 h-[22px] rounded cursor-default select-none"
                                style={{
                                  background: `linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.06) 100%)`,
                                  border: `1px solid rgba(251,191,36,0.6)`,
                                  boxShadow: `0 0 8px rgba(251,191,36,0.3)`,
                                }}
                              >
                                <span className="text-[11px] leading-none">🔥</span>
                                <div className="flex items-baseline gap-[2px] leading-none">
                                  <span className="text-[11px] font-black tabular-nums" style={{ color: `rgba(251,191,36,1)` }}>{userData?.streak}</span>
                                  <span className="text-[9px] font-black" style={{ color: `rgba(251,191,36,0.85)` }}>일</span>
                                </div>
                              </div>
                              <div className={`pointer-events-none absolute top-full right-0 mt-1.5 transition-opacity duration-150 z-50 ${showStreakTip ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}>
                                <div className="bg-[#1a1f2e] rounded-xl px-4 py-3 shadow-2xl shadow-black/40 w-[210px]" style={{ border: '1px solid rgba(251,191,36,0.35)' }}>
                                  <div className="text-[12px] font-black mb-2" style={{ color: `rgba(251,191,36,1)` }}>🔥 연속 출석 배지</div>
                                  <div className="flex items-baseline gap-1.5 mb-3">
                                    <span className="text-[10px] font-bold tracking-wider" style={{ color: `rgba(251,191,36,0.6)` }}>연속 출석 :</span>
                                    <span className="text-[18px] font-black tabular-nums" style={{ color: `rgba(251,191,36,1)` }}>{userData?.streak}</span>
                                    <span className="text-[12px] font-bold" style={{ color: `rgba(251,191,36,0.7)` }}>일</span>
                                  </div>
                                  <div className="text-[11px] leading-relaxed" style={{ color: 'rgba(209,213,219,1)' }}>
                                    <span style={{ color: '#facc15' }}>하루도 빠짐없이</span> 접속한<br />진짜 공부 괴물에게 주는 배지.
                                  </div>
                                  <div className="text-[10px] leading-relaxed mt-1.5" style={{ color: 'rgba(107,114,128,1)' }}>
                                    (7일 이상 공부 루틴을 지키면 획득)
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(139,92,246,0.2))', border: '2px solid rgba(167,139,250,0.6)', boxShadow: '0 0 16px rgba(139,92,246,0.5)' }}>
                        <span className="text-[8px] font-bold leading-none" style={{ color: 'rgba(216,180,254,0.7)' }}>LV</span>
                        <span className="text-lg font-black leading-none" style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(216,180,254,0.8)' }}>{level}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[22px] font-black text-white truncate leading-tight">{userData?.displayName || user?.displayName || '학생'}</div>
                      </div>
                    </div>
                    <div className="text-[10px] mb-1.5 flex justify-between px-0.5" style={{ color: 'rgba(216,180,254,0.5)' }}>
                      <span>{xpInLevel} XP</span>
                      <span>다음 레벨까지 {xpForNext - xpInLevel} XP</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', boxShadow: '0 0 10px rgba(139,92,246,0.7)' }} />
                    </div>
                  </div>

                  {/* 스탯 그리드 (날짜 + 얼리기) */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div className="text-center p-2 rounded-xl border border-[#4ec9b0]/20 transition-colors" style={{ background: 'linear-gradient(135deg, rgba(78,201,176,0.18), rgba(78,201,176,0.06))' }}>
                      <div className="text-[8px] font-bold text-gray-500 tracking-widest mb-0.5">{now.getFullYear()}.{String(month).padStart(2,'0')}</div>
                      <div className="text-lg font-black text-white leading-none">{date}</div>
                      <div className="text-[8px] font-bold mt-0.5" style={{ color: now.getDay() === 0 ? 'rgba(248,113,113,0.9)' : now.getDay() === 6 ? 'rgba(96,165,250,0.9)' : 'rgba(255,255,255,0.5)' }}>{dayName}요일</div>
                    </div>
                    {/* 얼리기 — fixed 툴팁 트리거 */}
                    <div
                      className="cursor-default"
                      onMouseEnter={e => {
                        if (isMobile) return;
                        const r = e.currentTarget.getBoundingClientRect();
                        setFreezeHover({ top: r.top, left: r.right, streak });
                      }}
                      onMouseLeave={() => { if (isMobile) return; setFreezeHover(null); }}
                      onClick={isMobile ? e => { if (freezeHover) { setFreezeHover(null); } else { const r = e.currentTarget.getBoundingClientRect(); setFreezeHover({ top: r.top, left: r.right, streak }); } } : undefined}
                    >
                      <div className="text-center p-2 rounded-xl h-full flex flex-col items-center justify-center transition-colors" style={{ background: 'rgba(147,197,253,0.08)', border: '1px solid rgba(147,197,253,0.35)' }}>
                        <div className="text-lg font-black" style={{ color: '#93c5fd' }}>{freezeCount}</div>
                        <div className="text-[8px] font-semibold text-gray-400 mt-0.5">얼리기 🧊</div>
                      </div>
                    </div>
                  </div>

                  {/* 연속 출석 — 한달 달력 */}
                  {(() => {
                    const dayLabels = ['일','월','화','수','목','금','토'];
                    const year = now.getFullYear();
                    const mon = now.getMonth();
                    const todayDate = now.getDate();
                    const firstDow = new Date(year, mon, 1).getDay(); // 1일의 요일
                    const daysInMonth = new Date(year, mon + 1, 0).getDate();

                    // Firestore userData의 실제 출석 날짜 사용
                    const yearStr = String(year);
                    const monStr = String(mon + 1).padStart(2, '0');
                    const attendedDates = new Set(
                      (userData?.attendedDates || [])
                        .filter(s => s.startsWith(`${yearStr}-${monStr}-`))
                        .map(s => parseInt(s.slice(8), 10))
                    );

                    // 출석 OR 얼음 = "연결" — 오늘 기준 거꾸로 걸어가며 체인 카운트
                    const calcLiveStreak = () => {
                      const attendedSet = new Set(userData?.attendedDates || []);
                      const frozenSet = new Set(userData?.frozenDates || []);
                      if (attendedSet.size === 0 && frozenSet.size === 0) return 0;
                      const todayIso = new Date().toISOString().slice(0, 10);
                      const isCovered = (iso) => attendedSet.has(iso) || frozenSet.has(iso);
                      // 오늘 또는 어제가 커버되어 있어야 연속 인정
                      const yday = new Date();
                      yday.setDate(yday.getDate() - 1);
                      const ydayIso = yday.toISOString().slice(0, 10);
                      if (!isCovered(todayIso) && !isCovered(ydayIso)) return 0;
                      let count = 0;
                      const cursor = new Date(todayIso);
                      // 오늘이 비었으면 어제부터 시작
                      if (!isCovered(todayIso)) cursor.setDate(cursor.getDate() - 1);
                      while (true) {
                        const iso = cursor.toISOString().slice(0, 10);
                        if (!isCovered(iso)) break;
                        count++;
                        cursor.setDate(cursor.getDate() - 1);
                      }
                      return count;
                    };
                    const liveStreak = calcLiveStreak();

                    // 달력 셀 배열 (앞 빈칸 + 날짜 + 뒤 빈칸으로 7의 배수 맞춤)
                    const cells = [];
                    for (let i = 0; i < firstDow; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    const remainder = cells.length % 7;
                    if (remainder > 0) for (let i = 0; i < 7 - remainder; i++) cells.push(null);

                    // 얼리기 사용 날짜 — Firestore userData에서 직접 읽기
                    const frozenDates = new Set(
                      (userData?.frozenDates || [])
                        .filter(s => s.startsWith(`${yearStr}-${monStr}-`))
                        .map(s => parseInt(s.slice(8), 10))
                    );

                    return (
                      <div className="mb-2 p-2 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(245,158,11,0.04) 100%)', border: '1px solid rgba(251,191,36,0.22)' }}>
                        <div className="flex items-center justify-between mb-2 px-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(251,191,36,0.6)' }}>{month}월 출석</span>
                          <div
                            className="relative group cursor-default"
                            onClick={isMobile ? (e) => { e.stopPropagation(); setShowWeekTip(v => !v); } : undefined}
                          >
                            <span
  className="text-[9px] font-bold tracking-wide"
  style={
    liveStreak >= 7
      ? { color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.7)' }
      : { color: 'rgba(251,191,36,0.55)' }
  }
>{liveStreak > 0 ? `${liveStreak}일 연속 🔥` : '시작! 🌱'}</span>
                            {/* 7일 뱃지 안내 팝업 */}
                            <div className={`absolute right-0 bottom-full mb-2 pointer-events-none transition-opacity duration-150 z-50 w-[190px] ${showWeekTip ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}>
                              <div className="rounded-xl px-3.5 py-3 shadow-2xl" style={{ background: '#1a1f2e', border: '1px solid rgba(251,191,36,0.35)' }}>
                                <div className="text-[11px] font-black mb-1.5" style={{ color: '#fbbf24' }}>🔥 연속 출석 배지</div>
                                <p className="text-[9.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>7일 이상</span> 연속 출석하면<br/>배지를 획득할 수 있어요!
                                </p>
                                {liveStreak < 7 && (
                                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(251,191,36,0.15)' }}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[8.5px]" style={{ color: 'rgba(255,255,255,0.7)' }}>배지까지</span>
                                      <span className="text-[9px] font-black" style={{ color: '#fbbf24' }}>{liveStreak} / 7일</span>
                                    </div>
                                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                      <div className="h-full rounded-full" style={{ width: `${(liveStreak / 7) * 100}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)', boxShadow: '0 0 6px rgba(251,191,36,0.6)' }} />
                                    </div>
                                  </div>
                                )}
                                {liveStreak >= 7 && (
                                  <p className="mt-1.5 text-[8.5px] font-bold" style={{ color: 'rgba(251,191,36,0.7)' }}>✓ 배지 획득 완료!</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 mb-1">
                          {dayLabels.map((d, idx) => (
                            <div key={d} className="text-center text-[6px] font-bold" style={{ color: idx === 0 ? 'rgba(248,113,113,0.8)' : idx === 6 ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.35)' }}>{d}</div>
                          ))}
                        </div>
                        {/* 날짜 셀 */}
                        <div className="grid grid-cols-7">
                          {cells.map((d, i) => {
                            if (!d) return (
                              <div key={i} className="aspect-square rounded" style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }} />
                            );
                            const isToday = d === todayDate;
                            const attended = attendedDates.has(d);
                            const isFuture = d > todayDate;
                            const col = i % 7;
                            const isWeekend = col === 0 || col === 6; // 일=0, 토=6
                            const isFrozen = frozenDates.has(d) && !attended;
                            // 지나간 결석일 + 얼리기 보유 시 클릭해서 얼릴 수 있음
                            const canFreeze = !attended && !isFrozen && !isFuture && !isToday && freezeCount > 0;
                            const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2,'0')}`;
                            if (isFrozen) return (
                              <div key={i} className="aspect-square relative flex items-center justify-center rounded"
                                style={{
                                  background: 'linear-gradient(145deg, rgba(147,210,255,0.4) 0%, rgba(86,156,214,0.25) 100%)',
                                  border: '1px solid rgba(147,210,255,0.7)',
                                  boxShadow: '0 0 10px rgba(86,156,214,0.5), inset 0 0 8px rgba(147,210,255,0.2)',
                                }}>
                                {/* 얼음 광택 — 대각선 하이라이트 */}
                                <div className="absolute inset-0 pointer-events-none rounded"
                                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
                                {/* 숫자 — 얼음 속에 갇힌 느낌 */}
                                <span className="relative text-[7px] font-black"
                                  style={{ color: '#fff', textShadow: '0 0 5px rgba(147,210,255,0.9), 0 0 12px rgba(86,156,214,0.5)' }}>{d}</span>
                                {/* 🧊 코너 뱃지 — 살짝 위로/옆으로 넛지 */}
                                <span className="absolute -top-[3px] -right-[3px] text-[9px] leading-none">🧊</span>
                              </div>
                            );

                            return (
                              <div key={i}
                                onClick={canFreeze ? () => setFreezeConfirm({ dateStr, day: d }) : undefined}
                                className={`aspect-square relative flex items-center justify-center rounded text-[7px] font-black transition-all ${canFreeze ? 'cursor-pointer hover:scale-110 hover:!border-[rgba(147,210,255,0.7)] hover:!text-[rgba(147,210,255,0.9)] hover:!bg-[rgba(86,156,214,0.12)]' : ''}`}
                                style={
                                  isToday ? {
                                    background: 'linear-gradient(135deg, rgba(34,197,94,0.5), rgba(16,185,129,0.32))',
                                    color: '#4ade80',
                                    boxShadow: '0 0 10px rgba(34,197,94,0.55), inset 0 0 4px rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.75)',
                                  } : attended ? {
                                    background: isWeekend
                                      ? 'linear-gradient(135deg, rgba(167,139,250,0.28), rgba(196,134,192,0.15))'
                                      : 'linear-gradient(135deg, rgba(251,191,36,0.28), rgba(253,224,71,0.15))',
                                    color: isWeekend ? '#d8b4fe' : '#fde047',
                                    boxShadow: isWeekend ? '0 0 6px rgba(167,139,250,0.35)' : '0 0 6px rgba(251,191,36,0.35)',
                                    border: isWeekend ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(251,191,36,0.35)',
                                  } : isFuture ? {
                                    color: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    background: 'transparent',
                                  } : canFreeze ? {
                                    color: 'rgba(147,210,255,0.55)',
                                    border: '1px dashed rgba(147,210,255,0.3)',
                                    background: 'rgba(86,156,214,0.04)',
                                  } : {
                                    color: 'rgba(255,255,255,0.18)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    background: 'transparent',
                                  }
                                }>
                                {(attended || isToday) ? (
                                  <>
                                    {d}
                                    <span className="absolute top-0 right-[1px] text-[9px] font-black leading-none" style={{ color: '#f87171' }}>✔</span>
                                  </>
                                ) : d}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 오늘의 XP 게이지 */}
                  <div className="p-2 rounded-xl bg-[#f59e0b]/[0.04] border border-[#f59e0b]/10 mb-2">
                    <div className="flex justify-between text-[10px] mb-1 px-0.5">
                      <span className="font-bold" style={{ color: '#f59e0b' }}>오늘의 XP</span>
                      <span className="text-gray-500">{dailyXP.total} / {DAILY_XP_CAP}</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] rounded-full transition-all duration-500" style={{ width: `${Math.min((dailyXP.total / DAILY_XP_CAP) * 100, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] mt-1 px-0.5">
                      <span style={dailyXP.login > 0 ? { color: '#4ade80', textShadow: '0 0 6px rgba(74,222,128,0.7)', fontWeight: 700 } : { color: 'rgba(107,114,128,0.6)' }}>
                        접속 {dailyXP.login > 0 ? '✓' : '-'}
                      </span>
                      <span className="text-gray-600">퀘스트 {dailyXP.quest}/{200}</span>
                      <span className="text-gray-600">문제 {dailyXP.levelup}/{250}</span>
                    </div>
                  </div>

                  {/* 아메리카노 + 원두 */}
                  {(() => {
                    const americanoCount = userData?.americanoCount || 0;
                    const canExchange = beanCount >= 5;
                    const handleExchange = async () => {
                      if (!canExchange) return;
                      await updateUserState(user.uid, { beanCount: 0, americanoCount: americanoCount + 1 });
                      setAmericanoPopup(true);
                    };
                    return (
                      <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="flex items-center gap-1">
                          {/* 아메리카노 (왼쪽) */}
                          <div
                            className="flex-1 flex flex-col items-center gap-0.5 py-1 cursor-default"
                            onMouseEnter={e => { if (isMobile) return; const r = e.currentTarget.getBoundingClientRect(); setAmericanoHover({ top: r.top, left: r.left }); }}
                            onMouseLeave={() => { if (isMobile) return; setAmericanoHover(null); }}
                            onClick={isMobile ? e => { if (americanoHover) { setAmericanoHover(null); } else { const r = e.currentTarget.getBoundingClientRect(); setAmericanoHover({ top: r.top, left: r.left }); } } : undefined}
                          >
                            <span className="text-base leading-none">☕</span>
                            <span className="text-sm font-black leading-none" style={{ color: '#d97706' }}>{americanoCount}</span>
                            <span className="text-[8px] font-semibold text-gray-500">아메리카노</span>
                          </div>
                          {/* 교환 버튼 */}
                          <button
                            onClick={handleExchange}
                            disabled={!canExchange}
                            title={canExchange ? '원두 5개 → 아메리카노 1잔' : `원두 ${5 - beanCount}개 더 필요`}
                            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all"
                            style={canExchange ? {
                              background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.12))',
                              border: '1px solid rgba(245,158,11,0.5)',
                              boxShadow: '0 0 10px rgba(245,158,11,0.25)',
                              cursor: 'pointer',
                            } : {
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              cursor: 'not-allowed',
                            }}
                          >
                            <span className="text-[10px] leading-none" style={{ color: canExchange ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>←</span>
                            <span className="text-[7px] font-black leading-none" style={{ color: canExchange ? '#f59e0b' : 'rgba(255,255,255,0.12)' }}>교환</span>
                          </button>
                          {/* 원두 (오른쪽) */}
                          <div
                            className="flex-1 flex flex-col items-center gap-0.5 py-1 cursor-default rounded-lg transition-all"
                            onMouseEnter={e => { if (isMobile) return; const r = e.currentTarget.getBoundingClientRect(); setBeanHover({ top: r.top, left: r.right + 8 }); }}
                            onMouseLeave={() => { if (isMobile) return; setBeanHover(null); }}
                            onClick={isMobile ? e => { if (beanHover) { setBeanHover(null); } else { const r = e.currentTarget.getBoundingClientRect(); setBeanHover({ top: r.top, left: r.right + 8 }); } } : undefined}
                            style={{}}
                          >
                            <span className="text-base leading-none" style={canExchange ? { filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9)) drop-shadow(0 0 16px rgba(245,158,11,0.5))' } : {}}>🫘</span>
                            <span className="text-sm font-black leading-none" style={{ color: canExchange ? '#fbbf24' : '#f59e0b', textShadow: canExchange ? '0 0 8px rgba(251,191,36,0.8)' : 'none' }}>{beanCount}</span>
                            <span className="text-[8px] font-semibold" style={{ color: canExchange ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.3)' }}>원두</span>
                          </div>
                        </div>
                        {/* 하단 바 */}
                        {americanoCount > 0 && (
                          <div className="flex gap-0.5 mt-1.5 justify-center">
                            {[...Array(Math.min(americanoCount, 10))].map((_, i) => (
                              <div key={i} className="h-0.5 flex-1 rounded-full bg-[#d97706]/70" style={{ boxShadow: '0 0 3px rgba(217,119,6,0.5)' }} />
                            ))}
                          </div>
                        )}
                        {beanCount > 0 && americanoCount === 0 && (
                          <div className="flex gap-0.5 mt-1.5 justify-center">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className={`h-0.5 flex-1 rounded-full ${i < beanCount ? 'bg-[#f59e0b]/70' : 'bg-white/[0.06]'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </>
              );
            })()}
          </div>
        )}

        {/* 하단 프로필 */}
        <div className={`relative ${sidebarMini ? 'p-1' : 'p-2'} border-t border-white/[0.06]`}>
          {/* 팝업 메뉴 */}
          {isMenuOpen && !sidebarMini && (
            <div className="absolute bottom-full left-0 mb-2 w-full rounded-2xl z-50 overflow-hidden"
              style={{ background: '#141414', border: '1px solid rgba(78,201,176,0.15)', boxShadow: '0 -4px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}>
              {/* 유저 헤더 */}
              <div className="px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, rgba(78,201,176,0.08) 0%, rgba(86,156,214,0.05) 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #4ec9b0 0%, #569cd6 100%)', boxShadow: '0 0 10px rgba(78,201,176,0.3)' }}>
                  {(userData?.displayName || user?.displayName || 'U')[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-bold text-white truncate leading-tight">
                    {userData?.displayName || user?.displayName}
                  </span>
                  <span className="text-[10px] text-white/30 truncate leading-tight mt-0.5">{user?.email}</span>
                </div>
              </div>

              <div className="p-1.5 flex flex-col gap-0.5">
                {userData?.role === 'admin' && (
                  <button
                    onClick={() => { setIsMenuOpen(false); navigate('/admin'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0 text-[#4ec9b0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    관리자 페이지
                  </button>
                )}

                <div className="h-px mx-1 my-0.5" style={{ background: 'rgba(255,255,255,0.05)' }} />

                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-white/40 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </button>
              </div>
            </div>
          )}

          {/* 프로필 버튼 */}
          <button
            onClick={() => sidebarMini ? setSidebarMini(false) : setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center ${sidebarMini ? 'justify-center' : 'gap-2.5'} w-full px-2 py-2 rounded-xl transition-all hover:bg-white/[0.05]`}
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(78,201,176,0.2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg, #4ec9b0 0%, #569cd6 100%)', boxShadow: '0 0 8px rgba(78,201,176,0.35)' }}>
              {(userData?.displayName || user?.displayName || 'U')[0].toUpperCase()}
            </div>
            {!sidebarMini && (
              <>
                <span className="text-[13px] font-semibold text-white/80 truncate flex-1 text-left">
                  {userData?.displayName || user?.displayName}
                </span>
                <svg className="w-3 h-3 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* 📱 모바일 상단바 — 햄버거 + 타이틀 + 관리자/로그아웃 */}
      <MobileTopBar
        leading="menu"
        onLeadingClick={() => setMobileDrawerOpen(true)}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="p-1 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-md border border-white/10 ring-1 ring-theme-primary/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#mob-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="mob-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ec9b0" />
                    <stop offset="100%" stopColor="#569cd6" />
                  </linearGradient>
                </defs>
                <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
              </svg>
            </span>
            Lucid
          </span>
        }
        right={
          <button
            onClick={onLogout}
            className="touch-target px-2 text-theme-secondary text-xs font-semibold active:text-white"
          >
            로그아웃
          </button>
        }
      />

      {/* 📱 모바일 좌측 드로어 — 간단 메뉴 (프로필/모드/관리자/로그아웃) */}
      <SidebarDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        header={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(139,92,246,0.2))', border: '1px solid rgba(167,139,250,0.5)' }}>
              <span className="text-[11px] font-black" style={{ color: '#d8b4fe' }}>Lv{calcLevel(userData?.totalXP || 0)}</span>
            </div>
            <span className="truncate">{userData?.displayName || user?.displayName || '학생'}</span>
          </div>
        }
      >
        <nav className="flex flex-col p-3 gap-1.5">
          {[
            { label: '🏠 홈', onClick: () => { setMode(null); navigate('/home'); } },
            { label: '📚 챕터별 학습', onClick: () => { setMode('chapter'); navigate('/chapter'); } },
            { label: '⚔️ 오늘의 퀘스트', onClick: () => { setMode('quest'); navigate('/home/quest'); } },
            { label: '🎯 레벨업', onClick: () => { setMode('levelup'); navigate('/home/levelup'); } },
            { label: '📓 마스터노트', onClick: () => { setMode('freeStudy'); navigate('/study'); } },
            { label: '🗒️ 학습메모', onClick: () => { setMemoInventoryOpen(true); } },
          ].map((it) => (
            <button
              key={it.label}
              onClick={() => { setMobileDrawerOpen(false); it.onClick(); }}
              className="touch-target text-left px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.1] border border-white/[0.06] text-[14px] font-semibold text-white/90 transition-colors"
            >
              {it.label}
            </button>
          ))}
          {/* 스테이터스 요약 */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-[#f59e0b]/[0.08] border border-[#f59e0b]/25 text-center">
              <div className="text-[11px] font-black text-[#f59e0b]">{dailyXP.total}</div>
              <div className="text-[9px] text-gray-500 font-bold mt-0.5">오늘 XP</div>
            </div>
            <div className="p-2 rounded-lg bg-[#c586c0]/[0.08] border border-[#c586c0]/25 text-center">
              <div className="text-[11px] font-black text-[#c586c0]">{streak}</div>
              <div className="text-[9px] text-gray-500 font-bold mt-0.5">연속</div>
            </div>
            <div className="p-2 rounded-lg bg-[#569cd6]/[0.08] border border-[#569cd6]/25 text-center">
              <div className="text-[11px] font-black text-[#569cd6]">{freezeCount}</div>
              <div className="text-[9px] text-gray-500 font-bold mt-0.5">얼리기🧊</div>
            </div>
          </div>
          <button
            onClick={() => { setMobileDrawerOpen(false); navigate('/admin'); }}
            className="touch-target mt-3 text-left px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.1] border border-white/[0.06] text-[13px] font-semibold text-white/70"
          >
            ⚙️ 설정
          </button>
          <button
            onClick={onLogout}
            className="touch-target text-left px-4 py-3 rounded-xl bg-red-500/[0.08] hover:bg-red-500/[0.15] active:bg-red-500/[0.2] border border-red-500/20 text-[13px] font-semibold text-red-300"
          >
            🚪 로그아웃
          </button>
        </nav>
      </SidebarDrawer>

      {/* 📱 모바일 하단 탭 — 홈/챕터/복습/프로필 */}
      <MobileBottomTab
        items={[
          {
            key: 'home',
            label: '홈',
            active: !mode,
            onClick: () => { setMode(null); navigate('/home'); },
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ),
          },
          {
            key: 'chapter',
            label: '챕터',
            active: mode === 'chapter',
            onClick: () => { setMode('chapter'); navigate('/chapter'); },
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ),
          },
          {
            key: 'quest',
            label: '퀘스트',
            active: mode === 'quest',
            onClick: () => { setMode('quest'); navigate('/home/quest'); },
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5 4.5 15"/><path d="m12 12 4 10 1-6 6-1z"/><path d="M9 12c2 0 3-2 3-3s-1-3-3-3-3 2-3 3 1 3 3 3Z"/></svg>
            ),
          },
          {
            key: 'study',
            label: '마스터노트',
            active: mode === 'freeStudy',
            onClick: () => { setMode('freeStudy'); navigate('/study'); },
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            ),
          },
          {
            key: 'menu',
            label: '메뉴',
            active: false,
            onClick: () => setMobileDrawerOpen(true),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            ),
          },
        ]}
      />

      {/* 메인 콘텐츠 — 모바일: 상단바(48)+하단탭(56) 여백 확보, 데스크탑: 기존 유지 */}
      <main
        className="flex-1 overflow-y-auto md:overflow-hidden flex justify-center bg-theme-bg pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+56px)] px-3 md:px-2 md:pt-2 md:pb-2"
      >
        <div className="w-full max-w-[100%] md:max-w-[95%] xl:max-w-[1400px] h-full flex flex-col md:justify-center pb-2">

          {!userData ? null : groupIDs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in-up mt-8 md:mt-0">
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

          ) : mode === 'quest' ? (
            // ─── 오늘의 퀘스트 ────────────────────────────────────
            <QuestView
              teacher={teacher}
              repo={repo}
              chapters={chapters}
              chapterFilesMap={chapterFilesMap}
              chaptersLoading={chaptersLoading}
              visitedFiles={visitedFiles}
              userData={userData}
              onBack={(completed) => {
                setMode(null); setStep(0);
                // beanCount / streak은 userData onSnapshot으로 자동 반영됨
                if (completed) setQuestDoneModal(completed);
              }}
              onFileSelect={(file, ch) => { handleFileSelect(file, ch); setMode('chapter'); }}
            />

          ) : mode === 'freeStudy' ? (
            // ─── 복습 & 예습 ──────────────────────────────────────
            (() => {
              // teacher가 없으면 classData에서 첫 번째 강사 사용
              const effectiveTeacher = teacher || classData.find(c => c.teacher?.githubUsername)?.teacher || null;
              // 담당강사 레포 필터용: 해당 강사의 등록된 레포명만 추출 (기수 매칭 완료된 것들)
              const enrolledRepoNames = classData
                .filter(c => c.teacher?.githubUsername === effectiveTeacher?.githubUsername)
                .flatMap(c => c.repos.map(r => r.name));
              return (
            <FreeStudyView
              onBack={() => {
              if (freeStudySource === 'chapter') {
                setFreeStudyCode(null);
                setFreeStudySource(null);
                reset();
                setChapterModal(true); // 마지막 선택 파일 유지한 채 모달 재오픈
              } else {
                setMode(null);
                navigate('/home');
              }
            }}
              showLanding={true}
              teacher={effectiveTeacher}
              enrolledRepoNames={enrolledRepoNames}
              externalCode={freeStudyCode}
              fromChapter={freeStudySource === 'chapter'}
              onGoToChapter={async ({ githubUsername, repo: r }) => {
                const teacherObj = effectiveTeacher?.githubUsername === githubUsername
                  ? effectiveTeacher
                  : { githubUsername, name: githubUsername };
                await handleRepoSelect(teacherObj, r);
                setChapterModal(true);
              }}
            />
              );
            })()

          ) : mode === 'levelup' ? (
            // ─── 레벨업 문제지옥 ─────────────────────────────────
            <LevelUpView
              userData={userData}
              onBack={() => setMode(null)}
            />

          ) : mode === 'diagnosis' ? (
            // ─── 전체 레벨 진단 ──────────────────────────────────
            <DiagnosisView
              teacher={teacher}
              repo={repo}
              chapters={chapters}
              chapterFilesMap={chapterFilesMap}
              onBack={() => setMode(null)}
            />

          ) : mode === 'placement' ? (
            // ─── 배치고사 ────────────────────────────────────────
            <PlacementView
              teacher={teacher}
              repo={repo}
              chapters={chapters}
              chapterFilesMap={chapterFilesMap}
              onBack={() => setMode(null)}
              onPlaced={({ score, placement }) => {
                // 만점: 그냥 홈으로 (파일 선택은 사용자가 직접)
                // 자동 배치: 해당 인덱스 파일 바로 열기
                if (placement.type === 'auto' && placement.idx !== null) {
                  const flat = Object.values(chapterFilesMap || {}).flat();
                  const target = flat[placement.idx];
                  if (target) {
                    // 챕터 찾기
                    const chEntry = Object.entries(chapterFilesMap || {}).find(([, files]) =>
                      files?.some(f => f.path === target.path)
                    );
                    const ch = chapters?.find(c => c.name === chEntry?.[0]);
                    if (ch) handleFileSelect(target, ch);
                  }
                }
                setMode(null);
              }}
            />

          ) : mode === 'chapter' ? (
            // ─── 챕터별 학습 ─────────────────────────────────────
            step >= 3 ? (
              <ResultView result={result} onReset={() => { resetSession(); setStep(1); setConcept(null); }} userData={userData} />
            ) : step === 2 ? (
              <ChatView
                teacher={teacher}
                repo={repo}
                concept={concept}
                onComplete={(r) => { setResult(r); setStep(3); }}
                onBack={() => setStep(1)}
              />
            ) : (
              // ─── 챕터 사이드바 + 메인 (옛날 디자인 복원) ────────
              <div className="w-full h-full flex flex-col md:flex-row overflow-hidden animate-fade-in-up">
                {/* 왼쪽 사이드바 — 모바일에선 상단 풀폭, 데스크탑에선 좌측 고정 */}
                <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col max-h-[50vh] md:max-h-none" style={{ background: '#0d1117' }}>
                  {/* 상단 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                    <button onClick={() => { setMode(null); reset(); }}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white text-[11px] font-bold transition">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                      홈
                    </button>
                    {repo && (
                      <button onClick={() => reset()}
                        className="text-[10px] text-gray-600 hover:text-gray-400 transition">
                        레포 변경
                      </button>
                    )}
                  </div>

                  {/* 사이드바 콘텐츠 */}
                  <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {!repo ? (
                      // ─── 레포 목록 ───────────────────────────────
                      classLoading ? (
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
                            {repos.map(r => {
                              const repoKey = `${id}-${r.name}`;
                              return (
                                <button key={r.name}
                                  onClick={() => { setSelectedRepoKey(repoKey); setVisitedRepoKeys(prev => new Set(prev).add(repoKey)); handleRepoSelect(t, r); }}
                                  className="w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2.5 group mb-1.5 bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-[#4ec9b0]/25 hover:text-white hover:shadow-[0_0_10px_rgba(78,201,176,0.1)]">
                                  <div className="shrink-0 p-1.5 rounded-lg bg-white/5 group-hover:bg-[#4ec9b0]/10 transition-colors">
                                    <svg className="w-3 h-3 text-gray-500 group-hover:text-[#4ec9b0]" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                  </div>
                                  <span className="text-[11px] font-semibold break-words min-w-0">{r.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))
                      )
                    ) : (
                      // ─── 챕터 아코디언 트리 ───────────────────────
                      <>
                        <button onClick={() => reset()}
                          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-[11px] px-2 py-1.5 mb-1 transition">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
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
                                <button onClick={() => handleChapterToggle(ch)}
                                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-all group">
                                  <svg className={`w-2.5 h-2.5 text-gray-600 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5l8 7-8 7V5z"/>
                                  </svg>
                                  <svg className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                                  </svg>
                                  <span className="text-[11px] font-bold shrink-0" style={{ color: '#569cd6' }}>
                                    {ch.name.replace('ch', 'ch.')}
                                  </span>
                                  {ch.labelLoading ? (
                                    <div className="w-2.5 h-2.5 border border-gray-600 border-t-transparent rounded-full animate-spin shrink-0 ml-1"/>
                                  ) : (
                                    ch.label && ch.label !== ch.name && (
                                      <span className="text-[10px] truncate min-w-0 opacity-80 font-medium ml-1.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/5" style={{ color: '#ce9178' }}>
                                        {ch.label}
                                      </span>
                                    )
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className="ml-5 border-l border-white/[0.06] pl-2 mt-0.5 mb-1">
                                    {isLoadingFiles ? (
                                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                                        <div className="w-2.5 h-2.5 border border-gray-600 border-t-transparent rounded-full animate-spin shrink-0"/>
                                        <span className="text-gray-600 text-[10px]">로딩 중...</span>
                                      </div>
                                    ) : files.length === 0 ? (
                                      <p className="text-gray-600 text-[10px] px-2 py-1">파일 없음</p>
                                    ) : (
                                      files.map((file) => (
                                        <button key={file.name}
                                          onClick={() => handleFileSelect(file, ch)}
                                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group mb-0.5 ${concept?.name === file.name ? 'bg-[#4ec9b0]/10' : 'hover:bg-white/[0.04]'}`}>
                                          <svg className="w-3 h-3 shrink-0 text-gray-600 group-hover:text-[#dcdcaa] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                          </svg>
                                          <span className="text-[11px] truncate" style={{ color: concept?.name === file.name ? '#4ec9b0' : '#dcdcaa' }}>
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
                      </>
                    )}
                  </div>
                </aside>

                {/* 오른쪽 메인 — 안내 */}
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="mb-6 p-4 rounded-2xl border border-white/5" style={{ background: 'linear-gradient(135deg, rgba(78,201,176,0.1) 0%, rgba(86,156,214,0.1) 100%)' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#chapter-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <defs>
                        <linearGradient id="chapter-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4ec9b0"/>
                          <stop offset="100%" stopColor="#569cd6"/>
                        </linearGradient>
                      </defs>
                      <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">복습할 파일을 선택해주세요</h2>
                  <p className="text-sm text-gray-500">
                    {!repo ? '왼쪽에서 레포를 선택하면 챕터 목록이 나타납니다.' : '챕터를 펼쳐 파일을 선택하면 AI 학습이 시작됩니다.'}
                  </p>
                </div>
              </div>
            )

          ) : (
            // ─── 홈 (mode === null) 모드 카드 3장 ────────────────
            <div className="flex flex-col items-center justify-center h-full animate-fade-in-up px-4">
              {(() => {
                const name = userData?.displayName || user?.displayName || '학생';
                const level = calcLevel(userData?.totalXP || 0);
                const cheer = streak >= 14 ? `${streak}일 연속 — 넌 이미 다름` :
                              streak >= 7  ? `${streak}일 연속 🔥 상위 5%예요` :
                              streak >= 3  ? `${streak}일 연속 중 — 습관이 만들어지고 있어요` :
                              streak >= 2  ? `어제도 왔었죠? 오늘도 할 수 있어요 !! 화이팅 !!` :
                              visitedFiles.length > 0 ? [
                                '오늘도 화이팅!',
                                '꾸준함이 실력이 됩니다 💪',
                                '오늘 배운 것, 내일의 무기가 돼요',
                                '천천히가도 괜찮아요, 멈추지만 마요',
                                '코드 한 줄씩, 실력이 쌓이고 있어요',
                              ][Math.floor(Date.now() / 3600000) % 5] :
                              '첫 걸음이 제일 어렵습니다. 시작해봐요';
                return (
                  <>
                    <div className={`text-center mb-8 transition-transform duration-300 ${statusPop ? 'scale-[1.06]' : 'scale-100'}`}
                      onTransitionEnd={() => setStatusPop(false)}
                    >
                      <h2 className="text-2xl font-black text-white mb-2">{name}님, 오늘도 한 판 해볼까요?</h2>
                      <p className="text-sm" style={{ color: '#4ec9b0' }}>{cheer}</p>
                    </div>
                  </>
                );
              })()}

              {/* 스트릭 경고 배너 */}
              {streakStatus === 'grace2' && (
                <div className="w-full max-w-2xl mb-4 px-4 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#f59e0b]">내일이 마지막 기회예요</p>
                    <p className="text-[11px] text-gray-400">오늘 퀘스트를 안 하면 {streak}일 연속이 사라져요. 지금 바로 시작하세요!</p>
                  </div>
                </div>
              )}
              {streakStatus === 'broken' && (
                <div className="w-full max-w-2xl mb-4 px-4 py-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center gap-3">
                  <span className="text-xl">💔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#ef4444]">연속 퀘스트가 초기화됐어요</p>
                    <p className="text-[11px] text-gray-400">퀘스트를 3일 연속 완료하면 기존 연속출석을 복구할 수 있어요!</p>
                  </div>
                </div>
              )}
              {streakStatus === 'repair' && (
                <div className="w-full max-w-2xl mb-4 px-4 py-3 rounded-xl bg-[#a855f7]/10 border border-[#a855f7]/30 flex items-center gap-3">
                  <span className="text-xl">🔧</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#a855f7]">연속출석 복구 퀘스트 진행 중</p>
                    <p className="text-[11px] text-gray-400">퀘스트 3연속 완료 시 복구! 현재 <span className="text-[#a855f7] font-bold">{repairCount}/3</span> 완료</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {[0,1,2].map(i => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < repairCount ? 'bg-[#a855f7]' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* 눌러보라는 화살표 힌트 */}
              <div className="flex items-center gap-2 mb-3 -mt-3 pb-[3px] animate-bounce-slow">
                <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[11px] text-gray-300 font-semibold">눌러서 시작해보세요</span>
              </div>

              {/* ── 3카드 섹션 (relative 래퍼) ── */}
              <div className="relative w-full max-w-2xl">

              {/* 퀘스트 개발중 안내 오버레이 */}
              {questDevNotice && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-5 px-9 py-6 rounded-2xl pointer-events-auto"
                    style={{ background: '#0c0c0c', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}>
                    <span className="text-5xl">🛠️</span>
                    <div>
                      <p className="text-[20px] font-black tracking-[0.12em] uppercase" style={{ color: '#f59e0b' }}>퀘스트 조합 개발중</p>
                      <p className="text-[15px] text-gray-500 mt-1">곧 만나요!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 상단 1컬럼: 퀘스트 */}
              <div className="w-full mb-4">
                {/* 오늘의 퀘스트 카드 */}
                <button
                  onClick={() => { setQuestDevNotice(true); setTimeout(() => setQuestDevNotice(false), 2500); }}
                  className="group relative w-full bg-gradient-to-br from-[#f59e0b]/[0.12] to-[#f97316]/[0.06] border border-[#f59e0b]/30 rounded-2xl pt-[39px] pb-6 px-6 text-left shadow-[0_4px_24px_rgba(245,158,11,0.10)] hover:-translate-y-1 hover:border-[#f59e0b]/60 hover:from-[#f59e0b]/[0.20] hover:to-[#f97316]/[0.10] transition-all duration-300 hover:shadow-[0_14px_48px_rgba(245,158,11,0.28)]"
                >
                  <div className="flex items-center gap-4 -mt-[15px]">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f59e0b]/25 to-[#f97316]/15 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-[#f59e0b]/20 shrink-0">
                      <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold mb-0.5" style={{ color: '#f59e0b' }}>오늘의 퀘스트</h3>
                      <p className="text-xs text-gray-400">오늘 배운 코드를 한 바퀴 훑어보세요.</p>
                    </div>
                    <div className="shrink-0 min-w-[140px]">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>오늘의 XP</span>
                        <span>{dailyXP.total} / 500</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] rounded-full transition-all duration-700" style={{ width: `${Math.min((dailyXP.total / 500) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#f59e0b] font-bold shrink-0 ml-2">
                      <span>시작</span>
                      <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {/* 복습 & 예습 카드 */}
                <button
                  onClick={() => { setMode('freeStudy'); navigate('/study'); }}
                  className="group relative bg-gradient-to-br from-[#38bdf8]/[0.10] to-[#818cf8]/[0.04] border border-[#38bdf8]/25 rounded-2xl p-8 text-left shadow-[0_4px_24px_rgba(56,189,248,0.08)] hover:-translate-y-2 hover:border-[#38bdf8]/55 hover:from-[#38bdf8]/[0.18] hover:to-[#818cf8]/[0.08] transition-all duration-300 hover:shadow-[0_14px_48px_rgba(56,189,248,0.22)]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#38bdf8]/25 to-[#818cf8]/15 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(56,189,248,0.12)] ring-1 ring-[#38bdf8]/20">
                    <svg className="w-7 h-7 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#38bdf8' }}>마스터노트</h3>
                  <p className="text-sm text-gray-400 leading-snug">
                    <span className="text-[11px] text-gray-500 leading-tight">코드노트, AI코드생성, 용어번역, 메모,<br/>AI문제출제, GitHub코드불러오기</span><br/>
                    각종툴로 편하게 공부에만 집중하세요.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[#38bdf8] font-bold group-hover:gap-2.5 transition-all duration-200">
                    <span>시작하기</span>
                    <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>

                {/* 레벨업 문제지옥 카드 (보라색) */}
                <button
                  onClick={() => { setMode('levelup'); setStatusPop(true); }}
                  className="group relative bg-gradient-to-br from-[#a855f7]/[0.10] to-[#6366f1]/[0.04] border border-[#a855f7]/25 rounded-2xl p-8 text-left shadow-[0_4px_24px_rgba(168,85,247,0.10)] hover:-translate-y-2 hover:border-[#a855f7]/60 hover:from-[#a855f7]/[0.18] hover:to-[#6366f1]/[0.08] transition-all duration-300 hover:shadow-[0_14px_48px_rgba(168,85,247,0.26)]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#a855f7]/25 to-[#6366f1]/15 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-[#a855f7]/20">
                    <svg className="w-7 h-7 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#a855f7' }}>문제지옥</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">과목별 문제를 풀며 티어를 올립니다.</p>
                  <p className="text-[11px] text-gray-600 mt-2">Java, React, Python, GitHub... 뭐든 OK</p>
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[#a855f7] font-bold group-hover:gap-2.5 transition-all duration-200">
                    <span>도전하기</span>
                    <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>

              </div>

              </div>{/* ── 3카드 섹션 래퍼 끝 ── */}
            </div>

          )}
        </div>
      </main>


      {/* API 키 모달 */}
      {showApiKeyModal && <ApiKeyModal onClose={() => setShowApiKeyModal(false)} />}

      {/* 홈 이동 확인 모달 */}
      {homeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setHomeConfirm(false)}>
          <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-6 w-[340px] shadow-[0_16px_64px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">홈으로 이동</p>
                <p className="text-xs text-gray-500">진행 중인 학습이 초기화됩니다</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">정말 홈으로 돌아가시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setHomeConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                취소
              </button>
              <button onClick={() => { setHomeConfirm(false); setMode(null); reset(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20 transition-all">
                홈으로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 퀘스트 완료 축하 모달 */}
      {questDoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up" onClick={() => setQuestDoneModal(null)}>
          <div className="bg-[#1a1a1a] border border-[#f59e0b]/20 rounded-2xl p-7 w-[360px] shadow-[0_16px_64px_rgba(245,158,11,0.15)] text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-black text-white mb-1">퀘스트 완료!</h3>
            <p className="text-sm text-gray-400 mb-5">오늘의 퀘스트를 마쳤어요. 수고했어요!</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-[#f59e0b]/[0.08] border border-[#f59e0b]/15">
                {questDoneModal.xp > 0
                  ? <p className="text-2xl font-black text-[#f59e0b]">+{questDoneModal.xp}</p>
                  : <p className="text-sm font-bold text-gray-500">퀴즈를 맞춰야<br/>XP를 받아요!</p>
                }
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">XP 획득</p>
              </div>
              <div className="p-3 rounded-xl bg-[#c586c0]/[0.08] border border-[#c586c0]/15">
                <p className="text-2xl font-black text-[#c586c0]">{streak}</p>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">연속 퀘스트일</p>
              </div>
            </div>
            <button
              onClick={() => setQuestDoneModal(null)}
              className="w-full py-3 rounded-xl text-sm font-bold text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/25 hover:bg-[#f59e0b]/20 transition-all"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )}
      {/* 챕터 모달 — FreeStudy에서 GitHub 레포 클릭 시 오버레이 */}
      {chapterModal && (
        <div className="fixed inset-0 z-[9999] flex pointer-events-none">
          {/* 왼쪽 사이드바 영역: 투명·클릭 통과 (데스크탑만) */}
          <div className={`${sidebarMini ? 'w-[68px]' : 'w-64'} shrink-0 hidden md:block`} />

          {/* 메인 콘텐츠 영역: 블러 오버레이 */}
          <div
            className="flex-1 pointer-events-auto flex items-center justify-center px-2 py-2 md:px-4 md:py-4"
            style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(7px)' }}
            onClick={() => { setChapterModal(false); setChapterSelectedFile(null); }}
          >
            {/* 패널 — 모바일은 세로 스택, 데스크탑은 기존 2패널 */}
            <div
              className="relative z-10 flex flex-col md:flex-row w-full max-w-7xl rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up"
              style={{ border: '1px solid rgba(255,255,255,0.32)', height: 'calc(100dvh - 120px)', maxHeight: '960px', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 0 40px rgba(255,255,255,0.1), 0 0 80px rgba(255,255,255,0.04)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* 왼쪽: 챕터 트리 — 모바일은 상단 고정높이 */}
              <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col max-h-[45%] md:max-h-none" style={{ background: '#0d1117' }}>
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
                  <span className="text-sm font-bold text-gray-200">📂 챕터 선택</span>
                  <button
                    onClick={() => { setChapterModal(false); setChapterSelectedFile(null); }}
                    className="text-gray-500 hover:text-white text-base leading-none transition"
                  >✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
                  {!repo ? (
                    classLoading ? (
                      <div className="flex items-center gap-2 px-2 py-3">
                        <div className="w-4 h-4 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="text-gray-500 text-sm">불러오는 중...</span>
                      </div>
                    ) : (
                      classData.map(({ id, group, teacher: t, repos }) => (
                        <div key={id} className="mb-5">
                          <div className="px-2 mb-1">
                            <p className="text-sm font-bold text-gray-300 truncate">{group.name}</p>
                            <p className="text-[11px] text-gray-500">@{t.githubUsername}</p>
                          </div>
                          {repos.map(r => (
                            <button key={r.name}
                              onClick={() => { const rk = `${id}-${r.name}`; setSelectedRepoKey(rk); handleRepoSelect(t, r); }}
                              className="w-full text-left px-3 py-3 rounded-lg border transition-all flex items-center gap-2.5 mb-1.5 bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-[#4ec9b0]/25 hover:text-white">
                              <svg className="w-4 h-4 shrink-0 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                              </svg>
                              <span className="text-sm font-semibold break-words min-w-0">{r.label}</span>
                            </button>
                          ))}
                        </div>
                      ))
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => reset()}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm px-3 py-2 mb-1.5 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                        레포 목록
                      </button>
                      <p className="text-xs font-bold text-gray-400 px-3 mb-2 truncate">{repo.label}</p>
                      {chaptersLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3">
                          <div className="w-4 h-4 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span className="text-gray-500 text-sm">챕터 로딩 중...</span>
                        </div>
                      ) : chapters.length === 0 ? (
                        <p className="text-gray-600 text-sm px-3">챕터 없음</p>
                      ) : (
                        chapters.map((ch) => {
                          const isExpanded = expandedChapters[ch.name];
                          const files = chapterFilesMap[ch.name] || [];
                          const isLoadingFiles = chapterFilesLoadingMap[ch.name];
                          return (
                            <div key={ch.name} className="mb-0.5">
                              <button onClick={() => handleChapterToggle(ch)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-all group">
                                <svg className={`w-3 h-3 text-gray-600 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5l8 7-8 7V5z"/>
                                </svg>
                                <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                                </svg>
                                <span className="text-sm font-bold shrink-0" style={{ color: '#569cd6' }}>
                                  {ch.name.replace('ch', 'ch.')}
                                </span>
                                {ch.label && ch.label !== ch.name && (
                                  <span className="text-[11px] truncate min-w-0 ml-1.5 px-1.5 py-0.5 rounded bg-white/5" style={{ color: '#ce9178' }}>
                                    {ch.label}
                                  </span>
                                )}
                              </button>
                              {isExpanded && (
                                <div className="ml-5 border-l border-white/[0.06] pl-3 mt-1 mb-1">
                                  {isLoadingFiles ? (
                                    <div className="flex items-center gap-1 px-2 py-1">
                                      <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin shrink-0"/>
                                      <span className="text-gray-600 text-sm">로딩 중...</span>
                                    </div>
                                  ) : files.length === 0 ? (
                                    <p className="text-gray-600 text-sm px-3 py-1.5">파일 없음</p>
                                  ) : (
                                    files.map((file) => {
                                      const isCompleted = completedFiles.includes(file.path);
                                      const isVisited = visitedFiles.includes(file.path);
                                      const isSelected = chapterSelectedFile?.file?.path === file.path;
                                      const fileColor = isCompleted
                                        ? '#9ca3af'
                                        : isVisited
                                          ? '#a044bc'
                                          : '#dcdcaa';
                                      return (
                                        <button key={file.name}
                                          onClick={async () => {
                                            setChapterCodeLoading(true);
                                            setChapterSelectedFile({ file, code: null });
                                            markFileVisited(file.path);
                                            try {
                                              let code = file.sha ? await getGithubFileCache(file.sha) : null;
                                              if (!code) {
                                                const resp = await fetch(file.downloadUrl);
                                                code = await resp.text();
                                                if (file.sha) saveGithubFileCache(file.sha, code);
                                              }
                                              setChapterSelectedFile({ file, code });
                                            } catch {
                                              setChapterSelectedFile({ file, code: '// 코드를 불러오지 못했습니다' });
                                            }
                                            setChapterCodeLoading(false);
                                          }}
                                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md transition-all group mb-0.5 ${isSelected ? 'bg-purple-500/10' : 'hover:bg-white/[0.04]'}`}
                                          style={isCompleted ? { opacity: 0.65 } : {}}
                                        >
                                          <svg className="w-3.5 h-3.5 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: fileColor }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                          </svg>
                                          <span className="text-sm truncate transition-colors" style={{ color: fileColor }}>
                                            {file.name}
                                          </span>
                                          {isCompleted && (
                                            <span className="ml-auto text-[10px] font-black shrink-0" style={{ color: '#9ca3af' }}>✓</span>
                                          )}
                                          {isSelected && !isCompleted && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#a78bfa' }} />
                                          )}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                {/* 범례 */}
                <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">파일 상태</p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { color: '#dcdcaa', label: '안읽음' },
                      { color: '#a044bc', label: '읽음' },
                      { color: '#9ca3af', label: '학습완료' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[11px] text-white/70">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              {/* 오른쪽: 코드 미리보기 or 안내 */}
              {chapterSelectedFile ? (
                <div className="flex-1 flex flex-col min-w-0" style={{ background: '#0d1117' }}>
                  {/* 파일명 헤더 */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      <span className="text-sm font-bold text-gray-200 truncate">{chapterSelectedFile.file.name}</span>
                    </div>
                    {chapterCodeLoading && (
                      <div className="w-4 h-4 border-2 border-purple-400/60 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                  </div>

                  {/* 코드 미리보기 */}
                  <div className="flex-1 min-h-0">
                    {chapterSelectedFile.code === null ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <Editor
                        height="100%"
                        language={(() => {
                          const ext = chapterSelectedFile.file.name.split('.').pop().toLowerCase();
                          return { java: 'java', js: 'javascript', ts: 'typescript', py: 'python', html: 'html', css: 'css', jsp: 'html', xml: 'xml', json: 'json', kt: 'kotlin', cpp: 'cpp', c: 'c' }[ext] || 'plaintext';
                        })()}
                        value={chapterSelectedFile.code}
                        theme="night-owl"
                        options={{
                          readOnly: true,
                          fontSize: 13,
                          lineHeight: 1.7,
                          fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
                          fontLigatures: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          lineNumbers: 'on',
                          renderLineHighlight: 'none',
                          contextmenu: false,
                          scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                          padding: { top: 16, bottom: 16 },
                        }}
                        onMount={(_, monaco) => {
                          monaco.editor.defineTheme('night-owl', nightOwlTheme);
                          monaco.editor.setTheme('night-owl');
                        }}
                      />
                    )}
                  </div>

                  {/* 코드노트로 가져가기 버튼 */}
                  <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      disabled={!chapterSelectedFile.code}
                      onClick={() => {
                        if (!chapterSelectedFile.code) return;
                        setFreeStudyCode(chapterSelectedFile.code);
                        setFreeStudySource('chapter');
                        setChapterModal(false);
                        // chapterSelectedFile 보존 — 뒤로가기 시 모달 복원에 사용
                      }}
                      className="w-full py-4 rounded-xl text-base font-black transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(109,40,217,0.35), rgba(139,92,246,0.2))',
                        border: '1px solid rgba(139,92,246,0.5)',
                        color: '#c4b5fd',
                        boxShadow: chapterSelectedFile.code
                          ? '0 0 24px rgba(139,92,246,0.3), 0 0 48px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.08)'
                          : 'none',
                      }}
                    >
                      💻 코드노트로 가져가기
                    </button>
                  </div>
                </div>
              ) : (
                /* 기본 안내 패널 */
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8" style={{ background: '#0d1117' }}>
                  {/* GitHub × 코드노트 콜라보 아이콘 */}
                  <div className="flex items-center gap-4 mb-8">
                    {/* GitHub Octocat */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 0 20px rgba(255,255,255,0.04)' }}>
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-white/50 tracking-wider">GitHub</span>
                    </div>

                    {/* 연결 화살표 */}
                    <div className="flex flex-col items-center gap-1 pb-5">
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(139,92,246,0.6))' }} />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
                      </div>
                    </div>

                    {/* 코드노트 </> */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#0f1923', border: '1px solid rgba(78,201,176,0.25)', boxShadow: '0 0 20px rgba(78,201,176,0.08)' }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 18l6-6-6-6" stroke="#4ec9b0"/>
                          <path d="M8 6l-6 6 6 6" stroke="#38bdf8"/>
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold tracking-wider" style={{ color: '#4ec9b0' }}>코드노트</span>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-3">복습할 파일을 선택해주세요</h2>
                  <p className="text-sm" style={{ color: '#a78bfa' }}>
                    {!repo ? '왼쪽에서 레포를 선택하세요.' : '챕터를 펼쳐 파일을 선택하면 코드노트로 가져갈 수 있습니다.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Toast />

      {/* 학습메모 인벤토리 */}
      <MemoInventory
        isOpen={memoInventoryOpen}
        onClose={() => setMemoInventoryOpen(false)}
        onSelectMemo={(memo) => {
          setMemoInventoryOpen(false);
          setStep('freestudy');
          setMode('freestudy');
        }}
      />
    </div>
  );
};

/**
 * 모바일 뷰포트에서는 MobileStudentRoot 가 렌더 담당 → 래퍼 레벨에서 조기 반환.
 * StudentPage 내부 훅(useLearningStore, useState 등) 은 항상 일관된 순서로 호출되도록
 * 래퍼를 분리해 Rules of Hooks 위반을 원천 차단한다.
 */
const StudentPageWithMobileGate = (props) => {
  const isMobileGate = useIsMobile();
  if (isMobileGate) return null;
  return <StudentPage {...props} />;
};

export default StudentPageWithMobileGate;
