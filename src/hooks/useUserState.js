/**
 * useUserState.js
 * Firestore users/{uid} 문서를 onSnapshot으로 실시간 구독하는 훅
 *
 * 사용법:
 *   const { state, loading } = useUserState(user?.uid);
 *
 * - state: Firestore 문서 데이터 (null이면 문서 없음)
 * - loading: 최초 로드 완료 여부
 * - 문서 변경 시 state가 자동 갱신 (새로고침 불필요)
 */

import { useState, useEffect } from 'react';
import { subscribeUserState } from '../services/userStateService';

export const useUserState = (uid) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeUserState(uid, (data) => {
      setState(data);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  return { state, loading };
};
