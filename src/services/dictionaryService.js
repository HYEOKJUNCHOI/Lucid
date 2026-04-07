import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

/** 캐시된 단어 조회 */
export const getCachedWord = async (word) => {
  try {
    const snap = await getDoc(doc(db, 'dictionary', word.toLowerCase()));
    if (!snap.exists()) return null;
    return snap.data();
  } catch {
    return null;
  }
};

/** 단어 캐시 저장 (GPT 결과) */
export const cacheWord = async (word, data) => {
  try {
    await setDoc(doc(db, 'dictionary', word.toLowerCase()), {
      ...data,
      cachedAt: serverTimestamp(),
      editedAt: null,
      editedBy: null,
    });
  } catch { /* 무시 */ }
};

/**
 * 수정 제안 저장
 * GPT 검증 통과 후 호출
 */
export const updateCachedWord = async (word, newData, uid) => {
  try {
    await updateDoc(doc(db, 'dictionary', word.toLowerCase()), {
      ...newData,
      editedAt: serverTimestamp(),
      editedBy: uid,
    });
    return true;
  } catch {
    return false;
  }
};
