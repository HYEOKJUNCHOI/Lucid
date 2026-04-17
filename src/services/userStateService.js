/**
 * userStateService.js
 * Firestore 기반 사용자 상태 읽기/쓰기 통합 API
 *
 * ──────────────────────────────────────────────────
 * Firestore 구조
 * ──────────────────────────────────────────────────
 * users/{uid}
 *   streak            number      현재 연속 출석일 (끊기면 0)
 *   bestStreak        number      역대 최고 연속일 (끊겨도 유지 — 스트릭 뱃지 표시값)
 *   lastRoutineDate   string      마지막 퀘스트 완료 날짜 (YYYY-MM-DD)
 *   streakFreezes     number      보유 얼리기 개수
 *   repairCount       number      복구 퀘스트 진행도 (-1 = 비활성)
 *   streakBeforeBreak number      스트릭 끊기 전 백업값
 *   attendedDates     string[]    출석한 날짜 배열 (YYYY-MM-DD)
 *   frozenDates       string[]    수동으로 얼린 날짜 배열 (YYYY-MM-DD)
 *   dailyXP           object      { "YYYY-MM-DD": { total, quest, levelup, login } }
 *   loginXPClaimed    object      { "YYYY-MM-DD": true } 접속 XP 수령 마커
 *   questDone         object      { "YYYY-MM-DD": true } 퀘스트 완료 마커
 *   weekendBonus      object      { "weekStart": { claimed, streak } }
 *   beanCount         number      원두 개수
 *   beanFirstSeen     boolean     원두 최초 획득 여부
 *   difficultyLevel   number      퀘스트 난이도 (0~4)
 *   weakFiles         string[]    취약 파일 경로 배열
 *   sessionId         string      중복 로그인 감지용 세션 ID
 *   totalXP           number      누적 XP (기존 필드 유지)
 *   level             number      레벨 (기존 필드 유지)
 *
 * users/{uid}/questHistory/{YYYY-MM-DD}
 *   files             object      { [filePath]: repeatCount }
 * ──────────────────────────────────────────────────
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/**
 * 스트릭 뱃지 획득 임계값 — 주말 포함 7일 연속 실제 출석 시 첫 획득.
 * "주말 포함" 은 달력상 7일 연속이면 토·일이 자동으로 포함되므로,
 * **최근 7일 창 전부가 attendedDates 에 있어야** (얼리기로 때운 날 제외) 충족.
 */
export const BADGE_THRESHOLD = 7;

export const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * 최근 7일(baseDate 포함 & 6일 전까지) 달력 창이 모두 실제 출석인지 판정.
 * 얼리기로 때운 날은 attendedDates에 안 들어가므로 자연스럽게 제외됨.
 * 5평일 + 2주말 조건은 7일 연속이면 자동 충족.
 */
export const hasCleanWeekWindow = (attendedDates, baseDate = todayStr()) => {
  const attended = new Set(attendedDates || []);
  const base = new Date(baseDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (!attended.has(ds)) return false;
  }
  return true;
};

/** 두 날짜(YYYY-MM-DD) 사이 일수 차 (b - a) */
export const daysBetween = (a, b) => {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round((msB - msA) / 86400000);
};

// ─── 기본 CRUD ───────────────────────────────────────────────────────────────

/**
 * Firestore에서 사용자 상태 1회 읽기
 * @returns {object|null} users/{uid} 문서 데이터
 */
export const getUserState = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('[userState] 읽기 실패:', e);
    return null;
  }
};

/**
 * Firestore 사용자 상태 업데이트 (merge)
 * 필드 일부만 넘겨도 나머지 필드는 유지됨
 * @param {object} updates — 변경할 필드
 */
export const updateUserState = async (uid, updates) => {
  try {
    await updateDoc(doc(db, 'users', uid), updates);
  } catch (e) {
    console.error('[userState] 쓰기 실패:', e);
    throw e;
  }
};

/**
 * onSnapshot 실시간 구독
 * @param {function} callback — (data: object | null) => void
 * @returns {function} unsubscribe
 */
export const subscribeUserState = (uid, callback) => {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => console.warn('[userState] 구독 에러:', err)
  );
};

// ─── Streak ──────────────────────────────────────────────────────────────────

/**
 * Firestore 기반 스트릭 상태 계산
 * 반환: { streak, status, usedFreeze, repairCount }
 *   status: 'ok' | 'grace1' | 'grace2' | 'broken' | 'repair'
 *
 * @param {object} state — getUserState()로 읽은 Firestore 데이터
 */
export const calcStreakStatus = async (uid, state) => {
  if (!state) return { streak: 0, status: 'ok', usedFreeze: false, repairCount: -1 };

  const today = todayStr();
  const lastQuest = state.lastRoutineDate || null;
  const saved = state.streak || 0;
  const repairCount = state.repairCount ?? -1;
  const freezes = state.streakFreezes || 0;

  // 복구 퀘스트 진행 중
  if (repairCount >= 0 && repairCount < 3) {
    return { streak: saved, status: 'repair', usedFreeze: false, repairCount };
  }

  // 첫 접속 or 오늘 이미 퀘스트 완료
  if (!lastQuest || lastQuest === today) {
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  const gap = daysBetween(lastQuest, today);

  // 미래 날짜 방어 (gap 음수)
  if (gap <= 0) {
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 1) {
    // 어제 완료 — 오늘 퀘스트 대기 중
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 2) {
    // 하루 결석 — 얼리기 자동 소모
    if (freezes > 0) {
      const frozenStreak = saved + 1;
      const newFreezes = freezes - 1;
      const bestSaved = state?.bestStreak || 0;
      // 얼리기로 때운 날은 attendedDates 에 안 들어감 → 뱃지 수여 조건
      // (최근 7일 전부 실제 출석) 은 자연스럽게 미충족. 그래서 여기서는 bump 안 함.
      const updates = {
        streakFreezes: newFreezes,
        streak: frozenStreak,
      };
      // 3일 배수 달성 시 얼리기 보상
      if (frozenStreak % 3 === 0) updates.streakFreezes = newFreezes + 1;
      await updateUserState(uid, updates);
      return { streak: frozenStreak, status: 'grace1', usedFreeze: true, repairCount: -1 };
    }
    return { streak: saved, status: 'grace1', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 3) {
    return { streak: saved, status: 'grace2', usedFreeze: false, repairCount: -1 };
  }

  // 3일+ 결석 — 스트릭 초기화 + 복구 퀘스트 시작
  await updateUserState(uid, {
    streakBeforeBreak: saved,
    streak: 0,
    repairCount: 0,
  });
  return { streak: 0, status: 'broken', usedFreeze: false, repairCount: 0 };
};

/**
 * 퀘스트 완료 처리
 * - 연속일 +1 (or 복구 퀘스트 진행)
 * - 3일 배수 달성 시 얼리기 보상
 * 반환: { streak, repairedStreak, gotFreeze }
 */
export const onQuestCompleteFS = async (uid, state) => {
  const today = todayStr();
  const lastQuest = state?.lastRoutineDate || null;

  // 오늘 이미 완료
  if (lastQuest === today) {
    return { streak: state?.streak || 0, repairedStreak: null, gotFreeze: false };
  }

  const repairCount = state?.repairCount ?? -1;
  const updates = {
    lastRoutineDate: today,
    attendedDates: arrayUnion(today),
    [`questDone.${today}`]: true,
  };

  const bestSaved = state?.bestStreak || 0;
  // 오늘을 포함한 attendedDates 가상 확장 (arrayUnion 으로 today 추가 중)
  const attendedWithToday = [...(state?.attendedDates || []), today];

  // 복구 퀘스트 완료 경로는 이전 3일 내에 결석이 있었으므로 clean week 불가 → bump 안 함
  if (repairCount >= 0) {
    const next = repairCount + 1;
    if (next >= 3) {
      // 복구 완료 (뱃지 갱신 없음 — 이후 실제 7일 달성 시 자연 갱신)
      const before = state?.streakBeforeBreak || 0;
      const restored = before + 1;
      await updateUserState(uid, {
        ...updates,
        streak: restored,
        repairCount: -1,
        streakBeforeBreak: 0,
      });
      return { streak: restored, repairedStreak: restored, gotFreeze: false };
    }
    await updateUserState(uid, { ...updates, repairCount: next });
    return { streak: state?.streak || 0, repairedStreak: null, gotFreeze: false };
  }

  // 일반 완료
  const saved = state?.streak || 0;
  const newStreak = saved + 1;
  const got3DayFreeze = newStreak > 0 && newStreak % 3 === 0;
  // 뱃지 수여 조건: (1) 7일+ 연속 (2) 최근 7일 창 전부 실제 출석 (3) 최고기록 초과
  const qualifiesForBadge =
    newStreak >= BADGE_THRESHOLD &&
    hasCleanWeekWindow(attendedWithToday, today) &&
    newStreak > bestSaved;
  await updateUserState(uid, {
    ...updates,
    streak: newStreak,
    ...(got3DayFreeze ? { streakFreezes: increment(1) } : {}),
    ...(qualifiesForBadge ? { bestStreak: newStreak } : {}),
  });
  return { streak: newStreak, repairedStreak: null, gotFreeze: got3DayFreeze, newBadge: qualifiesForBadge };
};

/**
 * 지나간 결석일을 얼리기로 수동 보호
 * 반환: { success, remaining, newStreak }
 */
export const useFreezeOnDateFS = async (uid, dateStr, state) => {
  const freezes = state?.streakFreezes || 0;
  if (freezes <= 0) return { success: false, remaining: 0, newStreak: state?.streak || 0 };

  const frozenDates = state?.frozenDates || [];
  if (frozenDates.includes(dateStr)) {
    return { success: false, remaining: freezes, newStreak: state?.streak || 0 };
  }

  const newStreak = (state?.streak || 0) + 1;
  const newFreezes = freezes - 1;
  // 수동 얼리기는 그 날 실제 출석이 아님 → 뱃지 갱신 대상 아님
  await updateUserState(uid, {
    frozenDates: arrayUnion(dateStr),
    streakFreezes: newFreezes,
    streak: newStreak,
  });
  return { success: true, remaining: newFreezes, newStreak };
};

// ─── XP ──────────────────────────────────────────────────────────────────────

const DAILY_XP_CAP       = 500;
const DAILY_XP_QUEST_CAP = 200;
const DAILY_XP_LEVELUP_CAP = 250;

/** 연속 배율 (7일: ×1.2, 30일: ×1.5) */
export const getStreakMultiplierFromState = (state) => {
  const streak = state?.streak || 0;
  if (streak >= 30) return 1.5;
  if (streak >= 7)  return 1.2;
  return 1.0;
};

/** 일일 XP 데이터 반환 (Firestore state에서) */
export const getDailyXPFromState = (state) => {
  const today = todayStr();
  const day = state?.dailyXP?.[today] || {};
  return {
    total: (day.login || 0) + (day.quest || 0) + (day.levelup || 0),
    login: day.login || 0,
    quest: day.quest || 0,
    levelup: day.levelup || 0,
  };
};

/**
 * XP 추가 (상한 + 연속 배율 포함)
 * state를 직접 전달해 Firestore 읽기 최소화
 * @param {'login'|'quest'|'levelup'} category
 * @param {boolean} applyStreakBonus — 연속 배율 적용 여부
 * @returns {number} 실제 추가된 XP
 */
export const addDailyXPCapped = async (uid, category, amount, state, applyStreakBonus = false) => {
  const multiplier = applyStreakBonus ? getStreakMultiplierFromState(state) : 1.0;
  amount = Math.round(amount * multiplier);

  const today = todayStr();
  const day = state?.dailyXP?.[today] || {};
  const dayTotal = (day.login || 0) + (day.quest || 0) + (day.levelup || 0);
  const daySource = day[category] || 0;

  const sourceLimit = category === 'quest'   ? DAILY_XP_QUEST_CAP    - daySource :
                      category === 'levelup' ? DAILY_XP_LEVELUP_CAP  - daySource : amount;
  const totalLimit  = DAILY_XP_CAP - dayTotal;
  const actual      = Math.min(amount, sourceLimit, totalLimit);

  if (actual <= 0) return 0;

  await addDailyXPFS(uid, category, actual);
  return actual;
};

/**
 * XP 추가 (카테고리별, 상한 없음 — 내부 전용)
 * @param {'login'|'quest'|'levelup'} category
 */
export const addDailyXPFS = async (uid, category, amount) => {
  const today = todayStr();
  await updateUserState(uid, {
    [`dailyXP.${today}.${category}`]: increment(amount),
    totalXP: increment(amount),
  });
};

/**
 * 접속 보상 XP 지급 (하루 1회)
 * 반환: 지급된 XP (0이면 이미 받음)
 */
export const claimLoginXPFS = async (uid, state) => {
  const today = todayStr();
  if (state?.loginXPClaimed?.[today]) return 0;
  const XP = 50;
  await updateUserState(uid, {
    [`loginXPClaimed.${today}`]: true,
    [`dailyXP.${today}.login`]: increment(XP),
    totalXP: increment(XP),
  });
  return XP;
};

// ─── Bean ─────────────────────────────────────────────────────────────────────

export const addBeansFS = async (uid, amount) => {
  await updateUserState(uid, { beanCount: increment(amount) });
};

/**
 * 퀘스트 완료 시 원두 드랍 판정 (Firestore 기반)
 * 반환: { dropped, isFirst, beanCount }
 */

export const rollBeanDropFS = async (uid, state) => {
  const isFirst = !state?.beanFirstSeen;
  const dropped = isFirst || Math.random() < 0.23;
  if (dropped) {
    const newCount = (state?.beanCount || 0) + 1;
    await updateUserState(uid, {
      beanCount: increment(1),
      ...(isFirst ? { beanFirstSeen: true } : {}),
    });
    return { dropped: true, isFirst, beanCount: newCount };
  }
  return { dropped: false, isFirst: false, beanCount: state?.beanCount || 0 };
};

// ─── Quest 히스토리 (서브컬렉션) ──────────────────────────────────────────────

/** 퀘스트 반복 횟수 기록 */
export const recordQuestRepeatFS = async (uid, filePath) => {
  const today = todayStr();
  const ref = doc(db, 'users', uid, 'questHistory', today);
  await setDoc(ref, { [`files.${filePath.replace(/\./g, '_')}`]: increment(1) }, { merge: true });
};

/** 오늘 해당 파일 퀘스트 몇 번째인지 반환 (1부터 시작) */
export const getQuestRepeatCountFS = async (uid, filePath) => {
  const today = todayStr();
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'questHistory', today));
    if (!snap.exists()) return 1;
    const count = snap.data()?.[`files.${filePath.replace(/\./g, '_')}`] || 0;
    return count + 1;
  } catch {
    return 1;
  }
};

// ─── 관리자 디버그: 임의 필드 직접 덮어쓰기 ───────────────────────────────────

/**
 * 관리자가 디버그 패널에서 사용자 상태를 직접 수정할 때 사용
 * @param {object} fields — 변경할 필드 (raw, merge 없이 지정 필드만 덮어씀)
 */
export const debugSetUserFields = async (uid, fields) => {
  await updateUserState(uid, fields);
};

/**
 * attendedDates + frozenDates 배열에서 "오늘 기준 실제 연속일" 을 계산.
 * 관리자 패널 수정 후 streak/bestStreak 자동 동기화용.
 *
 * 규칙:
 *  - 출석 OR 얼음이면 체인 연결 (사용자 메모: "얼음쓰면 무조건연결")
 *  - 오늘 또는 어제가 커버되어 있어야 체인 인정 (그 이상 공백이면 0)
 *  - 오늘부터 거꾸로 걸으며 처음 비는 날까지 카운트
 */
export const computeStreakFromDates = (attendedDates = [], frozenDates = []) => {
  const attendedSet = new Set(attendedDates || []);
  const frozenSet = new Set(frozenDates || []);
  if (attendedSet.size === 0 && frozenSet.size === 0) return 0;
  const today = todayStr();
  const isCovered = (iso) => attendedSet.has(iso) || frozenSet.has(iso);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yday = y.toISOString().slice(0, 10);
  if (!isCovered(today) && !isCovered(yday)) return 0;
  let count = 0;
  const cursor = new Date(today);
  if (!isCovered(today)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!isCovered(iso)) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

/**
 * 관리자가 출석/얼음 배열을 수정한 뒤 streak/bestStreak 를 재계산해 반영.
 * - streak 는 항상 최신 배열 기준으로 덮어씀
 * - bestStreak 는 7일 이상이고 기존 최고보다 클 때만 상향 (하향 금지)
 */
export const syncStreakFromDates = async (uid) => {
  const state = await getUserState(uid);
  if (!state) return;
  const newStreak = computeStreakFromDates(state.attendedDates, state.frozenDates);
  const curBest = state.bestStreak || 0;
  const updates = { streak: newStreak };
  if (newStreak >= BADGE_THRESHOLD && newStreak > curBest) {
    updates.bestStreak = newStreak;
  }
  await updateDoc(doc(db, 'users', uid), updates);
};

/** 출석 날짜 추가 (YYYY-MM-DD) — 후속 streak 자동 동기화 */
export const debugAddAttendedDate = async (uid, dateStr) => {
  await updateDoc(doc(db, 'users', uid), { attendedDates: arrayUnion(dateStr) });
  await syncStreakFromDates(uid);
};

/** 출석 날짜 제거 (YYYY-MM-DD) — 후속 streak 자동 동기화 */
export const debugRemoveAttendedDate = async (uid, dateStr) => {
  await updateDoc(doc(db, 'users', uid), { attendedDates: arrayRemove(dateStr) });
  await syncStreakFromDates(uid);
};

/** 사용자 상태 초기화 (디버그용) */
export const debugResetUser = async (uid) => {
  await updateUserState(uid, {
    streak: 0,
    bestStreak: 0,
    lastRoutineDate: null,
    streakFreezes: 0,
    repairCount: -1,
    streakBeforeBreak: 0,
    attendedDates: [],
    frozenDates: [],
    dailyXP: {},
    loginXPClaimed: {},
    questDone: {},
    weekendBonus: {},
    beanCount: 0,
    beanFirstSeen: false,
    difficultyLevel: 1,
    weakFiles: [],
  });
};
