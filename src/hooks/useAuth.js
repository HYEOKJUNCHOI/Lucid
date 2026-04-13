import { useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import useLearningStore from '../store/useLearningStore';

export const useAuth = () => {
  const [user, setUser]               = useState(undefined); // undefined = 확인 중
  const [userData, setUserData]       = useState(null);      // DB 사용자 문서 (groupId 등)
  const [role, setRole]               = useState(null);      // 'student' | 'admin'
  const [loading, setLoading]         = useState(true);
  const [loginLoading, setLoginLoading] = useState(null); // null | 'google' | 'github'
  const [loginError, setLoginError]   = useState(null);
  // 중복 로그인 감지용 세션 ID (메모리 전용 — 탭/기기 간 킥)
  const sessionIdRef = useRef(null);

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
            try {
            // 로컬 쓰기 중의 캐시 스냅샷은 무시 (곧 서버 확정 스냅샷이 따라오며, 불완전한 데이터로 렌더되는 플래시 방지)
            if (snap.metadata.fromCache && snap.metadata.hasPendingWrites) return;
            if (snap.exists()) {
              const data = snap.data();
              // 중복 로그인 감지 — useRef 기반 (탭 종료 시 메모리 소멸, 스토리지 불필요)
              if (sessionIdRef.current && data.sessionId && data.sessionId !== sessionIdRef.current) {
                sessionIdRef.current = null;
                await signOut(auth);
                setLoginError('다른 기기에서 로그인되어 자동 로그아웃되었습니다.');
                return;
              }
              // 개발자/관리자 계정 무조건 관리자 승격
              const isAdminAccount = firebaseUser.email?.toLowerCase() === 'gurwns369@naver.com'
                || firebaseUser.email?.endsWith('@lucid.admin');
              if (isAdminAccount && data.role !== 'admin') {
                await setDoc(userRef, { role: 'admin' }, { merge: true });
              }

              // 자가치유 + 사전등록 흡수:
              // - groupIDs 비어있으면 invited_students에서 데이터 복사 후 예약표 삭제
              // - groupIDs 이미 채워져있으면 남아있는 예약표만 삭제 (orphan 정리)
              try {
                const inviteRef = doc(db, 'invited_students', firebaseUser.email.toLowerCase());
                const inviteSnap = await getDoc(inviteRef);
                if (inviteSnap.exists()) {
                  if (!data.groupIDs || data.groupIDs.length === 0) {
                    // 자가치유: 데이터 복사
                    const inviteData = inviteSnap.data();
                    const updates = {};
                    if (inviteData.groupIDs?.length > 0) updates.groupIDs = inviteData.groupIDs;
                    if (inviteData.name && data.displayName !== inviteData.name) updates.displayName = inviteData.name;
                    if (inviteData.studentType && data.studentType !== inviteData.studentType) updates.studentType = inviteData.studentType;
                    if (inviteData.phone && !data.phone) updates.phone = inviteData.phone;
                    if (Object.keys(updates).length > 0) {
                      await setDoc(userRef, updates, { merge: true });
                      try { await deleteDoc(inviteRef); } catch {}
                      return; // setDoc → onSnapshot 재발동 → 다음 콜백에서 정상 반영
                    }
                  }
                  // groupIDs 이미 있거나 업데이트 없어도: 예약표 삭제
                  try { await deleteDoc(inviteRef); } catch {}
                }
              } catch (inviteErr) {
                // 사전등록 없거나 권한 거부 → 그대로 진행 (StudentPage에서 자물쇠 카드 표시)
              }

              // email 필드 누락 시 자동 패치 (구버전 doc 호환)
              if (!data.email) {
                await setDoc(userRef, { email: firebaseUser.email }, { merge: true });
                return; // onSnapshot 재발동 → 다음 콜백에서 email 포함된 data로 정상 반영
              }
              setUserData(data);
              setRole(data.role || 'student');
            } else {
              // 최초 가입자 처리 (리스너 밖에서 최초 한 번만 실행되도록도 가능나, 여기서는 snapshot 기반 생성 처리)
              // 중복 생성을 막기 위해 snap.exists()가 false일 때만 실행
              let initialRole = firebaseUser.email === 'gurwns369@naver.com' ? 'admin' : 'student';
              
              const inviteRef = doc(db, 'invited_students', firebaseUser.email.toLowerCase());
              // 사전등록 문서 조회. 권한 없거나 문서 없으면 빈 초기값으로 진행
              // → StudentPage에서 groupIDs.length === 0 분기 → 자물쇠 "소속된 클래스 없음" 카드 표시
              let inviteSnap = null;
              try {
                inviteSnap = await getDoc(inviteRef);
              } catch (inviteErr) {
                inviteSnap = null;
              }
              let initialGroups = [];
              let inviteName = null;
              let invitePhone = null;

              if (inviteSnap?.exists()) {
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
                studentType: inviteSnap?.exists() ? (inviteSnap.data().studentType || 'beginner') : 'beginner',
              };
              await setDoc(userRef, newUser);
              if (inviteSnap?.exists()) {
                try { await deleteDoc(inviteRef); } catch {} // 신규 가입 완료 → 사전등록 예약표 삭제
              }
              // setDoc 이후 리스너가 다시 돌면서 setUserData가 호출될 것이므로 명시적 set은 생략 가능하나 안정성 위해 유지
            }
            setLoading(false);
            } catch (snapErr) {
              console.error('[useAuth] onSnapshot 콜백 에러:', snapErr);
              setLoading(false);
            }
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

  const loginWithProvider = async (provider, key) => {
    setLoginError(null);
    setLoginLoading(key);
    try {
      const newSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionIdRef.current = newSessionId;
      const result = await signInWithPopup(auth, provider);
      await setDoc(doc(db, 'users', result.user.uid), { sessionId: newSessionId }, { merge: true });
    } catch (e) {
      console.error('[login error]', e.code, e.message);
      const cancelled = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      if (e.code === 'auth/account-exists-with-different-credential') {
        // 같은 이메일로 다른 provider 계정 존재 → 기존 계정으로 로그인 후 연결
        try {
          const email = e.customData?.email;
          const pendingCred = GithubAuthProvider.credentialFromError(e);
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('google.com')) {
            const googleProvider = new GoogleAuthProvider();
            googleProvider.setCustomParameters({ login_hint: email });
            const result = await signInWithPopup(auth, googleProvider);
            if (pendingCred) await linkWithCredential(result.user, pendingCred);
          }
        } catch (linkErr) {
          console.error('[account link error]', linkErr);
          setLoginError('계정 연결에 실패했습니다. 구글로 로그인해주세요.');
        }
      } else if (!cancelled.includes(e.code)) {
        setLoginError('로그인에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setLoginLoading(null);
    }
  };

  const loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return loginWithProvider(provider, 'google');
  };

  const loginWithGithub = () => {
    const provider = new GithubAuthProvider();
    return loginWithProvider(provider, 'github');
  };

  /**
   * 학생 이메일/비밀번호 로그인 or 최초 가입
   * - 이미 계정 있으면: 로그인
   * - 계정 없으면: invited_students/{email} 대조 → 있으면 회원가입, 없으면 에러
   */
  const loginOrSignupWithEmail = async (email, password) => {
    setLoginError(null);
    setLoginLoading('email');
    try {
      const newSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionIdRef.current = newSessionId;

      let result;
      try {
        // 1차: 기존 계정으로 로그인 시도
        result = await signInWithEmailAndPassword(auth, email, password);
      } catch (loginErr) {
        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
          // 계정 없음 → invited_students 대조
          const inviteRef = doc(db, 'invited_students', email.toLowerCase());
          const inviteSnap = await getDoc(inviteRef);
          if (!inviteSnap.exists()) {
            setLoginError('등록되지 않은 이메일입니다. 학원에 문의해 주세요.');
            return;
          }
          // 사전등록 확인됨 → 신규 계정 생성
          result = await createUserWithEmailAndPassword(auth, email, password);
        } else if (loginErr.code === 'auth/wrong-password') {
          setLoginError('비밀번호가 올바르지 않습니다.');
          return;
        } else {
          throw loginErr;
        }
      }
      await setDoc(doc(db, 'users', result.user.uid), { sessionId: newSessionId }, { merge: true });
    } catch (e) {
      console.error('[email login error]', e.code, e.message);
      if (e.code === 'auth/weak-password') {
        setLoginError('비밀번호는 6자 이상이어야 합니다.');
      } else if (e.code === 'auth/invalid-email') {
        setLoginError('이메일 형식이 올바르지 않습니다.');
      } else {
        setLoginError('로그인에 실패했습니다: ' + e.message);
      }
    } finally {
      setLoginLoading(null);
    }
  };

  /**
   * 관리자 아이디/비밀번호 로그인
   * Firebase Auth 이메일 형식: {id}@lucid.admin
   * Firebase Console에서 해당 계정을 미리 생성해야 함
   */
  const loginWithAdmin = async (id, password) => {
    setLoginError(null);
    setLoginLoading('admin');
    try {
      const email = `${id.trim()}@lucid.admin`;
      const newSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionIdRef.current = newSessionId;
      const result = await signInWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', result.user.uid), { sessionId: newSessionId, role: 'admin' }, { merge: true });
    } catch (e) {
      console.error('[admin login error]', e.code, e.message);
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setLoginError('로그인에 실패했습니다: ' + e.message);
      }
    } finally {
      setLoginLoading(null);
    }
  };

  const logout = () => {
    sessionIdRef.current = null;
    useLearningStore.getState().reset();
    setLoginLoading(null); // null이어야 버튼 disabled가 풀림 (false면 cursor-wait 유지됨)
    setLoginError(null);
    localStorage.removeItem('lucid_free_code');
    signOut(auth);
  };

  return { user, userData, role, loading, loginLoading, loginError, loginWithGoogle, loginWithGithub, loginWithAdmin, loginOrSignupWithEmail, logout };
};
