import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import useLearningStore from '../store/useLearningStore';

export const useAuth = () => {
  const [user, setUser]               = useState(undefined); // undefined = 확인 중
  const [userData, setUserData]       = useState(null);      // DB 사용자 문서 (groupId 등)
  const [role, setRole]               = useState(null);      // 'student' | 'admin'
  const [loading, setLoading]         = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]   = useState(null);

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence);
  }, []);

  useEffect(() => {
    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // 인증 확인이 시작되면 loading을 먼저 체크 (새로고침 시 loading은 이미 true임)

      // 기존 리스너 클린업
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          
          // 실시간 리스너 설정
          unsubDoc = onSnapshot(userRef, async (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              // 개발자 계정 무조건 관리자 승격 (리스너 안에서 중복 처리 방지 겸 저장)
              if (firebaseUser.email?.toLowerCase() === 'gurwns369@naver.com' && data.role !== 'admin') {
                await setDoc(userRef, { role: 'admin' }, { merge: true });
              }

              // groupIDs가 비어있을 때 invited_students에서 자동 동기화
              // 이유: 학생이 먼저 로그인(users 문서 생성) 후 어드민이 반 배정했을 경우,
              //       invited_students에는 groupIDs가 있지만 users 문서에는 반영이 안 되는 케이스 커버
              if (!data.groupIDs || data.groupIDs.length === 0) {
                const inviteRef = doc(db, 'invited_students', firebaseUser.email.toLowerCase());
                const inviteSnap = await getDoc(inviteRef);
                if (inviteSnap.exists()) {
                  const inviteGroups = inviteSnap.data().groupIDs || [];
                  if (inviteGroups.length > 0) {
                    // users 문서에 groupIDs 업데이트 → onSnapshot 재발동으로 자동 반영
                    await setDoc(userRef, { groupIDs: inviteGroups }, { merge: true });
                    return; // 다음 onSnapshot 콜백에서 최신 data로 setUserData 호출됨
                  }
                }
              }

              setUserData(data);
              setRole(data.role || 'student');
            } else {
              // 최초 가입자 처리 (리스너 밖에서 최초 한 번만 실행되도록도 가능나, 여기서는 snapshot 기반 생성 처리)
              // 중복 생성을 막기 위해 snap.exists()가 false일 때만 실행
              let initialRole = firebaseUser.email === 'gurwns369@naver.com' ? 'admin' : 'student';
              
              const inviteRef = doc(db, 'invited_students', firebaseUser.email.toLowerCase());
              const inviteSnap = await getDoc(inviteRef);
              let initialGroups = [];
              let inviteName = null;
              let invitePhone = null;

              if (inviteSnap.exists()) {
                const inviteData = inviteSnap.data();
                initialGroups = inviteData.groupIDs || [];
                inviteName = inviteData.name || null;
                invitePhone = inviteData.phone || null;
              }

              const newUser = {
                role: initialRole,
                currentLevel: 1,
                groupIDs: initialGroups,
                likedMetaphors: [],
                lastStudiedAt: serverTimestamp(),
                email: firebaseUser.email,
                displayName: inviteName || firebaseUser.displayName || '이름 없음',
                phone: invitePhone || '',
              };
              await setDoc(userRef, newUser);
              // setDoc 이후 리스너가 다시 돌면서 setUserData가 호출될 것이므로 명시적 set은 생략 가능하나 안정성 위해 유지
            }
            setLoading(false);
          });

          // 접속 시간 기록 (별도로 한 번만)
          await setDoc(userRef, { lastStudiedAt: serverTimestamp() }, { merge: true });

        } catch (error) {
          console.error("User data sync failed:", error);
          setRole('student');
          setLoading(false);
        }
      } else {
        setUserData(null);
        setRole(null);
        setLoading(false);
      }
      setUser(firebaseUser);
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // 로그인 성공 후 로딩 해제 (페이지 이동 전 상태 커버)
      setLoginLoading(false);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') {
        setLoginError('로그인이 취소되었습니다.');
      } else {
        setLoginError('로그인에 실패했습니다. 다시 시도해 주세요.');
      }
      setLoginLoading(false);
    }
  };

  const logout = () => {
    // 로그아웃 시 로그인 상태 초기화 및 Zustand 스토어 리셋 (Persistence 해제)
    useLearningStore.getState().reset();
    setLoginLoading(false);
    setLoginError(null);
    signOut(auth);
  };

  return { user, userData, role, loading, loginLoading, loginError, loginWithGoogle, logout };
};
