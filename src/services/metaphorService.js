import { db } from '../lib/firebase';
import {
  doc, getDoc, setDoc, updateDoc,
  serverTimestamp, increment, deleteField,
} from 'firebase/firestore';

const getDocId = (repoName, filePath) =>
  `${repoName}___${filePath.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`;

/** 저장된 비유 불러오기 (Firebase 에러 시 null 반환) */
export const getMetaphorDoc = async (repoName, filePath) => {
  try {
    const id = getDocId(repoName, filePath);
    const snap = await getDoc(doc(db, 'metaphors', id));
    if (!snap.exists()) return null;
    return { id, ...snap.data() };
  } catch (e) {
    console.warn('비유 Firebase 조회 실패 (무시):', e);
    return null;
  }
};

/** 새 비유 저장 또는 업데이트 */
export const saveOrUpdateMetaphor = async (repoName, filePath, content, functionalAnalysis) => {
  try {
    const id = getDocId(repoName, filePath);
    const docRef = doc(db, 'metaphors', id);
    const snap = await getDoc(docRef);

    const baseVotes = { likes: 0, dislikes: 0, voters: {} };

    if (!snap.exists()) {
      await setDoc(docRef, {
        repoName, filePath, content, functionalAnalysis,
        // 섹션별 투표 (기능적 해석 / 메타포)
        functional: { ...baseVotes },
        metaphor:  { ...baseVotes },
        updatedAt: serverTimestamp(),
      });
    } else {
      const totalLikes =
        (snap.data().functional?.likes || 0) +
        (snap.data().metaphor?.likes || 0);

      if (totalLikes < 2) {
        // 좋아요 합계 2개 미만 → 새 비유로 교체
        await updateDoc(docRef, {
          content, functionalAnalysis,
          functional: { ...baseVotes },
          metaphor:  { ...baseVotes },
          metaphor:  { ...baseVotes },
          updatedAt: serverTimestamp(),
        });
      }
    }
    return id;
  } catch (e) {
    console.warn('비유 Firebase 저장 실패 (무시):', e);
    return null;
  }
};

/**
 * 섹션별 좋아요/싫어요 투표
 * @param section 'functional' | 'metaphor'
 * @param vote    'liked' | 'disliked'
 * @returns 최종 투표 상태 'liked' | 'disliked' | null (취소)
 */
export const voteSectionMetaphor = async (repoName, filePath, userId, section, vote) => {
  try {
    const id = getDocId(repoName, filePath);
    const docRef = doc(db, 'metaphors', id);
    const snap = await getDoc(docRef);

    // 문서 없으면 먼저 생성
    if (!snap.exists()) {
      const base = { likes: 0, dislikes: 0, voters: {} };
      await setDoc(docRef, {
        repoName, filePath,
        functional: { ...base },
        metaphor:  { ...base },
        updatedAt: serverTimestamp(),
      });
    }

    const snap2 = await getDoc(docRef);
    const sectionData = snap2.data()?.[section] || { likes: 0, dislikes: 0, voters: {} };
    const prevVote = sectionData.voters?.[userId] || null;
    const updates = {};

    if (prevVote === vote) {
      // 같은 버튼 재클릭 → 취소
      updates[`${section}.voters.${userId}`] = deleteField();
      updates[`${section}.${vote === 'liked' ? 'likes' : 'dislikes'}`] = increment(-1);
      await updateDoc(docRef, updates);
      return null;
    }

    if (prevVote === 'liked')    updates[`${section}.likes`]    = increment(-1);
    if (prevVote === 'disliked') updates[`${section}.dislikes`] = increment(-1);

    updates[`${section}.voters.${userId}`] = vote;
    updates[`${section}.${vote === 'liked' ? 'likes' : 'dislikes'}`] = increment(1);

    await updateDoc(docRef, updates);
    return vote;
  } catch (e) {
    console.warn('투표 Firebase 실패 (무시):', e);
    return null;
  }
};
