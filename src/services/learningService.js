import { db } from '../lib/firebase';
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, where, getDocs, orderBy, limit,
  serverTimestamp, increment, arrayUnion,
} from 'firebase/firestore';
import { MODELS, OPENAI_CHAT_URL } from '../lib/aiConfig';

// ─── 문서 ID 생성 ──────────────────────────────
const historyDocId = (uid, repoName, filePath) =>
  `${uid}___${repoName}___${filePath.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`;

// ─── XP 가중치 ─────────────────────────────────
const XP_WEIGHTS = {
  quizComplete:  500,   // 퀴즈 5문제 완료
  quizCorrect:   100,   // 퀴즈 1문제 정답
  fileOpen:       50,   // 파일 열기
  metaphorVote:   20,   // 메타포 투표
};

// ─── 레벨 테이블 (Lv.1~99, 디아블로 5단계 곡선) ──
// 총 ~45,000 XP → Lv.99  |  90일 풀그라인드(500XP/일) = 만렙
// 루틴만(250XP/일) 90일 개근 → Lv.78
// 단계별 milestones (500XP/일 기준):
//   1주(5일)→Lv.14 / 1개월(22일)→Lv.30 / 2개월(44일)→Lv.65 / 3개월(66일)→Lv.75 / 90일→Lv.99
const _buildLevelTable = () => {
  const cost = (n) => {
    if (n <= 13) return Math.round(120 + 11.2 * n);        // 초반 탄력  avg ~190
    if (n <= 29) return Math.round(465 + 8.5 * (n - 13));  // 1차 벽    avg ~530
    if (n <= 64) return Math.round(280 + 2.0 * (n - 29));  // 긴 여정   avg ~315
    if (n <= 74) return Math.round(900 + 40  * (n - 64));  // 2차 벽    avg ~1100 (지옥)
    return         Math.round(450 + 4.3  * (n - 74));      // 마지막 질주 avg ~500
  };
  const table = [{ level: 1, xp: 0 }];
  let cum = 0;
  for (let lv = 1; lv <= 98; lv++) {
    cum += cost(lv);
    table.push({ level: lv + 1, xp: Math.round(cum) });
  }
  return table;
};
const LEVEL_TABLE = _buildLevelTable();

/** 누적 XP → 레벨 산출 (최대 99) */
export const calcLevel = (totalXP) => {
  let lv = 1;
  for (const row of LEVEL_TABLE) {
    if (totalXP >= row.xp) lv = row.level;
    else break;
  }
  return lv;
};

/** 다음 레벨까지 필요 XP */
export const xpToNextLevel = (totalXP) => {
  const currentLv = calcLevel(totalXP);
  if (currentLv >= 99) return 0; // 만렙
  const next = LEVEL_TABLE.find(r => r.level === currentLv + 1);
  if (!next) return 0;
  return next.xp - totalXP;
};

// ─── 퀴즈 결과 저장 ────────────────────────────
/**
 * 퀴즈 완료 시 learningHistory에 기록 + user XP 갱신
 * @param {string} uid
 * @param {string} repoName
 * @param {string} filePath
 * @param {Array} messages   — 전체 채팅 메시지 배열
 * @param {number} correctCount — 정답 수 (0~5)
 */
export const saveLearningResult = async (uid, repoName, filePath, messages, correctCount) => {
  try {
    const docId = historyDocId(uid, repoName, filePath);
    const histRef = doc(db, 'learningHistory', docId);

    // 획득 XP 계산
    const earnedXP =
      XP_WEIGHTS.quizComplete +
      (correctCount * XP_WEIGHTS.quizCorrect);

    await setDoc(histRef, {
      uid,
      repoName,
      filePath,
      messages: messages.slice(-50), // 최근 50개만 저장 (용량 절약)
      correctCount,
      totalQuestions: 5,
      earnedXP,
      completedAt: serverTimestamp(),
    });

    // user 문서 XP 갱신
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      totalXP: increment(earnedXP),
      quizCompletions: increment(1),
      lastStudiedAt: serverTimestamp(),
    });

    // 레벨 재계산
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const newLevel = calcLevel(userSnap.data().totalXP || 0);
      if (newLevel !== userSnap.data().currentLevel) {
        await updateDoc(userRef, { currentLevel: newLevel });
      }
    }

    return { earnedXP, docId };
  } catch (e) {
    console.warn('학습 결과 저장 실패:', e);
    return null;
  }
};

/**
 * 채팅만 하고 이탈 시 부분 세션 저장 (퀴즈 미완료)
 * learningHistory/{uid}___partial___{timestamp}
 */
export const savePartialSession = (uid, repoName, filePath, messages) => {
  if (!uid || !messages || messages.length < 2) return; // 메시지 없으면 저장 X
  try {
    const docId = `${uid}___partial___${Date.now()}`;
    setDoc(doc(db, 'learningHistory', docId), {
      uid,
      repoName,
      filePath,
      messages: messages.slice(-30),
      correctCount: 0,
      partial: true,
      savedAt: serverTimestamp(),
    });
  } catch { /* 무시 — 언마운트 중이라 실패해도 괜찮음 */ }
};

// ─── 파일 열기 XP ──────────────────────────────
export const recordFileOpen = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      totalXP: increment(XP_WEIGHTS.fileOpen),
      filesOpened: increment(1),
      lastStudiedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('파일 오픈 XP 기록 실패:', e);
  }
};


// ─── 동기부여: 오늘 접속자 수 ──────────────────
export const getTodayActiveCount = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('lastStudiedAt', '>=', today),
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    console.warn('오늘 접속자 조회 실패:', e);
    return 0;
  }
};

// ─── 동기부여: 최근 학습 활동 (익명) ──────────
export const getRecentActivities = async (limitCount = 5) => {
  try {
    const q = query(
      collection(db, 'learningHistory'),
      orderBy('completedAt', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      filePath: d.data().filePath,
      correctCount: d.data().correctCount,
      completedAt: d.data().completedAt,
    }));
  } catch (e) {
    console.warn('최근 활동 조회 실패:', e);
    return [];
  }
};

// ─── 주간 TOP 3 ────────────────────────────────
export const getWeeklyTop3 = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      orderBy('totalXP', 'desc'),
      limit(3),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({
      rank: i + 1,
      uid: d.id,
      displayName: d.data().displayName,
      totalXP: d.data().totalXP || 0,
      currentLevel: d.data().currentLevel || 1,
      photoBase64: d.data().photoBase64 || null,
    }));
  } catch (e) {
    console.warn('주간 TOP3 조회 실패:', e);
    return [];
  }
};

// ─── 하루 XP 상한 ─────────────────────────────────
const DAILY_XP_CAP = 500;
const DAILY_XP_LOGIN = 50;       // 접속 보상
const DAILY_XP_QUEST = 200;      // 퀘스트 상한
const DAILY_XP_LEVELUP = 250;    // 문제지옥 상한

/** 오늘의 XP 키 (날짜별) */
const dailyXPKey = () => `lucid_daily_xp_${new Date().toISOString().slice(0, 10)}`;
const dailyLoginKey = () => `lucid_daily_login_${new Date().toISOString().slice(0, 10)}`;

/** 오늘 획득한 XP 조회 */
export const getDailyXP = () => {
  try {
    const data = JSON.parse(localStorage.getItem(dailyXPKey()) || '{}');
    return {
      total: data.total || 0,
      quest: data.quest || 0,
      levelup: data.levelup || 0,
      login: data.login || 0,
    };
  } catch { return { total: 0, quest: 0, levelup: 0, login: 0 }; }
};

/** 연속 출석 배율 (7일: ×1.2, 30일: ×1.5) */
export const getStreakMultiplier = () => {
  const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  if (streak >= 30) return 1.5;
  if (streak >= 7)  return 1.2;
  return 1.0;
};

/** 오늘 XP 추가 (상한 체크 + 연속 배율 적용) */
export const addDailyXP = (amount, source = 'levelup', applyStreakBonus = false) => {
  const multiplier = applyStreakBonus ? getStreakMultiplier() : 1.0;
  amount = Math.round(amount * multiplier);
  const daily = getDailyXP();

  // 소스별 상한 체크
  if (source === 'quest' && daily.quest >= DAILY_XP_QUEST) return 0;
  if (source === 'levelup' && daily.levelup >= DAILY_XP_LEVELUP) return 0;
  if (daily.total >= DAILY_XP_CAP) return 0;

  // 실제 추가 가능한 양 계산
  const sourceLimit = source === 'quest' ? DAILY_XP_QUEST - daily.quest :
                      source === 'levelup' ? DAILY_XP_LEVELUP - daily.levelup : amount;
  const totalLimit = DAILY_XP_CAP - daily.total;
  const actual = Math.min(amount, sourceLimit, totalLimit);

  if (actual <= 0) return 0;

  daily.total += actual;
  daily[source] = (daily[source] || 0) + actual;
  localStorage.setItem(dailyXPKey(), JSON.stringify(daily));

  return actual;
};

/** 접속 보상 (하루 1회) */
export const claimLoginXP = async (uid) => {
  const loginKey = dailyLoginKey();
  if (localStorage.getItem(loginKey)) return 0; // 이미 받음

  const actual = addDailyXP(DAILY_XP_LOGIN, 'login', true);
  if (actual <= 0) return 0;

  localStorage.setItem(loginKey, 'true');

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      totalXP: increment(actual),
      lastStudiedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('접속 XP 기록 실패:', e);
  }
  return actual;
};

// ─── 연속학습 & 얼리기 시스템 (듀오링고 방식) ────────
//
// 규칙:
//   결석 1일 → 얼리기 자동 소모. 없으면 암묵적 패스 (grace1, 조용히)
//   결석 2일 → 암묵적 패스 + "내일이 마지막 기회" 경고 (grace2)
//   결석 3일+ → 스트릭 0 초기화 + 복구 퀘스트 (퀘스트 3연속 완료 시 복구)
//
// localStorage keys:
//   lucid_streak              : 현재 연속일
//   lucid_last_quest          : 마지막 퀘스트 완료일 (YYYY-MM-DD)
//   lucid_last_visit          : 마지막 접속일 (접속 보상용)
//   lucid_streak_freeze       : 얼리기 개수
//   lucid_repair_count        : 복구 퀘스트 진행 횟수 (-1=비활성, 0~2=진행중)
//   lucid_streak_before_break : 복구 전 원래 스트릭
//   lucid_attended_dates      : 실제 출석한 날짜 배열 (YYYY-MM-DD[])
//   lucid_frozen_dates        : 얼리기로 보호한 날짜 배열 (YYYY-MM-DD[])
// ──────────────────────────────────────────────────────

const STREAK_KEY = 'lucid_streak';
const BEST_STREAK_KEY = 'lucid_best_streak'; // 역대 최고 연속일 (뱃지 표시값)
const LAST_QUEST_KEY = 'lucid_last_quest';
const LAST_VISIT_KEY = 'lucid_last_visit';
const FREEZE_KEY = 'lucid_streak_freeze';
const REPAIR_KEY = 'lucid_repair_count';
const STREAK_BEFORE_BREAK_KEY = 'lucid_streak_before_break';
const ATTENDED_DATES_KEY = 'lucid_attended_dates';
const FROZEN_DATES_KEY = 'lucid_frozen_dates';

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** 출석 날짜 배열 조회 (YYYY-MM-DD[]) */
export const getAttendedDates = () => {
  try { return JSON.parse(localStorage.getItem(ATTENDED_DATES_KEY) || '[]'); }
  catch { return []; }
};

/** 출석 날짜 추가 (중복 무시) */
export const addAttendedDate = (dateStr) => {
  const dates = getAttendedDates();
  if (dates.includes(dateStr)) return;
  dates.push(dateStr);
  dates.sort();
  localStorage.setItem(ATTENDED_DATES_KEY, JSON.stringify(dates));
};

/**
 * 기존 streak 기반 데이터 → attendedDates로 마이그레이션 (최초 1회)
 * streak 역산으로 날짜를 채우고, lastQuest 이전에 끊긴 날짜는 포함 안 함
 */
export const migrateAttendedDates = () => {
  const existing = getAttendedDates();
  if (existing.length > 0) return; // 이미 있으면 스킵

  const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  const lastQuest = localStorage.getItem(LAST_QUEST_KEY);
  if (!streak || !lastQuest) return;

  const base = new Date(lastQuest);
  for (let i = 0; i < streak; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    addAttendedDate(d.toISOString().slice(0, 10));
  }
};

/** 얼리기 개수 조회 */
export const getStreakFreezes = () => {
  return parseInt(localStorage.getItem(FREEZE_KEY) || '0');
};

/** 얼리기 추가 */
export const addStreakFreeze = () => {
  const current = getStreakFreezes();
  localStorage.setItem(FREEZE_KEY, String(current + 1));
  return current + 1;
};

/** 얼리기로 보호한 날짜 조회 */
export const getFrozenDates = () => {
  try { return JSON.parse(localStorage.getItem(FROZEN_DATES_KEY) || '[]'); }
  catch { return []; }
};

/**
 * 지나간 결석일을 얼리기로 수동 보호
 * - 얼리기 1개 소모
 * - 연속일(streak) +1 (얼린 날도 출석일로 카운트)
 * 반환: { success, remaining, newStreak }
 */
export const useFreezeOnDate = (dateStr) => {
  const freezes = getStreakFreezes();
  if (freezes <= 0) return { success: false, remaining: 0, newStreak: parseInt(localStorage.getItem(STREAK_KEY) || '0') };

  const dates = getFrozenDates();
  if (dates.includes(dateStr)) return { success: false, remaining: freezes, newStreak: parseInt(localStorage.getItem(STREAK_KEY) || '0') };

  dates.push(dateStr);
  dates.sort();
  localStorage.setItem(FROZEN_DATES_KEY, JSON.stringify(dates));
  localStorage.setItem(FREEZE_KEY, String(freezes - 1));

  // 얼린 날도 출석일로 카운트 → 연속일 +1
  const prevStreak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  const newStreak = prevStreak + 1;
  localStorage.setItem(STREAK_KEY, String(newStreak));

  return { success: true, remaining: freezes - 1, newStreak };
};

/**
 * 스트릭 상태 조회 (접속 시 호출)
 * 반환: { streak, status, usedFreeze, repairCount }
 *   status: 'ok' | 'grace1' | 'grace2' | 'broken' | 'repair'
 */
export const checkStreak = () => {
  const today = todayStr();
  const lastQuest = localStorage.getItem(LAST_QUEST_KEY);
  const saved = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  const repairCount = parseInt(localStorage.getItem(REPAIR_KEY) || '-1');

  // 복구 퀘스트 진행 중
  if (repairCount >= 0 && repairCount < 3) {
    return { streak: saved, status: 'repair', usedFreeze: false, repairCount };
  }

  // 첫 접속이거나 오늘 이미 퀘스트 완료
  if (!lastQuest || lastQuest === today) {
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  const gap = daysBetween(lastQuest, today);

  // 방어: lastQuest가 미래(혹은 시계 되감김)면 음수 gap → 오늘 간주
  if (gap <= 0) {
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 1) {
    // 어제 퀘스트 함 → 정상 대기 (퀘스트 완료 시 +1)
    return { streak: saved, status: 'ok', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 2) {
    // 하루 결석 → 얼리기 자동 소모, 없으면 grace1 (조용히)
    const freezes = getStreakFreezes();
    if (freezes > 0) {
      localStorage.setItem(FREEZE_KEY, String(freezes - 1));
      // 얼리기 사용 날짜도 연속일에 포함 → streak +1
      const frozenStreak = saved + 1;
      localStorage.setItem(STREAK_KEY, String(frozenStreak));
      bumpBestStreak(frozenStreak); // 최고 기록 갱신 체크
      // 3일 배수 달성 시 얼리기 보상 체크
      if (frozenStreak % 3 === 0) addStreakFreeze();
      return { streak: frozenStreak, status: 'grace1', usedFreeze: true, repairCount: -1 };
    }
    return { streak: saved, status: 'grace1', usedFreeze: false, repairCount: -1 };
  }

  if (gap === 3) {
    // 이틀 결석 → grace2 경고 ("내일이 마지막 기회")
    return { streak: saved, status: 'grace2', usedFreeze: false, repairCount: -1 };
  }

  // 3일+ 결석 → 스트릭 초기화 + 복구 퀘스트 시작
  localStorage.setItem(STREAK_BEFORE_BREAK_KEY, String(saved));
  localStorage.setItem(STREAK_KEY, '0');
  localStorage.setItem(REPAIR_KEY, '0');
  return { streak: 0, status: 'broken', usedFreeze: false, repairCount: 0 };
};

/**
 * 퀘스트 완료 시 호출 — 스트릭 +1 또는 복구 퀘스트 진행
 * 반환: { streak, repairedStreak, gotFreeze }
 *   repairedStreak: 복구 완료 시 복구된 스트릭값, 아니면 null
 */
export const onQuestComplete = () => {
  const today = todayStr();
  const lastQuest = localStorage.getItem(LAST_QUEST_KEY);

  // 오늘 이미 카운트됨
  if (lastQuest === today) {
    return { streak: parseInt(localStorage.getItem(STREAK_KEY) || '0'), repairedStreak: null, gotFreeze: false };
  }

  localStorage.setItem(LAST_QUEST_KEY, today);
  addAttendedDate(today); // 출석 날짜 기록

  const repairCount = parseInt(localStorage.getItem(REPAIR_KEY) || '-1');

  // 복구 퀘스트 진행 중
  if (repairCount >= 0) {
    const next = repairCount + 1;
    localStorage.setItem(REPAIR_KEY, String(next));
    if (next >= 3) {
      // 복구 완료!
      const before = parseInt(localStorage.getItem(STREAK_BEFORE_BREAK_KEY) || '0');
      const restored = before + 1;
      localStorage.setItem(STREAK_KEY, String(restored));
      localStorage.setItem(REPAIR_KEY, '-1');
      localStorage.removeItem(STREAK_BEFORE_BREAK_KEY);
      bumpBestStreak(restored);
      const gotFreeze = checkWeekendBonus();
      return { streak: restored, repairedStreak: restored, gotFreeze };
    }
    return { streak: 0, repairedStreak: null, gotFreeze: false };
  }

  // 일반 루틴 완료
  const saved = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  const newStreak = saved + 1;
  localStorage.setItem(STREAK_KEY, String(newStreak));
  const newBadge = bumpBestStreak(newStreak); // 역대 최고 갱신
  // 오늘 퀘스트 완료 마킹 (대시보드 weeklyQuestClear 계산용)
  localStorage.setItem(`lucid_quest_done_${today}`, 'true');
  const gotWeekendFreeze = checkWeekendBonus();

  // 3일 연속 달성마다 얼리기 1개 추가
  const got3DayFreeze = newStreak > 0 && newStreak % 3 === 0;
  if (got3DayFreeze) addStreakFreeze();

  return { streak: newStreak, repairedStreak: null, gotFreeze: gotWeekendFreeze || got3DayFreeze, got3DayFreeze, newBadge };
};

// ─── 스트릭 뱃지 (역대 최고 연속일 — 끊겨도 유지, 넘어서면 갱신) ───
/** 역대 최고 연속일 조회 */
export const getBestStreak = () => {
  return parseInt(localStorage.getItem(BEST_STREAK_KEY) || '0');
};
/** 현재 스트릭이 최고 기록을 넘기면 갱신, 넘긴 경우 true 반환 */
export const bumpBestStreak = (currentStreak) => {
  const best = getBestStreak();
  if (currentStreak > best) {
    localStorage.setItem(BEST_STREAK_KEY, String(currentStreak));
    return true;
  }
  return false;
};

/** 주말 여부 체크 */
export const isWeekend = () => {
  const day = new Date().getDay();
  return day === 0 || day === 6;
};

/** ISO 주차 계산 */
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

/** 주말 루틴 완료 체크 — 토/일 둘 다 하면 얼리기 지급 */
export const checkWeekendBonus = () => {
  const today = new Date();
  const day = today.getDay();
  if (day !== 0 && day !== 6) return false;

  const weekendKey = `lucid_weekend_${today.getFullYear()}_${getWeekNumber(today)}`;
  const data = JSON.parse(localStorage.getItem(weekendKey) || '{}');
  data[day === 6 ? 'sat' : 'sun'] = true;
  localStorage.setItem(weekendKey, JSON.stringify(data));

  if (data.sat && data.sun && !data.rewarded) {
    data.rewarded = true;
    localStorage.setItem(weekendKey, JSON.stringify(data));
    addStreakFreeze();
    return true;
  }
  return false;
};

// ─── 보상 계단 ────────────────────────────────────
const REWARD_TIERS = [
  { xp: 2500,  reward: '🥤', label: '아이스 아메리카노 1잔' },
  { xp: 6000,  reward: '🥤🥤', label: '아이스 아메리카노 2잔' },
  { xp: 15000, reward: '🥤🥤🥤', label: '아이스 아메리카노 3잔' },
];

/** 현재 달성 가능한 보상 조회 */
export const getRewardStatus = (totalXP) => {
  return REWARD_TIERS.map(r => ({
    ...r,
    achieved: totalXP >= r.xp,
    progress: Math.min((totalXP / r.xp) * 100, 100),
  }));
};

// ─── 학습 진도 Firestore 동기화 ─────────────────────
// users/{uid}/learningProgress 문서에 visitedFiles / completedFiles 배열 저장

/** 방문 파일 Firestore에 추가 (arrayUnion) */
export const syncVisitedFile = async (uid, filePath) => {
  try {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      visitedFiles: arrayUnion(filePath),
      lastStudiedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('visitedFiles 동기화 실패:', e);
  }
};

/** 완료 파일 Firestore에 추가 (arrayUnion) */
export const syncCompletedFile = async (uid, filePath) => {
  try {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      completedFiles: arrayUnion(filePath),
      lastStudiedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('completedFiles 동기화 실패:', e);
  }
};

/** 로그인 시 Firestore → 로컬 병합
 *  streak / lastRoutineDate 는 Firestore를 source of truth로 취급해 localStorage에 덮어쓴다.
 *  (localStorage만 쓰면 DB 직접 수정 시 앱에 반영 안 되는 문제가 있어 로그인 시점에 동기화)
 */
export const loadProgressFromFirestore = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { visitedFiles: [], completedFiles: [] };
    const data = snap.data();

    // Firestore → localStorage 덮어쓰기 (streak 계열)
    if (typeof data.streak === 'number') {
      localStorage.setItem(STREAK_KEY, String(data.streak));
    }
    if (typeof data.bestStreak === 'number') {
      localStorage.setItem(BEST_STREAK_KEY, String(data.bestStreak));
    }
    if (typeof data.lastRoutineDate === 'string' && data.lastRoutineDate) {
      localStorage.setItem(LAST_QUEST_KEY, data.lastRoutineDate);
    }

    return {
      visitedFiles:   Array.isArray(data.visitedFiles)   ? data.visitedFiles   : [],
      completedFiles: Array.isArray(data.completedFiles) ? data.completedFiles : [],
    };
  } catch (e) {
    console.warn('진도 로드 실패:', e);
    return { visitedFiles: [], completedFiles: [] };
  }
};

// ─── 퀘스트 반복 드랍률 ─────────────────────────────
// 1회차: 100% / 2회차: 50% / 3회차+: 10 XP 고정
const questRepeatKey = (filePath) =>
  `lucid_quest_repeat_${new Date().toISOString().slice(0,10)}_${filePath.replace(/[^a-zA-Z0-9]/g,'_')}`;

/** 해당 파일 오늘 몇 번째 퀘스트인지 반환 (1부터 시작) */
export const getQuestRepeatCount = (filePath) => {
  return parseInt(localStorage.getItem(questRepeatKey(filePath)) || '0') + 1;
};

/** 퀘스트 완료 시 반복 횟수 기록 */
export const recordQuestRepeat = (filePath) => {
  const key = questRepeatKey(filePath);
  const cur = parseInt(localStorage.getItem(key) || '0');
  localStorage.setItem(key, String(cur + 1));
};

/** 반복 횟수에 따른 XP 배율 (1회차:1.0, 2회차:0.5, 3회차+: 고정 10XP) */
export const getQuestDropRate = (repeatCount) => {
  if (repeatCount <= 1) return { multiplier: 1.0, fixed: null };
  if (repeatCount === 2) return { multiplier: 0.5, fixed: null };
  return { multiplier: 0, fixed: 10 }; // 3회차+: 10 XP 고정
};

// ─── 자유 예습: 주제 → 예시 코드 생성 ──────────────
/**
 * @param {string} topic  — 학생이 입력한 주제 (예: "배열 기초", "싱글톤")
 * @param {string} apiKey — OpenAI API Key
 * @returns {Promise<string>} — 생성된 코드 문자열
 */
export const generateFreeStudyCode = async (topic, apiKey) => {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.VERIFY,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `너는 Java 강사야. 학생이 주제를 입력하면 그 주제를 잘 보여주는 Java 예시 코드를 작성해줘.
규칙:
- 코드만 반환 (설명 없이, 코드 블록 마크다운 없이 순수 코드만)
- 주석은 한국어로 핵심 포인트만 간결하게
- 50~100줄 사이로
- 실행 가능한 완전한 코드 (main 메서드 포함)
- 클래스명은 FreeStudyExample 으로 고정`,
        },
        {
          role: 'user',
          content: `주제: ${topic}`,
        },
      ],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '// 코드 생성 실패';
};

export { XP_WEIGHTS, LEVEL_TABLE, DAILY_XP_CAP, REWARD_TIERS };

// ─── 원두 지갑 ──────────────────────────────────────
const BEAN_KEY = 'lucid_beans';
const BEAN_FIRST_KEY = 'lucid_beans_first_claimed';

/** 현재 보유 원두 수 */
export const getBeanCount = () => parseInt(localStorage.getItem(BEAN_KEY) || '0');

/** 원두 추가 후 새 개수 반환 */
export const addBean = () => {
  const next = getBeanCount() + 1;
  localStorage.setItem(BEAN_KEY, String(next));
  return next;
};

/** 첫 원두 획득 여부 */
export const isFirstBean = () => !localStorage.getItem(BEAN_FIRST_KEY);

/** 첫 원두 마킹 */
export const markFirstBean = () => localStorage.setItem(BEAN_FIRST_KEY, 'true');

/**
 * 퀘스트 완료 시 원두 드랍 판정
 *   첫 퀘스트 완료 → 확정 드랍 1개
 *   이후 → 23% 확률 드랍
 * 반환: { dropped: boolean, isFirst: boolean, beanCount: number }
 */
export const rollBeanDrop = () => {
  const first = isFirstBean();
  const dropped = first || Math.random() < 0.23;
  if (dropped) {
    markFirstBean();
    const count = addBean();
    return { dropped: true, isFirst: first, beanCount: count };
  }
  return { dropped: false, isFirst: false, beanCount: getBeanCount() };
};

// ─── Streak Firestore 동기화 ──────────────────────────
/** streak 관련 localStorage → Firestore 저장 */
export const syncStreakToFirestore = async (uid) => {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      streak:            parseInt(localStorage.getItem(STREAK_KEY) || '0'),
      bestStreak:        parseInt(localStorage.getItem(BEST_STREAK_KEY) || '0'),
      lastRoutineDate:   localStorage.getItem(LAST_QUEST_KEY) || null,
      streakFreezes:     parseInt(localStorage.getItem(FREEZE_KEY) || '0'),
      repairCount:       parseInt(localStorage.getItem(REPAIR_KEY) || '-1'),
      streakBeforeBreak: parseInt(localStorage.getItem(STREAK_BEFORE_BREAK_KEY) || '0'),
    });
  } catch (e) {
    console.warn('streak Firestore 동기화 실패:', e);
  }
};

/** 로그인 시 Firestore → localStorage 복원 */
export const restoreStreakFromFirestore = async (uid) => {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.streak != null)            localStorage.setItem(STREAK_KEY, String(d.streak));
    if (d.bestStreak != null)        localStorage.setItem(BEST_STREAK_KEY, String(d.bestStreak));
    if (d.lastRoutineDate)           localStorage.setItem(LAST_QUEST_KEY, d.lastRoutineDate);
    if (d.streakFreezes != null)     localStorage.setItem(FREEZE_KEY, String(d.streakFreezes));
    if (d.repairCount != null)       localStorage.setItem(REPAIR_KEY, String(d.repairCount));
    if (d.streakBeforeBreak != null) localStorage.setItem(STREAK_BEFORE_BREAK_KEY, String(d.streakBeforeBreak));
  } catch (e) {
    console.warn('streak Firestore 복원 실패:', e);
  }
};

// ─── 타자연습 기록 (users/{uid}.typingStats) ─────────
/**
 * 타자연습 기록 전체 초기화
 * - bestCpm / bestAccuracy / sessionCount / totalChars / recent 모두 리셋
 */
export const resetTypingStats = async (uid) => {
  if (!uid) return false;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        typingStats: {
          bestCpm: 0,
          bestAccuracy: 0,
          sessionCount: 0,
          totalChars: 0,
          lastPlayedAt: null,
          recent: [],
        },
      },
      { merge: true },
    );
    return true;
  } catch (e) {
    console.warn('타자연습 기록 초기화 실패:', e);
    return false;
  }
};

/**
 * 현재 저장된 typingStats 읽어오기 (없으면 null)
 */
export const getTypingStats = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data().typingStats || null;
  } catch (e) {
    console.warn('typingStats 로드 실패:', e);
    return null;
  }
};


/**
 * 타자연습 1세션 완료 시 호출.
 * - 최고기록(bestCpm / bestAccuracy) 자동 갱신
 * - 최근 10개 세션만 recent 배열로 유지
 * - 학원 관계자 프로필 / 학생 대시보드용 공용 소스
 *
 * @param {string} uid
 * @param {{cpm:number, accuracy:number, seconds:number, chars:number, wrongCount:number}} session
 * @returns {Promise<{isNewRecord:boolean, bestCpm:number, bestAccuracy:number}|null>}
 */
export const recordTypingSession = async (uid, session) => {
  if (!uid || !session) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    const prev = (snap.exists() && snap.data().typingStats) || {
      bestCpm: 0,
      bestAccuracy: 0,
      sessionCount: 0,
      totalChars: 0,
      recent: [],
    };

    const newBestCpm      = Math.max(prev.bestCpm || 0, session.cpm || 0);
    const newBestAccuracy = Math.max(prev.bestAccuracy || 0, session.accuracy || 0);
    const isNewRecord     = (session.cpm || 0) > (prev.bestCpm || 0);

    const nextRecent = [
      {
        cpm:        session.cpm || 0,
        accuracy:   session.accuracy || 0,
        seconds:    Number((session.seconds || 0).toFixed(2)),
        chars:      session.chars || 0,
        wrongCount: session.wrongCount || 0,
        playedAt:   new Date().toISOString(),
      },
      ...(Array.isArray(prev.recent) ? prev.recent : []),
    ].slice(0, 10);

    const nextStats = {
      bestCpm:      newBestCpm,
      bestAccuracy: newBestAccuracy,
      sessionCount: (prev.sessionCount || 0) + 1,
      totalChars:   (prev.totalChars || 0) + (session.chars || 0),
      lastPlayedAt: serverTimestamp(),
      recent:       nextRecent,
    };

    await setDoc(userRef, { typingStats: nextStats }, { merge: true });

    return { isNewRecord, bestCpm: newBestCpm, bestAccuracy: newBestAccuracy };
  } catch (e) {
    console.warn('타자연습 기록 저장 실패:', e);
    return null;
  }
};

export const saveCheatBadge = async (uid) => {
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { badges: { cheatBadge: true } }, { merge: true });
  } catch (e) {
    console.warn('치트 배지 저장 실패:', e);
  }
};

// ─── 대시보드 준비물: 사용자 상태 Firestore 동기화 ─────
/**
 * 접속 시 한 번 호출 → 대시보드에 필요한 항목 일괄 저장
 * - name, level, streak, dailyXP, todayAttended, lastStudiedAt, weeklyRoutineClear
 * - status: 오늘 dailyXP > 0 → 'green' / dailyXP === 0 → 'yellow'
 *   (red는 대시보드에서 lastStudiedAt 기준으로 계산)
 */
// ─── GitHub 파일 캐시 ──────────────────────────
// SHA는 git content hash → 내용이 같으면 SHA도 같아서 전역 유니크
export const getGithubFileCache = async (sha) => {
  try {
    const snap = await getDoc(doc(db, 'github_cache', sha));
    return snap.exists() ? snap.data().content : null;
  } catch { return null; }
};

export const saveGithubFileCache = async (sha, content) => {
  try {
    await setDoc(doc(db, 'github_cache', sha), {
      content,
      cachedAt: serverTimestamp(),
    });
  } catch (e) { console.warn('GitHub 캐시 저장 실패:', e); }
};

export const syncUserStatus = async (uid, displayName) => {
  try {
    // Firestore에서 최신 상태 읽기
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const data = snap.data();

    const totalXP = data.totalXP || 0;
    const level   = calcLevel(totalXP);
    const streak  = data.streak || 0;

    // 오늘 dailyXP 합계
    const today = new Date().toISOString().slice(0, 10);
    const dayXP = data.dailyXP?.[today] || {};
    const dailyTotal = (dayXP.login || 0) + (dayXP.quest || 0) + (dayXP.levelup || 0);

    // 이번 주 퀘스트 클리어 수 (questDone 필드 기반)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    let weeklyCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      if (data.questDone?.[dateStr]) weeklyCount++;
    }

    const status = dailyTotal > 0 ? 'green' : 'yellow';

    await updateDoc(doc(db, 'users', uid), {
      name: displayName || '이름 없음',
      level,
      streak,
      dailyXPTotal: dailyTotal,
      todayAttended: true,
      weeklyQuestClear: weeklyCount,
      status,
      lastStudiedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('사용자 상태 동기화 실패:', e);
  }
};
