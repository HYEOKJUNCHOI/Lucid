import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export const useAuth = () => {
  const [user, setUser]               = useState(undefined); // undefined = 확인 중
  const [role, setRole]               = useState(null);      // 'student' | 'admin'
  const [loading, setLoading]         = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]   = useState(null);

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          
          if (snap.exists()) {
            setRole(snap.data().role || 'student');
            // 기존 유저는 접속 시간만 업데이트
            await setDoc(userRef, { lastStudiedAt: serverTimestamp() }, { merge: true });
          } else {
            // 프로젝트 제출용 이메일 하드코딩
            const isAdmin = firebaseUser.email === 'dla0625@koreaedugroup.com';
            
            // 최초 가입자: 초기 데이터 생성
            const newUser = {
              role: isAdmin ? 'admin' : 'student',
              currentLevel: 1,
              likedMetaphors: [],
              lastStudiedAt: serverTimestamp(),
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || '이름 없음',
            };
            await setDoc(userRef, newUser);
            setRole(newUser.role);
          }
        } catch (error) {
          console.error("User data fetch/creation failed:", error);
          setRole('student'); // 에러 시 폴백
        }
      } else {
        setRole(null);
      }
      setUser(firebaseUser);
      setLoading(false);
      setLoginLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') {
        setLoginError('로그인이 취소되었습니다.');
      } else {
        setLoginError('로그인에 실패했습니다. 다시 시도해 주세요.');
      }
      setLoginLoading(false);
    }
  };

  const logout = () => signOut(auth);

  return { user, role, loading, loginLoading, loginError, loginWithGoogle, logout };
};
