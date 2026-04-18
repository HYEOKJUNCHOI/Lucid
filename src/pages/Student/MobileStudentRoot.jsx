import React, { useState, useMemo, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileAppShell from '@/layouts/MobileAppShell';
import HomeTab from '@/pages/Student/mobile/HomeTab';
import LearnTab from '@/pages/Student/mobile/LearnTab';
import QuestTab from '@/pages/Student/mobile/QuestTab';
import LevelUpTab from '@/pages/Student/mobile/LevelUpTab';
import ProfileTab from '@/pages/Student/mobile/ProfileTab';
import { useStudentSession } from '@/pages/Student/hooks/useStudentSession';

/**
 * StudentContext — 모바일 학생 앱 전역 데이터 공유.
 *
 * Firebase 구독 원칙:
 * - 자체 onSnapshot 구독 금지.
 * - userData는 App.jsx의 useAuth()가 이미 구독 중 → props로 받아 context에 주입.
 * - 하위 탭은 자체 구독 없이 context로만 읽음.
 *
 * 포함 데이터:
 * - user / userData / onLogout: App.jsx에서 내려온 원본
 * - streak / streakStatus / dailyXP / freezeCount / beanCount: useStudentSession이 계산한 값
 * - currentTab / handleTabChange: 탭 전환용
 */
export const StudentContext = createContext(null);

// context 읽기 편의 훅 — null 체크 포함
export const useStudentContext = () => {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudentContext: StudentContext.Provider 밖에서 사용됨');
  return ctx;
};

// initialMode(라우트) → 바텀탭 ID 매핑
const MODE_TO_TAB = {
  null: 'home',
  chapter: 'learn',
  quest: 'quest',
  levelup: 'levelup',
  freeStudy: 'levelup', // 마스터노트는 레벨업 탭 내부에서 진입
};

// 탭 ID → URL (북마크/딥링크 호환)
const TAB_TO_PATH = {
  home: '/home',
  learn: '/chapter',
  quest: '/home/quest',
  levelup: '/home/levelup',
  profile: '/home', // 프로필은 별도 URL 없음
};

function resolveInitialTab(initialMode) {
  if (initialMode == null) return MODE_TO_TAB.null;
  return MODE_TO_TAB[initialMode] ?? 'home';
}

/**
 * MobileStudentRoot — 모바일 학생 앱 루트.
 *
 * @param {string|null} initialMode — 진입 모드 ('chapter' | 'quest' | 'levelup' | 'freeStudy' | null)
 * @param {object}      user        — Firebase Auth user
 * @param {object}      userData    — Firestore 사용자 문서 (onSnapshot 결과)
 * @param {function}    onLogout
 */
export default function MobileStudentRoot({ initialMode = null, user, userData, onLogout }) {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(() => resolveInitialTab(initialMode));

  // 스트릭/XP 등 세션 데이터 — 데스크탑 StudentPage와 동일한 로직
  const session = useStudentSession({ user, userData });

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    navigate(TAB_TO_PATH[tabId] || '/home', { replace: true });
  };

  // context 값은 useMemo로 안정화 — 불필요한 하위 렌더 방지
  const ctxValue = useMemo(
    () => ({
      user,
      userData,
      onLogout,
      currentTab,
      handleTabChange,
      ...session, // streak, streakStatus, dailyXP, freezeCount, beanCount, loginXPClaimed
    }),
    [user, userData, onLogout, currentTab, session]
  );

  return (
    <StudentContext.Provider value={ctxValue}>
      <MobileAppShell currentTabId={currentTab} onTabChange={handleTabChange}>
        {currentTab === 'home'    && <HomeTab />}
        {currentTab === 'learn'   && <LearnTab />}
        {currentTab === 'quest'   && <QuestTab />}
        {currentTab === 'levelup' && <LevelUpTab />}
        {currentTab === 'profile' && <ProfileTab />}
      </MobileAppShell>
    </StudentContext.Provider>
  );
}
