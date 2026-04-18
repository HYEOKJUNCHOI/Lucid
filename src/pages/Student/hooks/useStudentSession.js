import { useState, useEffect } from 'react';
import {
  calcStreakStatus,
  claimLoginXPFS,
  getDailyXPFromState,
  getUserState,
} from '@/services/userStateService';
import { syncUserStatus } from '@/services/learningService';

/**
 * 학생 세션 초기화 훅.
 *
 * StudentPage(데스크탑)와 MobileStudentPage(모바일) 양쪽에서 동일하게 사용한다.
 * 중복 로직을 없애기 위해 분리 — 두 곳 모두 "로그인 직후 스트릭 계산 + 접속 XP 지급"이 필요.
 *
 * userData는 App.jsx의 onSnapshot이 이미 구독 중이므로
 * 이 훅에서는 별도 구독 없이 props로 받는다.
 */
export function useStudentSession({ user, userData }) {
  const [streak, setStreak] = useState(0);
  const [streakStatus, setStreakStatus] = useState('ok'); // 'ok' | 'grace1' | 'grace2' | 'broken' | 'repair'
  const [repairCount, setRepairCount] = useState(-1);
  const [dailyXP, setDailyXP] = useState({ total: 0, quest: 0, levelup: 0, login: 0 });
  const [freezeCount, setFreezeCount] = useState(0);
  const [beanCount, setBeanCount] = useState(0);
  const [loginXPClaimed, setLoginXPClaimed] = useState(false);

  // 로그인 시 1회: 스트릭 재계산 + 접속 XP 지급
  // user가 바뀔 때만 실행 (페이지 전환은 무시)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setStreak(0);
      setStreakStatus('ok');
      setRepairCount(-1);
      return;
    }

    getUserState(uid).then(async (state) => {
      if (!state) return;

      // 스트릭 상태 계산 — Firestore를 수정할 수도 있으므로 기다린 뒤 XP 지급
      const { streak: newStreak, status, repairCount: rc } = await calcStreakStatus(uid, state);
      setStreak(newStreak);
      setStreakStatus(status);
      setRepairCount(rc);

      // calcStreakStatus가 FS를 수정했을 수 있으므로 최신 상태 재조회 후 XP 지급
      const freshState = await getUserState(uid);
      const xp = await claimLoginXPFS(uid, freshState);
      if (xp > 0) setLoginXPClaimed(true);

      // 타 기기/관리자 화면에서 학생 온라인 상태 확인용
      syncUserStatus(uid, user?.displayName || user?.email?.split('@')[0] || '');
    });
  }, [user]);

  // userData onSnapshot 변경 시 UI 실시간 동기화
  // (XP 지급, 얼리기 사용 등 Firestore 변경이 즉시 반영됨)
  useEffect(() => {
    if (!userData) return;
    setFreezeCount(userData.streakFreezes || 0);
    setBeanCount(userData.beanCount || 0);
    setDailyXP(getDailyXPFromState(userData));
    if (userData.streak != null) setStreak(userData.streak);
  }, [userData]);

  return {
    streak,
    streakStatus,
    repairCount,
    dailyXP,
    freezeCount,
    beanCount,
    loginXPClaimed,
  };
}
