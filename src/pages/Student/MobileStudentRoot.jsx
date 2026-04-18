import React, { useState, useMemo, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileAppShell from '@/layouts/MobileAppShell';
import HomeTab from '@/pages/Student/mobile/HomeTab';
import LearnTab from '@/pages/Student/mobile/LearnTab';
import QuestTab from '@/pages/Student/mobile/QuestTab';
import LevelUpTab from '@/pages/Student/mobile/LevelUpTab';
import ProfileTab from '@/pages/Student/mobile/ProfileTab';

/**
 * StudentContext — 모바일 학생 앱 전역 상태/데이터 전파.
 *
 * **Firebase 구독 원칙 (플랜 R3)**:
 * - 자체 onSnapshot 구독 금지.
 * - userData 는 App.jsx 의 useAuth() 가 이미 onSnapshot 으로 구독 중 → props 로 전달받아 context 에 주입.
 * - 하위 탭(HomeTab/LearnTab/...) 도 자체 구독 금지, context 로만 읽음.
 */
export const StudentContext = createContext(null);

/**
 * initialMode(라우트 mode) → 바텀탭 tabId 매핑.
 * - null(/home)        → home
 * - 'chapter'(/chapter) → learn
 * - 'quest'(/home/quest) → quest
 * - 'levelup'(/home/levelup) → levelup
 * - 'freeStudy'(/study, /freestudy) → levelup (레벨업 탭 내부에서 마스터노트 진입)
 */
const MODE_TO_TAB = {
  null: 'home',
  chapter: 'learn',
  quest: 'quest',
  levelup: 'levelup',
  freeStudy: 'levelup',
};

// 바텀탭 → 대표 URL 매핑(북마크/딥링크 호환 유지)
const TAB_TO_PATH = {
  home: '/home',
  learn: '/chapter',
  quest: '/home/quest',
  levelup: '/home/levelup',
  profile: '/home', // 프로필은 별도 URL 없음 — 홈 경로 유지
};

function resolveInitialTab(initialMode) {
  // key 는 문자열로 들어오므로 null 도 문자열 'null' 이 아님에 주의
  if (initialMode == null) return MODE_TO_TAB.null;
  return MODE_TO_TAB[initialMode] ?? 'home';
}

/**
 * MobileStudentRoot — 모바일 학생 앱 루트 컴포넌트.
 *
 * @param {object} props
 * @param {string|null} props.initialMode — 진입 시 초기 모드 ('chapter'|'quest'|'levelup'|'freeStudy'|null)
 * @param {object} props.user             — Firebase Auth user (useAuth)
 * @param {object} props.userData         — Firestore 사용자 문서 (useAuth onSnapshot 결과)
 * @param {()=>void} [props.onLogout]
 */
export default function MobileStudentRoot({ initialMode = null, user, userData, onLogout }) {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(() => resolveInitialTab(initialMode));

  const ctxValue = useMemo(
    () => ({ user, userData, onLogout }),
    [user, userData, onLogout]
  );

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    const target = TAB_TO_PATH[tabId] || '/home';
    navigate(target, { replace: true });
  };

  return (
    <StudentContext.Provider value={ctxValue}>
      <MobileAppShell currentTabId={currentTab} onTabChange={handleTabChange}>
        {currentTab === 'home' && <HomeTab />}
        {currentTab === 'learn' && <LearnTab />}
        {currentTab === 'quest' && <QuestTab />}
        {currentTab === 'levelup' && <LevelUpTab />}
        {currentTab === 'profile' && <ProfileTab />}
      </MobileAppShell>
    </StudentContext.Provider>
  );
}
