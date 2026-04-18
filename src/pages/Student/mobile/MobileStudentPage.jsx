import { useState, useMemo, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentSession } from '@/pages/Student/hooks/useStudentSession';
import HomeTab from './HomeTab';
import QuestTab from './QuestTab';
import LevelUpTab from './LevelUpTab';
import ProfileTab from './ProfileTab';
import MobileChapterPicker from './chapter/MobileChapterPicker';
import MobileLearningView from './chapter/MobileLearningView';
import MobileBottomNav from './components/MobileBottomNav';

/**
 * StudentContext — 모바일 v2 학생 앱 전역 컨텍스트.
 *
 * 구독 원칙: 자체 onSnapshot 금지. userData는 App.jsx useAuth() 이미 구독 중.
 *
 * 포함 데이터:
 * - user / userData / onLogout: App.jsx에서 내려온 원본
 * - streak / streakStatus / dailyXP / freezeCount / beanCount: useStudentSession 계산값
 * - currentTab / handleTabChange: 탭 전환
 * - learningState / enterLearning / exitLearning / setLearningSubTab: 학습 모드
 */
export const StudentContext = createContext(null);

/** context 읽기 편의 훅 — null 체크 포함 */
export const useStudentContext = () => {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudentContext: StudentContext.Provider 밖에서 사용됨');
  return ctx;
};

// 초기 URL 모드 → 바텀탭 ID 매핑
const MODE_TO_TAB = {
  null: 'home',
  chapter: 'learn',
  quest: 'quest',
  levelup: 'levelup',
  freeStudy: 'levelup',
};

// 탭 ID → URL (북마크 / 딥링크 호환)
const TAB_TO_PATH = {
  home: '/home',
  learn: '/chapter',
  quest: '/home/quest',
  levelup: '/home/levelup',
  profile: '/home',
};

function resolveInitialTab(initialMode) {
  if (initialMode == null) return 'home';
  return MODE_TO_TAB[initialMode] ?? 'home';
}

/**
 * MobileStudentPage — 모바일 v2 학생 앱 루트.
 *
 * 두 가지 렌더 모드:
 * - 탭 모드: 하단 5탭 + 탭별 화면 (기본)
 * - 학습 모드: 파일 진입 시 풀스크린 + 동적 하단 메뉴 (코드노트 / 튜터 / 문제풀기 / 노트)
 */
export default function MobileStudentPage({ initialMode = null, user, userData, onLogout }) {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(() => resolveInitialTab(initialMode));

  /**
   * learningState: null = 탭 모드
   * { chapter, file, subTab } = 학습 모드 (파일 선택 후 진입)
   * subTab: 'tutor' | 'codenote' | 'quiz' | 'note'
   */
  const [learningState, setLearningState] = useState(null);

  const session = useStudentSession({ user, userData });

  const handleTabChange = (tabId) => {
    // 학습 모드에서 탭 전환 시 학습 상태 초기화
    setLearningState(null);
    setCurrentTab(tabId);
    navigate(TAB_TO_PATH[tabId] || '/home', { replace: true });
  };

  /** 챕터 파일 선택 → 학습 모드 진입. subTab 기본값은 튜터 */
  const enterLearning = (chapter, file) => {
    setLearningState({ chapter, file, subTab: 'tutor' });
  };

  /** 학습 모드 서브탭 전환 */
  const setLearningSubTab = (subTab) => {
    setLearningState((prev) => (prev ? { ...prev, subTab } : prev));
  };

  /** 학습 모드 종료 → 챕터 피커로 복귀 */
  const exitLearning = () => {
    setLearningState(null);
  };

  const ctxValue = useMemo(
    () => ({
      user,
      userData,
      onLogout,
      currentTab,
      handleTabChange,
      learningState,
      enterLearning,
      exitLearning,
      setLearningSubTab,
      ...session,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, userData, onLogout, currentTab, learningState, session]
  );

  const isLearningMode = !!learningState;

  return (
    <StudentContext.Provider value={ctxValue}>
      {/* h-[100dvh]: dvh는 키보드 올라오면 shrink → 입력창 가림 없음 */}
      <div className="relative w-full md:hidden overflow-hidden" style={{ height: '100dvh' }}>

        {/* ── 메인 컨텐츠 영역 ── */}
        {isLearningMode ? (
          // 학습 모드: 풀스크린 (챕터 파일 선택 후)
          <MobileLearningView />
        ) : (
          // 탭 모드: 현재 탭에 맞는 화면
          <>
            {currentTab === 'home'    && <HomeTab />}
            {currentTab === 'learn'   && <MobileChapterPicker />}
            {currentTab === 'quest'   && <QuestTab />}
            {currentTab === 'levelup' && <LevelUpTab />}
            {currentTab === 'profile' && <ProfileTab />}
          </>
        )}

        {/* ── 하단 탭바 (항상 표시, 학습 모드에서는 동적 메뉴로 변환) ── */}
        <MobileBottomNav />
      </div>
    </StudentContext.Provider>
  );
}
